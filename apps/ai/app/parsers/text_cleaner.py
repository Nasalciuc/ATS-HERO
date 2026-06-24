"""Normalize extracted text: collapse intra-line whitespace, preserve paragraph breaks."""
import re

_MULTISPACE = re.compile(r"[ \t]+")
_MULTINEWLINE = re.compile(r"\n{3,}")


def clean_text(text: str) -> str:
    lines = [_MULTISPACE.sub(" ", ln).strip() for ln in text.splitlines()]
    joined = "\n".join(lines)
    return _MULTINEWLINE.sub("\n\n", joined).strip()
