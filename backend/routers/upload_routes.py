from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import shutil
import os
import sys
import json
from datetime import datetime, timezone

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHUNKING_DIR = os.path.join(BACKEND_DIR, "chunking_embedding")

if CHUNKING_DIR not in sys.path:
    sys.path.insert(0, CHUNKING_DIR)

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from pdf_processor import extract_text_from_pdf
from markdown_processor import extract_text_from_markdown
from image_processor import extract_text_from_image
from chunking import chunk_plain_text, chunk_markdown_text
from embeddings import create_or_update_index, delete_document_from_index, count_total_chunks
from auth import require_role
from rag_chain import clear_rag_caches

router = APIRouter(tags=["Document Upload"])

UPLOAD_FOLDER = os.path.join(BACKEND_DIR, "uploads")
FAISS_INDEX_PATH = os.path.join(BACKEND_DIR, "faiss_index")
INDEXED_REGISTRY_PATH = os.path.join(BACKEND_DIR, "indexed_files.json")

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".md",
    ".png",
    ".jpg",
    ".jpeg"
}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)