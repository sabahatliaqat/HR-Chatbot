"""
chunking.py
Splits extracted text into chunks ready for embedding.

Two strategies:
- PDF / image (OCR) text -> RecursiveCharacterTextSplitter
  (no headings to rely on, so split by paragraph/character count)
- Markdown text -> MarkdownHeaderTextSplitter first (keeps each chunk tied to
  its section), then RecursiveCharacterTextSplitter on any section that's
  still too big
"""

from langchain_text_splitters import RecursiveCharacterTextSplitter, MarkdownHeaderTextSplitter

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150


def chunk_plain_text(text: str, source_name: str) -> list[dict]:
    """
    For PDF and OCR/image text.
    Returns a list of {"text": ..., "metadata": {"source": ...}} dicts.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        # try to break on paragraph/sentence boundaries first, fall back to raw characters
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    chunks = splitter.split_text(text)
    return [{"text": c, "metadata": {"source": source_name}} for c in chunks]


def chunk_markdown_text(text: str, source_name: str) -> list[dict]:
    """
    For .md files. Splits by heading first so each chunk keeps its section
    context, then re-splits any oversized section with the character splitter.
    """
    headers_to_split_on = [
        ("#", "h1"),
        ("##", "h2"),
        ("###", "h3"),
    ]
    md_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
    header_chunks = md_splitter.split_text(text)

    char_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP
    )

    final_chunks = []
    for doc in header_chunks:
        # doc.page_content = section text, doc.metadata = heading trail (h1/h2/h3)
        sub_chunks = char_splitter.split_text(doc.page_content)
        for sub in sub_chunks:
            metadata = dict(doc.metadata)
            metadata["source"] = source_name
            final_chunks.append({"text": sub, "metadata": metadata})

    return final_chunks