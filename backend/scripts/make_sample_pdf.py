"""Generate a sample quiz PDF you can upload to test extraction.

Usage::

    pip install reportlab
    python scripts/make_sample_pdf.py

Creates ``sample_quiz.pdf`` in the current directory.
"""

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

LINES = [
    "General Knowledge Quiz",
    "",
    "1. What is the capital of France?",
    "A) Paris",
    "B) London",
    "C) Berlin",
    "D) Madrid",
    "Answer: A",
    "",
    "2. Which planet is known as the Red Planet?",
    "A) Venus",
    "B) Mars",
    "C) Jupiter",
    "D) Saturn",
    "Answer: B",
    "",
    "3. 7 + 5 = ?",
    "A) 10",
    "B) 11",
    "C) 12",
    "D) 13",
    "Ans: C",
    "",
    "4. Who wrote 'Romeo and Juliet'?",
    "A) Charles Dickens",
    "B) Mark Twain",
    "C) William Shakespeare",
    "D) Leo Tolstoy",
    "Correct: C",
    "",
    "5. What is the largest ocean on Earth?",
    "A) Atlantic Ocean",
    "B) Indian Ocean",
    "C) Arctic Ocean",
    "D) Pacific Ocean",
    "Answer: D",
]


def main() -> None:
    c = canvas.Canvas("sample_quiz.pdf", pagesize=A4)
    width, height = A4
    y = height - 60
    c.setFont("Helvetica", 12)
    for line in LINES:
        c.drawString(60, y, line)
        y -= 20
        if y < 60:
            c.showPage()
            c.setFont("Helvetica", 12)
            y = height - 60
    c.save()
    print("Wrote sample_quiz.pdf")


if __name__ == "__main__":
    main()
