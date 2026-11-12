
from chunking_embedding.chunking import (
    chunk_plain_text,
    chunk_markdown_text,
)


def test_plain_text_chunking_returns_documents():
    text = (
        "This is a company HR policy document. "
        "Employees must follow company policies. "
    ) * 100

    chunks = chunk_plain_text(text, "test_policy.txt")

    assert len(chunks) > 0

    for chunk in chunks:
        assert isinstance(chunk, dict)
        assert "text" in chunk
        assert "metadata" in chunk
        assert chunk["text"].strip()
        assert chunk["metadata"]["source"] == "test_policy.txt"


def test_markdown_chunking_returns_documents():
    markdown = """
# Leave Policy

Employees can apply for annual leave.

## Annual Leave

Employees should submit leave requests in advance.

## Sick Leave

Employees must inform their manager when taking sick leave.
"""

    chunks = chunk_markdown_text(markdown, "test_policy.md")

    assert len(chunks) > 0

    for chunk in chunks:
        assert isinstance(chunk, dict)
        assert "text" in chunk
        assert "metadata" in chunk
        assert chunk["text"].strip()
        assert chunk["metadata"]["source"] == "test_policy.md"

    assert any(
        chunk["metadata"].get("h1") == "Leave Policy"
        for chunk in chunks
    )


def test_plain_text_chunking_preserves_content():
    text = "Employees must follow the company HR policy."

    chunks = chunk_plain_text(text, "hr_policy.txt")

    combined_text = " ".join(
        chunk["text"] for chunk in chunks
    )

    assert "Employees" in combined_text
    assert "company HR policy" in combined_text
