import os
import time

from dotenv import load_dotenv
from pinecone import Pinecone
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings

load_dotenv(override=True)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not PINECONE_API_KEY or not PINECONE_INDEX_NAME:
    raise ValueError("Pinecone configuration is missing.")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is missing.")

embedding_model = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    google_api_key=GEMINI_API_KEY
)

vector_store = FAISS.load_local(
    "faiss_index",
    embedding_model,
    allow_dangerous_deserialization=True
)

pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)

stats = index.describe_index_stats()

if stats.dimension != vector_store.index.d:
    raise ValueError("FAISS and Pinecone dimensions do not match.")

vectors = []

for faiss_id, doc_id in vector_store.index_to_docstore_id.items():
    document = vector_store.docstore._dict[doc_id]
    embedding = vector_store.index.reconstruct(int(faiss_id))

    metadata = {"text": document.page_content}

    for key, value in document.metadata.items():
        if value is None:
            continue
        if isinstance(value, (str, int, float, bool)):
            metadata[key] = value
        elif isinstance(value, list) and all(isinstance(x, str) for x in value):
            metadata[key] = value
        else:
            metadata[key] = str(value)

    vectors.append({
        "id": doc_id,
        "values": embedding.tolist(),
        "metadata": metadata
    })

print("Vectors prepared:", len(vectors))

for start in range(0, len(vectors), 100):
    batch = vectors[start:start + 100]
    index.upsert(vectors=batch)
    print("Uploaded batch:", len(batch))

time.sleep(5)

final_stats = index.describe_index_stats()

print("Migration completed.")
print("FAISS vectors:", len(vectors))
print("Pinecone vectors:", final_stats.total_vector_count)
print("Pinecone dimension:", final_stats.dimension)