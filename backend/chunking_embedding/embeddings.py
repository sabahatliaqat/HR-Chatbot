import os
import uuid

from dotenv import load_dotenv, find_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from pinecone import Pinecone


load_dotenv(find_dotenv(usecwd=True), override=True)

GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")


if not GOOGLE_API_KEY:
    raise ValueError(
        "GEMINI_API_KEY is missing from the backend .env file."
    )

if not PINECONE_API_KEY:
    raise ValueError(
        "PINECONE_API_KEY is missing from the backend .env file."
    )

if not PINECONE_INDEX_NAME:
    raise ValueError(
        "PINECONE_INDEX_NAME is missing from the backend .env file."
    )


embedding_model = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    google_api_key=GOOGLE_API_KEY
)


pinecone_client = Pinecone(
    api_key=PINECONE_API_KEY
)

pinecone_index = pinecone_client.Index(
    PINECONE_INDEX_NAME
)


def create_or_update_index(chunks: list[dict]) -> int:
    """
    Creates Gemini embeddings for document chunks and stores them in Pinecone.

    Each chunk must contain:
    {
        "text": "chunk text",
        "metadata": {"source": "filename.pdf"}
    }

    Replaces existing vectors belonging to the same document.
    Returns the number of uploaded chunks.
    """

    if not chunks:
        return 0

    texts = [
        chunk["text"]
        for chunk in chunks
    ]

    embeddings = embedding_model.embed_documents(texts)

    vectors = []

    for chunk, embedding in zip(chunks, embeddings):

        metadata = {
            "text": chunk["text"]
        }

        for key, value in chunk.get("metadata", {}).items():

            if value is None:
                continue

            if isinstance(value, (str, int, float, bool)):
                metadata[key] = value

            elif isinstance(value, list) and all(
                isinstance(item, str) for item in value
            ):
                metadata[key] = value

            else:
                metadata[key] = str(value)

        vectors.append({
            "id": str(uuid.uuid4()),
            "values": embedding,
            "metadata": metadata
        })

    source_filename = (
        chunks[0].get("metadata", {}).get("source")
    )

    if source_filename:
        pinecone_index.delete(
            filter={
                "source": {
                    "$eq": source_filename
                }
            }
        )

    for start in range(0, len(vectors), 100):

        batch = vectors[start:start + 100]

        pinecone_index.upsert(
            vectors=batch
        )

    return len(vectors)


def delete_document_from_index(filename: str) -> int:
    """
    Deletes all Pinecone vectors belonging to a document.
    Returns the actual number of matching vectors before deletion.
    """

    if not filename:
        return 0

    document_filter = {
        "source": {
            "$eq": filename
        }
    }

    stats = pinecone_index.describe_index_stats(
        filter=document_filter
    )

    matching_count = stats.total_vector_count or 0

    if matching_count == 0:
        return 0

    pinecone_index.delete(
        filter=document_filter
    )

    return matching_count


def count_total_chunks() -> int:
    """
    Returns the total number of vectors stored in Pinecone.
    """

    stats = pinecone_index.describe_index_stats()

    return stats.total_vector_count or 0
