
import os
import json
import re
import sys
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.documents import Document

load_dotenv()

# -----------------------------
# API KEY & CONFIG
# -----------------------------
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
INDEXED_REGISTRY_PATH = "indexed_files.json"
PINECONE_MIN_SCORE = float(os.getenv("PINECONE_MIN_SCORE", "0.35"))
PINECONE_TOP_K = 8
FINAL_CONTEXT_CHUNKS = 4

if not GOOGLE_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

# Import the same Gemini embedding model and Pinecone index
# initialized in chunking_embedding/embeddings.py.
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
CHUNKING_DIR = os.path.join(BACKEND_DIR, "chunking_embedding")

if CHUNKING_DIR not in sys.path:
    sys.path.insert(0, CHUNKING_DIR)

from embeddings import embedding_model, pinecone_index


def list_available_documents() -> list:
    """
    Reads indexed_files.json directly so document-list questions
    are answered from the actual upload registry.
    """
    if not os.path.exists(INDEXED_REGISTRY_PATH):
        return []

    with open(INDEXED_REGISTRY_PATH, "r", encoding="utf-8") as f:
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
    q = question.lower()
    return any(kw in q for kw in META_QUESTION_KEYWORDS)


def _extract_delta_text(content) -> str:
    """
    Extracts actual text from Gemini response content,
    including streamed response blocks.
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
    return _extract_delta_text(content).strip()


# -----------------------------
# INITIALIZE GEMINI
# -----------------------------
llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash",
    google_api_key=GOOGLE_API_KEY,
    temperature=0.2,
    thinking_budget=0,
)


# -----------------------------
# PINECONE RETRIEVER CACHE
# -----------------------------
_retriever_cache = {"pinecone_index": None}
_answer_cache: dict = {}


def clear_rag_caches():
    """
    Clears cached answers and retriever state after document
    upload, deletion, or reset.
    """
    _retriever_cache["pinecone_index"] = None
    _answer_cache.clear()


def _get_retrievers():
    """
    Returns the configured Pinecone index.
    The index connection is initialized in embeddings.py.
    """
    if _retriever_cache["pinecone_index"] is None:
        _retriever_cache["pinecone_index"] = pinecone_index

    return _retriever_cache["pinecone_index"]


def _normalize_question(question: str) -> str:
    return re.sub(r"\s+", " ", question.strip().lower()).rstrip("?.! ")


# -----------------------------
# CONTEXT DEPENDENCY DETECTION
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

    if any(
        q.startswith(p) or f" {p} " in f" {q} "
        for p in _CONTEXT_DEPENDENCY_PHRASES
    ):
        return True

    words = re.findall(r"[a-z']+", q)

    return any(w in _CONTEXT_DEPENDENCY_WORDS for w in words)


# -----------------------------
# GROUNDEDNESS CHECK
# -----------------------------
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
    answer_words = _content_words(answer)

    if not answer_words:
        return 1.0

    context_words = _content_words(context)

    return len(answer_words & context_words) / len(answer_words)


# -----------------------------
# URDU / ROMAN URDU DETECTION
# -----------------------------
_ARABIC_SCRIPT_RE = re.compile(r"[\u0600-\u06FF]")

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

    marker_hits = sum(
        1 for word in words if word in _ROMAN_URDU_MARKERS
    )

    return marker_hits / len(words) > 0.15


# -----------------------------
# CHAT HISTORY
# -----------------------------
def _build_history_block(chat_history: list[dict] | None) -> str:
    if not chat_history:
        return ""

    recent = chat_history[-6:]

    transcript = "\n".join(
        f"{turn['role'].capitalize()}: {turn['content']}"
        for turn in recent
    )

    return f"""
Recent conversation (for context only — do NOT treat this as source material,
only use it to understand what "it"/"that"/a follow-up question refers to):
{transcript}
"""


# -----------------------------
# PINECONE DOCUMENT RETRIEVAL
# -----------------------------
def _retrieve_documents(question: str) -> tuple[list[Document], float]:
    """
    Embeds the question using the same Gemini model used during
    document upload and retrieves matching chunks from Pinecone.

    Pinecone metadata contains:
        text: original chunk text
        source: original document filename
    """

    query_embedding = embedding_model.embed_query(question)

    index = _get_retrievers()

    response = index.query(
        vector=query_embedding,
        top_k=PINECONE_TOP_K,
        include_metadata=True,
    )

    matches = response.matches or []

    documents = []
    seen_content = set()
    best_score = 0.0

    for match in matches:
        metadata = match.metadata or {}
        text = metadata.get("text", "")

        if not text or text in seen_content:
            continue

        seen_content.add(text)

        score = float(match.score or 0.0)
        best_score = max(best_score, score)

        document_metadata = {
            key: value
            for key, value in metadata.items()
            if key != "text"
        }

        documents.append(
            Document(
                page_content=text,
                metadata=document_metadata,
            )
        )

    return documents[:FINAL_CONTEXT_CHUNKS], best_score


# -----------------------------
# SHARED RETRIEVAL / PREPARATION
# -----------------------------
def _prepare(question: str, chat_history: list[dict] | None):
    """
    Returns shortcut results or prepares the Gemini prompt
    using documents retrieved from Pinecone.
    """

    # Handle document-list questions directly.
    if is_meta_document_question(question):
        docs = list_available_documents()

        if not docs:
            return "shortcut", {
                "answer": "I don't have any documents uploaded yet.",
                "source": "No documents uploaded",
            }

        return "shortcut", {
            "answer": f"I currently have access to: {', '.join(docs)}.",
            "source": "N/A",
        }

    # Check whether any documents are registered.
    available_docs = list_available_documents()

    if not available_docs:
        return "shortcut", {
            "answer": "Hello! I don't have access to any HR documents yet. Please upload policy documents first.",
            "source": "No documents uploaded",
        }

    # Answer cache.
    cache_key = _normalize_question(question)

    if cache_key in _answer_cache:
        return "shortcut", _answer_cache[cache_key]

    use_cache = not _is_context_dependent_question(question)

    # Retrieve from Pinecone.
    retrieved_docs, best_score = _retrieve_documents(question)

    # Pinecone cosine similarity: higher scores indicate more similar
    # results. This threshold is configurable in the backend .env.
    if not retrieved_docs or best_score < PINECONE_MIN_SCORE:
        return "shortcut", {
            "answer": "I'm Arch Assistant, Arcana Info's HR assistant. I'm not designed to help with that — I can answer questions about company policies, leave, benefits, and IT setup.",
            "source": "N/A",
        }

    # Build context and extract source names.
    context_chunks = []
    sources = set()

    for doc in retrieved_docs:
        context_chunks.append(doc.page_content)

        source_name = doc.metadata.get(
            "source",
            "Unknown Document"
        )

        sources.add(os.path.basename(source_name))

    context = "\n\n---\n\n".join(context_chunks)
    source_string = ", ".join(sorted(sources))

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

    return (
        "generate",
        system_prompt,
        context,
        source_string,
        cache_key,
        use_cache,
    )


# -----------------------------
# ERROR HANDLING
# -----------------------------
def _quota_or_error_message(e: Exception) -> str:
    error_text = str(e)

    if "RESOURCE_EXHAUSTED" in error_text or "429" in error_text:
        return "I'm getting a lot of questions right now and have hit today's usage limit. Please try again in a few minutes, or later today."

    return f"Error in processing your request: {error_text}"


# -----------------------------
# GENERATE ANSWER FUNCTION
# NON-STREAMING
# -----------------------------
def generate_answer(
    question: str,
    chat_history: list[dict] | None = None
) -> dict:
    """
    Retrieves matching HR chunks from Pinecone and generates
    an answer using Gemini with hallucination controls.
    """

    try:
        kind, *rest = _prepare(question, chat_history)

        if kind == "shortcut":
            return rest[0]

        system_prompt, context, source_string, cache_key, use_cache = rest

        response = llm.invoke(system_prompt)

        answer_text = extract_answer_text(response.content)

        if "cannot find this information" in answer_text.lower():
            return {
                "answer": answer_text,
                "source": "N/A",
            }

        if (
            not _is_non_english_answer(answer_text)
            and _groundedness_ratio(answer_text, context) < 0.3
        ):
            result = {
                "answer": "I'm sorry, I cannot find this information in the uploaded HR documents.",
                "source": "N/A",
            }
        else:
            result = {
                "answer": answer_text,
                "source": source_string,
            }

        if use_cache:
            _answer_cache[cache_key] = result

        return result

    except Exception as e:
        return {
            "answer": _quota_or_error_message(e),
            "source": "System Error",
        }


# -----------------------------
# GENERATE ANSWER FUNCTION
# STREAMING
# -----------------------------
def stream_answer(
    question: str,
    chat_history: list[dict] | None = None
):
    """
    Retrieves matching HR chunks from Pinecone and streams
    the Gemini response token by token.
    """

    try:
        kind, *rest = _prepare(question, chat_history)

        if kind == "shortcut":
            result = rest[0]

            yield {
                "type": "token",
                "content": result["answer"],
            }

            yield {
                "type": "done",
                "answer": result["answer"],
                "source": result["source"],
            }

            return

        system_prompt, context, source_string, cache_key, use_cache = rest

        answer_text = ""

        for chunk in llm.stream(system_prompt):
            delta = _extract_delta_text(chunk.content)

            if delta:
                answer_text += delta

                yield {
                    "type": "token",
                    "content": delta,
                }

        answer_text = answer_text.strip()

        if "cannot find this information" in answer_text.lower():
            final_source = "N/A"

        elif (
            not _is_non_english_answer(answer_text)
            and _groundedness_ratio(answer_text, context) < 0.3
        ):
            final_source = "N/A"

        else:
            final_source = source_string

        result = {
            "answer": answer_text,
            "source": final_source,
        }

        if use_cache:
            _answer_cache[cache_key] = result

        yield {
            "type": "done",
            "answer": answer_text,
            "source": final_source,
        }

    except Exception as e:
        message = _quota_or_error_message(e)

        yield {
            "type": "token",
            "content": message,
        }

        yield {
            "type": "done",
            "answer": message,
            "source": "System Error",
        }
