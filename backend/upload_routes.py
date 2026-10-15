from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import shutil
import os
import sys
import json
from datetime import datetime, timezone

# chunking-embedding/ is a sibling folder to backend/, not a Python package
# (its name has a hyphen, which Python can't import as a package name) —
# so we add that folder directly to sys.path and import the individual
# files inside it by name instead.
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "chunking-embedding"))

from pdf_processor import extract_text_from_pdf
from markdown_processor import extract_text_from_markdown
from image_processor import extract_text_from_image
from chunking import chunk_plain_text, chunk_markdown_text
from embeddings import create_or_update_index, delete_document_from_index, count_total_chunks
from auth import require_role
from rag_chain import clear_rag_caches

router = APIRouter(tags=["Document Upload"])

UPLOAD_FOLDER = "uploads"
FAISS_INDEX_PATH = "faiss_index"
INDEXED_REGISTRY_PATH = "indexed_files.json"

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".md",
    ".png",
    ".jpg",
    ".jpeg"
}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def load_indexed_registry() -> dict:
    """
    Returns {filename: {"size_kb": ..., "uploaded_at": ..., "status": ...}}
    for every file already chunked + embedded into the FAISS index.
    """
    if os.path.exists(INDEXED_REGISTRY_PATH):
        with open(INDEXED_REGISTRY_PATH, "r") as f:
            data = json.load(f)

        # Backward-compat: an earlier version of this file stored a plain
        # list of filenames (no metadata). Migrate it to the new dict
        # format in place — the FAISS index itself isn't touched, so
        # nothing needs to be re-uploaded or re-embedded.
        if isinstance(data, list):
            data = {
                filename: {"size_kb": None, "uploaded_at": None, "status": "Indexed"}
                for filename in data
            }
            save_indexed_registry(data)

        return data
    return {}


def save_indexed_registry(indexed: dict) -> None:
    with open(INDEXED_REGISTRY_PATH, "w") as f:
        json.dump(indexed, f, indent=2)


@router.post("/upload-documents", dependencies=[Depends(require_role("hr"))])
async def upload_documents(
        files: list[UploadFile] = File(...)
):

    indexed_registry = load_indexed_registry()

    saved_files = []
    skipped_files = []
    all_chunks = []

    try:

        for file in files:

            extension = os.path.splitext(file.filename)[1].lower()

            if extension not in ALLOWED_EXTENSIONS:

                raise HTTPException(
                    status_code=400,
                    detail=f"{file.filename} is not supported."
                )

            # ---- skip files that are already indexed ----
            if file.filename in indexed_registry:
                skipped_files.append(file.filename)
                continue

            file_path = os.path.join(
                UPLOAD_FOLDER,
                file.filename
            )

            with open(file_path, "wb") as buffer:

                shutil.copyfileobj(
                    file.file,
                    buffer
                )

            saved_files.append(file.filename)

            # ---- extract raw text based on file type, then chunk it ----
            if extension == ".pdf":
                raw_text = extract_text_from_pdf(file_path)
                chunks = chunk_plain_text(raw_text, source_name=file.filename)

            elif extension == ".md":
                raw_text = extract_text_from_markdown(file_path)
                chunks = chunk_markdown_text(raw_text, source_name=file.filename)

            else:  # .png / .jpg / .jpeg
                raw_text = extract_text_from_image(file_path)
                chunks = chunk_plain_text(raw_text, source_name=file.filename)

            all_chunks.extend(chunks)

            # ---- record real metadata now that the file is fully processed ----
            size_kb = round(os.path.getsize(file_path) / 1024, 1)
            indexed_registry[file.filename] = {
                "size_kb": size_kb,
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                "status": "Indexed"
            }

        # ---- embed all new chunks and save/update the FAISS index ----
        if all_chunks:
            create_or_update_index(all_chunks)
            save_indexed_registry(indexed_registry)
            clear_rag_caches()  # cached retrievers/answers are stale now

        message = "Documents uploaded successfully."
        if skipped_files and not saved_files:
            message = "All selected files were already indexed — nothing new to process."
        elif skipped_files:
            message = f"Uploaded {len(saved_files)} new file(s); skipped {len(skipped_files)} already-indexed file(s)."

        return {

            "success": True,

            "message": message,

            "uploaded_files": saved_files,

            "skipped_files": skipped_files

        }

    except HTTPException:
        # re-raise as-is so a 400 (bad file type) doesn't get swallowed
        # and turned into a 500 by the except block below
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.delete("/reset-documents", dependencies=[Depends(require_role("hr"))])
async def reset_documents():
    """
    Clears all uploaded files, deletes the FAISS index, and clears the
    indexed-files registry, so the next upload starts from a clean slate.
    """
    try:
        if os.path.exists(UPLOAD_FOLDER):
            shutil.rmtree(UPLOAD_FOLDER)
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        if os.path.exists(FAISS_INDEX_PATH):
            shutil.rmtree(FAISS_INDEX_PATH)

        if os.path.exists(INDEXED_REGISTRY_PATH):
            os.remove(INDEXED_REGISTRY_PATH)

        clear_rag_caches()

        return {
            "success": True,
            "message": "All documents and the FAISS index have been cleared."
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/indexed-documents")
async def get_indexed_documents():
    """
    Returns the documents currently indexed in FAISS, with real metadata
    (size, upload time, status) — not just filenames.
    """
    try:
        registry = load_indexed_registry()
        # Newest upload first. A handful of older entries may have
        # uploaded_at=None (migrated from a pre-metadata registry format —
        # see load_indexed_registry's backward-compat note); those sort
        # last rather than crashing the comparison against real timestamps.
        sorted_items = sorted(
            registry.items(),
            key=lambda item: item[1].get("uploaded_at") or "",
            reverse=True,
        )
        indexed = [
            {
                "filename": filename,
                "size_kb": meta.get("size_kb"),
                "uploaded_at": meta.get("uploaded_at"),
                "status": meta.get("status", "Indexed"),
            }
            for filename, meta in sorted_items
        ]
        return {
            "success": True,
            "indexed_files": indexed,
            "count": len(indexed),
            "total_chunks": count_total_chunks()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.delete("/documents/{filename}", dependencies=[Depends(require_role("hr"))])
async def delete_document(filename: str):
    """
    Removes a single document: its chunks from the FAISS index, its
    entry in the registry, and the physical uploaded file (if still
    present). Requires HR role.
    """
    try:
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
            "message": f"{filename} removed ({removed_chunks} chunks)."
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )