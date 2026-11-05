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

from embeddings import (
    create_or_update_index,
    delete_document_from_index,
    count_total_chunks,
    pinecone_index
)

from auth import require_role
from rag_chain import clear_rag_caches

router = APIRouter(tags=["Document Upload"])

UPLOAD_FOLDER = os.path.join(BACKEND_DIR, "uploads")
INDEXED_REGISTRY_PATH = os.path.join(BACKEND_DIR, "indexed_files.json")

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".md",
    ".png",
    ".jpg",
    ".jpeg"
}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def load_indexed_registry() -> dict:
    if os.path.exists(INDEXED_REGISTRY_PATH):
        with open(INDEXED_REGISTRY_PATH, "r", encoding="utf-8") as file:
            data = json.load(file)

        if isinstance(data, list):
            data = {
                filename: {
                    "size_kb": None,
                    "uploaded_at": None,
                    "status": "Indexed"
                }
                for filename in data
            }
            save_indexed_registry(data)

        return data

    return {}


def save_indexed_registry(indexed: dict) -> None:
    temporary_path = INDEXED_REGISTRY_PATH + ".tmp"

    with open(temporary_path, "w", encoding="utf-8") as file:
        json.dump(indexed, file, indent=2)

    os.replace(temporary_path, INDEXED_REGISTRY_PATH)


def extract_and_chunk(file_path: str, filename: str, extension: str):
    if extension == ".pdf":
        raw_text = extract_text_from_pdf(file_path)
        chunks = chunk_plain_text(raw_text, source_name=filename)

    elif extension == ".md":
        raw_text = extract_text_from_markdown(file_path)
        chunks = chunk_markdown_text(raw_text, source_name=filename)

    else:
        raw_text = extract_text_from_image(file_path)
        chunks = chunk_plain_text(raw_text, source_name=filename)

    return chunks


@router.post(
    "/upload-documents",
    dependencies=[Depends(require_role("hr"))]
)
async def upload_documents(files: list[UploadFile] = File(...)):

    indexed_registry = load_indexed_registry()

    saved_files = []
    skipped_files = []
    failed_files = []

    try:
        for file in files:

            original_filename = file.filename or ""

            filename = os.path.basename(
                original_filename.replace("\\", "/")
            )

            if not filename or filename != original_filename.replace("\\", "/"):
                failed_files.append({
                    "filename": original_filename,
                    "error": "Invalid filename."
                })
                continue

            extension = os.path.splitext(filename)[1].lower()

            if extension not in ALLOWED_EXTENSIONS:
                failed_files.append({
                    "filename": filename,
                    "error": "File type is not supported."
                })
                continue

            if filename in indexed_registry:
                skipped_files.append(filename)
                continue

            file_path = os.path.join(UPLOAD_FOLDER, filename)

            try:
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)

                chunks = extract_and_chunk(
                    file_path,
                    filename,
                    extension
                )

                if not chunks:
                    raise ValueError(
                        "No readable text or chunks were extracted from this file."
                    )

                uploaded_chunks = create_or_update_index(chunks)

                if uploaded_chunks == 0:
                    raise ValueError(
                        "No vectors were uploaded to Pinecone."
                    )

                size_kb = round(
                    os.path.getsize(file_path) / 1024,
                    1
                )

                indexed_registry[filename] = {
                    "size_kb": size_kb,
                    "uploaded_at": datetime.now(
                        timezone.utc
                    ).isoformat(),
                    "status": "Indexed"
                }

                save_indexed_registry(indexed_registry)

                saved_files.append({
                    "filename": filename,
                    "chunks": uploaded_chunks
                })

            except Exception as file_error:

                if os.path.exists(file_path):
                    os.remove(file_path)

                failed_files.append({
                    "filename": filename,
                    "error": str(file_error)
                })

            finally:
                await file.close()

        if saved_files:
            clear_rag_caches()

        if saved_files and not failed_files and not skipped_files:
            message = "Documents uploaded and indexed successfully."

        elif skipped_files and not saved_files and not failed_files:
            message = "All selected files were already indexed."

        else:
            message = "Document upload process completed."

        return {
            "success": len(saved_files) > 0 or (
                len(skipped_files) > 0 and len(failed_files) == 0
            ),
            "message": message,
            "uploaded_files": saved_files,
            "skipped_files": skipped_files,
            "failed_files": failed_files,
            "total_chunks": count_total_chunks()
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


@router.delete(
    "/reset-documents",
    dependencies=[Depends(require_role("hr"))]
)
async def reset_documents():

    try:
        pinecone_index.delete(delete_all=True)

        if os.path.exists(UPLOAD_FOLDER):
            shutil.rmtree(UPLOAD_FOLDER)

        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        if os.path.exists(INDEXED_REGISTRY_PATH):
            os.remove(INDEXED_REGISTRY_PATH)

        clear_rag_caches()

        return {
            "success": True,
            "message": "All uploaded documents and Pinecone vectors have been cleared.",
            "total_chunks": count_total_chunks()
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


@router.get("/indexed-documents")
async def get_indexed_documents():

    try:
        registry = load_indexed_registry()

        sorted_items = sorted(
            registry.items(),
            key=lambda item: item[1].get("uploaded_at") or "",
            reverse=True
        )

        indexed = [
            {
                "filename": filename,
                "size_kb": metadata.get("size_kb"),
                "uploaded_at": metadata.get("uploaded_at"),
                "status": metadata.get("status", "Indexed")
            }
            for filename, metadata in sorted_items
        ]

        return {
            "success": True,
            "indexed_files": indexed,
            "count": len(indexed),
            "total_chunks": count_total_chunks()
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


@router.delete(
    "/documents/{filename}",
    dependencies=[Depends(require_role("hr"))]
)
async def delete_document(filename: str):

    try:
        filename = os.path.basename(
            filename.replace("\\", "/")
        )

        registry = load_indexed_registry()

        if filename not in registry:
            raise HTTPException(
                status_code=404,
                detail=f"{filename} is not currently indexed."
            )

        removed_chunks = delete_document_from_index(filename)

        file_path = os.path.join(UPLOAD_FOLDER, filename)

        if os.path.exists(file_path):
            os.remove(file_path)

        del registry[filename]

        save_indexed_registry(registry)

        clear_rag_caches()

        return {
            "success": True,
            "message": f"{filename} has been removed.",
            "removed_chunks": removed_chunks,
            "total_chunks": count_total_chunks()
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )