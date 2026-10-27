"""
embeddings.py
Converts chunks into vector embeddings and creates/updates a FAISS index on disk.

IMPORTANT: the embedding model here MUST exactly match the one used in
backend/rag_chain.py to embed the user's question at query time. If they
don't match, the vector spaces won't line up and similarity search will
return irrelevant chunks (or throw a dimension-mismatch error).

backend/rag_chain.py currently uses: models/gemini-embedding-001
(text-embedding-004 was shut down by Google on Jan 14, 2026)
-> so we use the exact same model here.
"""

import os
from dotenv import load_dotenv, find_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

load_dotenv(find_dotenv(usecwd=True))

GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
FAISS_INDEX_PATH = "faiss_index"

embedding_model = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",   # <-- must match rag_chain.py exactly
    google_api_key=GOOGLE_API_KEY
)


def create_or_update_index(chunks: list[dict]):
    """
    chunks: list of {"text": ..., "metadata": {...}} — this is the output of
    chunk_plain_text() / chunk_markdown_text() from chunking.py

    Creates a new FAISS index if one doesn't exist yet at FAISS_INDEX_PATH,
    otherwise loads the existing one and adds the new chunks to it — so
    uploading more documents later doesn't wipe out what's already indexed.
    """
    documents = [
        Document(page_content=chunk["text"], metadata=chunk["metadata"])
        for chunk in chunks
    ]

    if os.path.exists(FAISS_INDEX_PATH):
        vector_store = FAISS.load_local(
            FAISS_INDEX_PATH,
            embedding_model,
            allow_dangerous_deserialization=True
        )
        vector_store.add_documents(documents)
    else:
        vector_store = FAISS.from_documents(documents, embedding_model)

    vector_store.save_local(FAISS_INDEX_PATH)
    return vector_store


def delete_document_from_index(filename: str) -> int:
    """
    Removes every chunk whose metadata["source"] == filename from the
    FAISS index. Returns how many chunks were removed (0 if the index
    doesn't exist or the file has no chunks in it).

    NOTE: relies on langchain_community's FAISS wrapper internals
    (vector_store.docstore._dict) to find which chunk ids belong to this
    file — there's no public "delete by metadata filter" method as of
    this langchain-community version. If a future version changes this
    internal structure, this function will need updating.
    """
    if not os.path.exists(FAISS_INDEX_PATH):
        return 0

    vector_store = FAISS.load_local(
        FAISS_INDEX_PATH,
        embedding_model,
        allow_dangerous_deserialization=True
    )

    ids_to_delete = [
        doc_id for doc_id, doc in vector_store.docstore._dict.items()
        if doc.metadata.get("source") == filename
    ]

    if not ids_to_delete:
        return 0

    vector_store.delete(ids=ids_to_delete)
    vector_store.save_local(FAISS_INDEX_PATH)
    return len(ids_to_delete)


def count_total_chunks() -> int:
    """
    Total number of chunks currently in the FAISS index, across all
    documents — powers the Admin dashboard's "Chunks Indexed" stat.
    """
    if not os.path.exists(FAISS_INDEX_PATH):
        return 0

    vector_store = FAISS.load_local(
        FAISS_INDEX_PATH,
        embedding_model,
        allow_dangerous_deserialization=True
    )
    return len(vector_store.docstore._dict)