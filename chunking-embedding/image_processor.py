r"""
image_processor.py
Extracts text from images (JPG/PNG) using OCR (pytesseract).

Setup note: pytesseract is just a Python wrapper — it needs the actual
Tesseract OCR engine installed separately on your machine (it's not a pip
package). On Windows, install it from:
https://github.com/UB-Mannheim/tesseract/wiki
and either add it to your PATH, or point to it directly:

    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
"""

from PIL import Image, ImageOps
import numpy as np
import pytesseract

# Uncomment and set this if Tesseract isn't on your PATH:

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Tesseract is tuned for dark text on light backgrounds at a decent
# resolution. Upload screenshots routinely violate both: dark-mode UIs
# (light text on dark) and small/cropped images. Confirmed by testing —
# an unprocessed dark-background UI mockup produced garbled output like
# "BD ARCANA HR AS" and dropped several text fields entirely.
MIN_DIMENSION = 1200
TESSERACT_CONFIG = "--oem 3 --psm 6"


def _preprocess(image: Image.Image) -> Image.Image:
    gray = ImageOps.grayscale(image)

    # A dark-background image reads as near-black on average; invert it
    # to dark-text-on-light, which is what Tesseract expects.
    if np.array(gray).mean() < 128:
        gray = ImageOps.invert(gray)

    gray = ImageOps.autocontrast(gray)

    if max(gray.size) < MIN_DIMENSION:
        scale = MIN_DIMENSION / max(gray.size)
        new_size = (round(gray.width * scale), round(gray.height * scale))
        gray = gray.resize(new_size, Image.LANCZOS)

    return gray


def extract_text_from_image(file_path: str) -> str:
    image = Image.open(file_path)
    processed = _preprocess(image)
    text = pytesseract.image_to_string(processed, config=TESSERACT_CONFIG)
    return text.strip()


def extract_text_from_images(file_paths: list[str]) -> dict:
    """
    Loops through multiple image files.
    Returns {filename: extracted_text}.
    """
    results = {}
    for path in file_paths:
        filename = path.replace("\\", "/").split("/")[-1]
        results[filename] = extract_text_from_image(path)
    return results