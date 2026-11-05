import os
import json
import re
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.retrievers import BM25Retriever

load_dotenv()

# -----------------------------
# API KEY & CONFIG
# -----------------------------
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
FAISS_INDEX_PATH = "faiss_index"
INDEXED_REGISTRY_PATH = "indexed_files.json"

if not GOOGLE_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")


def list_available_documents() -> list:
    """
    Reads indexed_files.json directly (same file upload_routes.py writes)
    so "which documents do you have" can be answered from the actual
    registry, not guessed by the LLM from retrieved chunks.
    """
    if not os.path.exists(INDEXED_REGISTRY_PATH):
        return []
    with open(INDEXED_REGISTRY_PATH, "r") as f:
        data = json.load(f)
    if isinstance(data, dict):
        return sorted(data.keys())
    if isinstance(data, list):
        return sorted(data)
    return []


META_QUESTION_KEYWORDS = [
    "which document", "which docs", "what document", "what docs",
    "what files", "which files", "list of document", "list document",
    "what data do you have", "what information do you have",
    "how many document", "how many docs", "how many file", "how many files",
    "number of document", "number of files",
    "documents do you have", "docs do you have", "files do you have",
    "documents are available", "files are available",
]


def is_meta_document_question(question: str) -> bool:
    """
    Detects questions ABOUT the system (what documents/files exist) rather
    than questions ABOUT their content — these need a different answer
    path than vector search, since "what files do you have" isn't
    something written inside any document's text.
    """
    q = question.lower()
    return any(kw in q for kw in META_QUESTION_KEYWORDS)


def _extract_delta_text(content) -> str:
    """
    "Thinking" models (like gemini-3.5-flash) can return response.content as
    a list of blocks (reasoning/thinking blocks + text blocks) instead of a
    plain string. This pulls out just the actual answer text either way.
    Used per-chunk while streaming, so it does NOT strip whitespace — a
    chunk boundary can legitimately fall between two words, and stripping
    each delta would eat the space between them.
    """
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts = []
        for block in content:
            if isinstance(block, str):
                text_parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                text_parts.append(block.get("text", ""))
        return "".join(text_parts)

    return str(content)


def extract_answer_text(content) -> str:
    """Same as _extract_delta_text, but for a complete (non-streamed)
    response where trimming the ends is safe and expected."""
    return _extract_delta_text(content).strip()

# -----------------------------
# Initialize Gemini & Embeddings
# -----------------------------
llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash",
    google_api_key=GOOGLE_API_KEY,
    temperature=0.2,  # Low temperature to prevent hallucinations
    # Disabled: measured ~2.3s of silence before gemini-3.5-flash's internal
    # "thinking" pass finished, then almost the entire answer arrived in a
    # single ~40ms burst (5 chunks total) — not real token-by-token
    # streaming. With thinking disabled, the same test produced 7 chunks
    # spread over ~300ms and started ~0.5s sooner. Still bursty (a hard API
    # limitation, not something tunable further from here), which is why
    # the frontend also paces reveal client-side — see ChatPage.jsx.
    thinking_budget=0,
)

embedding_model = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    google_api_key=GOOGLE_API_KEY
)

# -----------------------------
# Retriever cache — the FAISS index + a BM25 index built from the same
# chunks, kept in memory across requests instead of reloading from disk
# every question. Invalidated by clear_rag_caches() whenever documents
# change (upload/delete/reset).
# -----------------------------
_retriever_cache = {"vector_store": None, "bm25_retriever": None}
_answer_cache: dict = {}


def clear_rag_caches():
    """Call after any document upload/delete/reset so stale retrievers and
    cached answers don't outlive the index they were built from."""
    _retriever_cache["vector_store"] = None
    _retriever_cache["bm25_retriever"] = None
    _answer_cache.clear()


def _get_retrievers():
    if _retriever_cache["vector_store"] is None:
        vector_store = FAISS.load_local(
            FAISS_INDEX_PATH,
            embedding_model,
            allow_dangerous_deserialization=True
        )
        all_docs = list(vector_store.docstore._dict.values())
        bm25_retriever = None
        if all_docs:
            bm25_retriever = BM25Retriever.from_documents(all_docs)
            bm25_retriever.k = 4
        _retriever_cache["vector_store"] = vector_store
        _retriever_cache["bm25_retriever"] = bm25_retriever
    return _retriever_cache["vector_store"], _retriever_cache["bm25_retriever"]


def _normalize_question(question: str) -> str:
    return re.sub(r"\s+", " ", question.strip().lower()).rstrip("?.! ")


# -----------------------------
# Whether a question is safe to cache used to be gated on "does this
# session have any prior messages at all" — but that's the wrong signal.
# Almost every real question is asked mid-conversation (confirmed live:
# a fully self-contained question — "What do I need to do on my first
# day?" — got a real answer, then failed on a verbatim repeat because the
# first answer was never cached, purely because *some* earlier message
# existed in that session, even though THIS question didn't reference it
# at all). The actual risk was never "history exists" — it's "this
# specific question can't be understood without that history" (e.g. "what
# about Fridays?"). Detecting THAT directly, instead of using session
# history as a stand-in for it, means self-contained questions get cached
# (and reused) regardless of how deep into a conversation they're asked.
# -----------------------------
_CONTEXT_DEPENDENCY_PHRASES = (
    "what about", "how about", "and what about", "and how about",
    "what if", "same for", "same question",
)
_CONTEXT_DEPENDENCY_WORDS = {
    "it", "its", "that", "those", "these", "they", "them", "also", "too",
}


def _is_context_dependent_question(question: str) -> bool:
    q = _normalize_question(question)
    if any(q.startswith(p) or f" {p} " in f" {q} " for p in _CONTEXT_DEPENDENCY_PHRASES):
        return True
    words = re.findall(r"[a-z']+", q)
    return any(w in _CONTEXT_DEPENDENCY_WORDS for w in words)


_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "to", "of", "in", "on", "for",
    "and", "or", "with", "as", "by", "this", "that", "it", "be", "your", "you",
    "i", "can", "do", "does", "have", "has", "will", "would", "should", "if",
    "at", "from", "not", "any", "all", "there", "their", "what", "how", "which",
}


def _content_words(text: str) -> set:
    words = re.findall(r"[a-zA-Z]{3,}", text.lower())
    return {w for w in words if w not in _STOPWORDS}


def _groundedness_ratio(answer: str, context: str) -> float:
    """
    Cheap lexical-overlap heuristic: what fraction of the answer's
    substantive words actually appear somewhere in the retrieved context?
    A low ratio means the model likely drifted from the source material
    even though retrieval itself found plausible-looking chunks — the
    similarity threshold alone doesn't catch that, since it only judges
    the *retrieval*, not what the LLM did with it. Doesn't call the LLM
    again (no extra API cost), unlike an LLM-based self-check would.
    """
    answer_words = _content_words(answer)
    if not answer_words:
        return 1.0
    context_words = _content_words(context)
    return len(answer_words & context_words) / len(answer_words)


# -----------------------------
# Groundedness only makes sense to check in the language the source
# documents are written in (English) — a correctly-translated answer will
# legitimately share almost no words with its English source text, so
# comparing them lexically is meaningless, not a sign of drift.
#
# Two distinct failure modes existed before this, found via real testing:
# 1. Real Urdu-script answers: _content_words()'s `[a-zA-Z]{3,}` regex
#    doesn't match Arabic-block characters at all, so answer_words came
#    back empty and the check silently no-op'd (always "passed") — an
#    accident of the regex, not an intentional decision, so it would have
#    broken again the moment anyone "fixed" that regex without knowing why.
# 2. Roman Urdu answers (Urdu words in Latin script, e.g. a user asking
#    "jawab Roman Urdu mein do"): these DO match the regex, so the check
#    ran for real — and incorrectly rejected a fully correct, grounded
#    answer (confirmed live: a real Work-From-Home policy question, with
#    the right policy text genuinely in the retrieved context) purely
#    because Urdu vocabulary doesn't lexically overlap with the English
#    source, even in Latin script.
#
# Fix: detect either case up front and skip the lexical check entirely for
# non-English answers, falling back on the upstream similarity-threshold
# gate (scored on the English question against English-embedded documents,
# so unaffected by output language) as the hallucination guard instead.
# -----------------------------
_ARABIC_SCRIPT_RE = re.compile(r"[\u0600-\u06FF]")  # Arabic/Urdu Unicode block

# Extremely common Roman Urdu function words/particles — the equivalent of
# English "the/is/of/and" for detection purposes. Real sentences in Roman
# Urdu use these constantly regardless of topic, so a handful of hits among
# a short answer's words is a reliable "this isn't English" signal without
# needing real language-detection.
_ROMAN_URDU_MARKERS = {
    "hai", "hain", "hoon", "ho", "tha", "thi", "the",
    "aur", "ka", "ki", "ke", "ko", "se", "mein", "pe", "par",
    "kya", "kyun", "kyu", "kaise", "kese", "kahan", "kab",
    "nahi", "nahin", "haan", "bhi", "sirf", "abhi",
    "aap", "apka", "apki", "apke", "hamara", "hamari",
    "kar", "karo", "karke", "karta", "karti", "karte",
    "raha", "rahi", "rahe", "sakte", "sakta", "sakti",
    "wala", "wali", "wale", "din", "hafte", "saal", "ghar", "kaam",
}


def _is_non_english_answer(text: str) -> bool:
    if _ARABIC_SCRIPT_RE.search(text):
        return True
    words = re.findall(r"[a-zA-Z]+", text.lower())
    if len(words) < 4:
        return False
    marker_hits = sum(1 for w in words if w in _ROMAN_URDU_MARKERS)
    return marker_hits / len(words) > 0.15


# -----------------------------
# Shared retrieval/prep — used by both generate_answer (returns a dict)
# and stream_answer (yields tokens as they're generated). Everything up to
# but not including the actual LLM call is identical between the two.
# -----------------------------
def _build_history_block(chat_history: list[dict] | None) -> str:
    if not chat_history:
        return ""
    recent = chat_history[-6:]  # last few turns is enough for follow-up context
    transcript = "\n".join(f"{turn['role'].capitalize()}: {turn['content']}" for turn in recent)
    return f"""
Recent conversation (for context only — do NOT treat this as source material,
only use it to understand what "it"/"that"/a follow-up question refers to):
{transcript}
"""


def _prepare(question: str, chat_history: list[dict] | None):
    """
    Returns ("shortcut", result_dict) when there's nothing left to generate
    (meta-question, no index, cache hit, off-topic rejection), or
    ("generate", system_prompt, context, source_string, cache_key, use_cache)
    when the LLM still needs to be called.
    """
    # Meta-questions ("which documents do you have") are answered directly
    # from the registry — vector search over document *content* isn't the
    # right tool for a question about which files exist.
    if is_meta_document_question(question):
        docs = list_available_documents()
        if not docs:
            return "shortcut", {"answer": "I don't have any documents uploaded yet.", "source": "No documents uploaded"}
        return "shortcut", {"answer": f"I currently have access to: {', '.join(docs)}.", "source": "N/A"}

    if not os.path.exists(FAISS_INDEX_PATH):
        return "shortcut", {
            "answer": "Hello! I don't have access to any HR documents yet. Please upload policy documents first.",
            "source": "No documents uploaded",
        }

    # Repeated questions (common in an HR bot — many employees ask the same
    # thing) skip retrieval AND the LLM call entirely, straight from cache.
    # Reads always happen regardless of chat_history. Whether a fresh
    # answer gets WRITTEN to the cache is gated on whether *this specific
    # question* is context-dependent (_is_context_dependent_question), not
    # on whether the session merely has prior messages — confirmed live
    # that almost every real question is asked mid-conversation, so gating
    # on "any history exists" meant caching almost never actually
    # triggered in practice. A self-contained question ("What do I need to
    # do on my first day?") is safe to cache and reuse no matter how deep
    # into a conversation it's asked; a referential one ("what about
    # Fridays?") still never gets cached, since its answer only makes
    # sense given the specific conversation it was asked in.
    cache_key = _normalize_question(question)
    if cache_key in _answer_cache:
        return "shortcut", _answer_cache[cache_key]
    use_cache = not _is_context_dependent_question(question)

    # Load the vector store + a BM25 keyword index over the same chunks
    # (cached across requests — see _get_retrievers).
    vector_store, bm25_retriever = _get_retrievers()

    # Retrieve a larger candidate pool with scores, then re-rank with MMR
    # (maximal marginal relevance) so the final top-4 aren't just
    # near-duplicates of each other — a plain top-k by similarity can
    # return four chunks that all say the same sentence.
    docs_and_scores = vector_store.similarity_search_with_score(question, k=8)

    # Strict Similarity Threshold Check (Hallucination Control) — if the
    # best match is too far (score too high), reject before ever calling
    # the LLM. Depending on your embedding model, adjust this threshold
    # (usually around 0.6 - 1.0).
    best_score = docs_and_scores[0][1] if docs_and_scores else 999
    if best_score > 1.2:
        return "shortcut", {
            "answer": "I'm Arch Assistant, Arcana Info's HR assistant. I'm not designed to help with that — I can answer questions about company policies, leave, benefits, and IT setup.",
            "source": "N/A",
        }

    reranked_docs = vector_store.max_marginal_relevance_search(question, k=4, fetch_k=8)

    # Hybrid search: fold in BM25 keyword hits that MMR didn't already
    # surface — catches exact terms/acronyms embeddings sometimes miss,
    # without letting keyword noise override the vector-based
    # hallucination gate above (that gate stays scored on vector search only).
    seen_content = {doc.page_content for doc in reranked_docs}
    combined_docs = list(reranked_docs)
    if bm25_retriever is not None:
        for doc in bm25_retriever.invoke(question):
            if doc.page_content not in seen_content:
                combined_docs.append(doc)
                seen_content.add(doc.page_content)

    # Build Context and Extract Source Name
    context_chunks = []
    sources = set()
    for doc in combined_docs:
        context_chunks.append(doc.page_content)
        source_name = doc.metadata.get("source", "Unknown Document")
        sources.add(os.path.basename(source_name))

    context = "\n\n---\n\n".join(context_chunks)
    source_string = ", ".join(sources)

    system_prompt = f"""You are Arch Assistant, Arcana Info's HR assistant.
Answer the employee's question strictly using the provided context below.

Rules:
1. If the answer cannot be directly derived from the context, respond with exactly: "I'm sorry, I cannot find this information in the uploaded HR documents." Do NOT make up any information.
2. Keep the answer professional, concise, and accurate.
{_build_history_block(chat_history)}
Context:
{context}

Question: {question}
Answer:"""

    return "generate", system_prompt, context, source_string, cache_key, use_cache


def _quota_or_error_message(e: Exception) -> str:
    error_text = str(e)
    if "RESOURCE_EXHAUSTED" in error_text or "429" in error_text:
        return "I'm getting a lot of questions right now and have hit today's usage limit. Please try again in a few minutes, or later today."
    return f"Error in processing your request: {error_text}"


# -----------------------------
# Generate Answer Function (non-streaming)
# -----------------------------
def generate_answer(question: str, chat_history: list[dict] | None = None) -> dict:
    """
    Loads FAISS index, searches for matching chunks,
    and answers using Gemini with hallucination controls.

    chat_history: optional list of {"role": "user"|"assistant", "content": str}
    from earlier in the same session (most-recent-last), so follow-up
    questions ("what about IT setup?") can be understood in context. Only
    used to *interpret* the question — the answer must still come from the
    retrieved document context, not from memory of the conversation.
    """
    try:
        kind, *rest = _prepare(question, chat_history)
        if kind == "shortcut":
            return rest[0]

        system_prompt, context, source_string, cache_key, use_cache = rest

        response = llm.invoke(system_prompt)
        answer_text = extract_answer_text(response.content)

        # If the LLM fell back to the "not found" response, don't attach a
        # source — showing "Source: X.pdf" under an answer that explicitly
        # says the info *isn't* in the documents is misleading.
        if "cannot find this information" in answer_text.lower():
            return {"answer": answer_text, "source": "N/A"}

        # Groundedness self-check — a cheap heuristic, not another LLM call:
        # if the answer barely overlaps with the retrieved context, the
        # model likely drifted despite retrieval finding decent chunks.
        # Skipped for non-English answers (Urdu script or Roman Urdu) —
        # see _is_non_english_answer's docstring: a correct translation
        # legitimately shares almost no words with the English source, so
        # the lexical check can't distinguish "drifted" from "translated"
        # and was confirmed rejecting real, correctly-grounded answers.
        if not _is_non_english_answer(answer_text) and _groundedness_ratio(answer_text, context) < 0.3:
            result = {
                "answer": "I'm sorry, I cannot find this information in the uploaded HR documents.",
                "source": "N/A",
            }
        else:
            result = {"answer": answer_text, "source": source_string}

        if use_cache:
            _answer_cache[cache_key] = result

        return result

    except Exception as e:
        return {"answer": _quota_or_error_message(e), "source": "System Error"}


# -----------------------------
# Generate Answer Function (streaming)
# -----------------------------
def stream_answer(question: str, chat_history: list[dict] | None = None):
    """
    Same retrieval/hallucination-control pipeline as generate_answer, but
    yields the answer as it's generated instead of waiting for the whole
    thing — for a ChatGPT-style token-by-token response.

    Yields dicts:
      {"type": "token", "content": "..."}         (repeated, in order)
      {"type": "done", "answer": full_text, "source": final_source}

    Known trade-off: the groundedness check can only run once the full
    answer is assembled, so unlike generate_answer it can no longer swap
    out a drifted answer for the safe fallback — the tokens are already on
    their way to the client. In that case this only drops the (likely
    wrong) source citation in the final "done" event; the primary
    hallucination gate (the similarity threshold, checked before any
    streaming starts) is unaffected by this trade-off.
    """
    try:
        kind, *rest = _prepare(question, chat_history)
        if kind == "shortcut":
            result = rest[0]
            yield {"type": "token", "content": result["answer"]}
            yield {"type": "done", "answer": result["answer"], "source": result["source"]}
            return

        system_prompt, context, source_string, cache_key, use_cache = rest

        answer_text = ""
        for chunk in llm.stream(system_prompt):
            delta = _extract_delta_text(chunk.content)
            if delta:
                answer_text += delta
                yield {"type": "token", "content": delta}
        answer_text = answer_text.strip()

        if "cannot find this information" in answer_text.lower():
            final_source = "N/A"
        elif not _is_non_english_answer(answer_text) and _groundedness_ratio(answer_text, context) < 0.3:
            final_source = "N/A"  # can't un-stream the text; at least don't cite a source for it
        else:
            final_source = source_string

        result = {"answer": answer_text, "source": final_source}
        if use_cache:
            _answer_cache[cache_key] = result

        yield {"type": "done", "answer": answer_text, "source": final_source}

    except Exception as e:
        message = _quota_or_error_message(e)
        yield {"type": "token", "content": message}
        yield {"type": "done", "answer": message, "source": "System Error"}