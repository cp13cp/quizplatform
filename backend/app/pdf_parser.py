"""Extract quiz questions from an uploaded PDF.

Expected PDF text format (flexible — see regexes below)::

    1. What is the capital of France?
    A) Paris
    B) London
    C) Berlin
    D) Madrid
    Answer: A

    2) 2 + 2 = ?
    a. 3
    b. 4
    c. 5
    Ans: b

Rules
-----
* A question begins with a number followed by ``.`` or ``)`` e.g. ``1.`` or ``12)``.
* Options begin with a letter A-H followed by ``.`` ``)`` or the letter in
  parentheses e.g. ``A)`` ``b.`` ``(C)``.
* An optional answer line ``Answer:`` / ``Ans:`` / ``Correct:`` marks the right
  option by its letter (A/B/C...) or by 1-based number.
* If no answer line is present the question is still imported with
  ``correct_index = -1`` (admin can fix it later, still scorable once set).
"""

from __future__ import annotations

import io
import re

import pdfplumber

_Q_RE = re.compile(r"^\s*(\d+)\s*[.)]\s*(.+)$")
_OPT_RE = re.compile(r"^\s*\(?([A-Ha-h])\)?[.)]\s*(.+)$")
_ANS_RE = re.compile(r"^\s*(?:answer|ans|correct)\s*[:\-]?\s*(.+)$", re.IGNORECASE)


def _extract_text(file_bytes: bytes) -> str:
    parts: list[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            parts.append(text)
    return "\n".join(parts)


def _letter_to_index(token: str) -> int:
    """Convert an answer token (letter or number) to a 0-based option index."""
    token = token.strip()
    if not token:
        return -1
    first = token[0]
    if first.isalpha():
        return ord(first.upper()) - ord("A")
    if first.isdigit():
        return int(re.match(r"\d+", token).group()) - 1
    return -1


def parse_quiz_from_pdf(file_bytes: bytes) -> list[dict]:
    """Return a list of question dicts: {text, options, correct_index}."""
    text = _extract_text(file_bytes)
    lines = [ln.rstrip() for ln in text.splitlines()]

    questions: list[dict] = []
    current: dict | None = None

    def flush() -> None:
        nonlocal current
        if current and current["text"] and len(current["options"]) >= 2:
            questions.append(current)
        current = None

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        ans_match = _ANS_RE.match(line)
        opt_match = _OPT_RE.match(line)
        q_match = _Q_RE.match(line)

        # Answer line only counts when we already have a question with options.
        if ans_match and current and current["options"]:
            idx = _letter_to_index(ans_match.group(1))
            if 0 <= idx < len(current["options"]):
                current["correct_index"] = idx
            continue

        if q_match:
            flush()
            current = {
                "text": q_match.group(2).strip(),
                "options": [],
                "correct_index": -1,
            }
            continue

        if opt_match and current is not None:
            current["options"].append(opt_match.group(2).strip())
            continue

        # Continuation of a question stem that wrapped to a new line.
        if current is not None and not current["options"]:
            current["text"] += " " + line

    flush()
    return questions
