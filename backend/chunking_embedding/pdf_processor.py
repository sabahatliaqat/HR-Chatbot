"""
pdf_processor.py
Extracts raw text from PDF files (loops through multiple PDFs if more than
one is uploaded).
"""

import pdfplumber


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extracts all text from a single PDF, page by page.
    """
    text_parts = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n\n".join(text_parts)


def extract_text_from_pdfs(file_paths: list[str]) -> dict:
    """
    Loops through multiple PDF files.
    Returns {filename: extracted_text} so each PDF's text stays traceable
    back to its own source file — this filename is what gets passed as
    source_name into chunking.py, and shows up in the /chat response's
    "source" field later.
    """
    results = {}
    for path in file_paths:
        filename = path.replace("\\", "/").split("/")[-1]
        results[filename] = extract_text_from_pdf(path)
    return results