"""
markdown_processor.py
Reads and returns the raw text of a .md file.

Note: cleaning is kept minimal on purpose — the #, ##, ### heading markers
must stay intact, because chunking.py's MarkdownHeaderTextSplitter relies on
them to split by section.
"""


def extract_text_from_markdown(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def extract_text_from_markdown_files(file_paths: list[str]) -> dict:
    """
    Loops through multiple .md files.
    Returns {filename: raw_text}.
    """
    results = {}
    for path in file_paths:
        filename = path.replace("\\", "/").split("/")[-1]
        results[filename] = extract_text_from_markdown(path)
    return results