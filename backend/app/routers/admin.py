from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..database import get_db
from ..models import (
    AnswerReview,
    AttemptResult,
    AttemptSummary,
    Question,
    QuizAdminDetail,
    QuizSummary,
    QuizUpdate,
)
from ..pdf_parser import parse_quiz_from_pdf
from ..security import require_admin
from .quizzes import quiz_summary

router = APIRouter(prefix="/admin", tags=["admin"])


async def _get_quiz(quiz_id: str) -> dict:
    db = get_db()
    try:
        oid = ObjectId(quiz_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Quiz not found")
    quiz = await db.quizzes.find_one({"_id": oid})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


def _admin_detail(quiz: dict) -> QuizAdminDetail:
    base = quiz_summary(quiz).model_dump()
    base["questions"] = [Question(**q) for q in quiz.get("questions", [])]
    return QuizAdminDetail(**base)


@router.post("/quizzes/upload", response_model=QuizAdminDetail)
async def upload_quiz_pdf(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    time_limit_seconds: int = Form(0),
    admin: dict = Depends(require_admin),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file")

    content = await file.read()
    try:
        questions = parse_quiz_from_pdf(content)
    except Exception as exc:  # pragma: no cover - surfaced to admin
        raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {exc}")

    if not questions:
        raise HTTPException(
            status_code=422,
            detail="No questions found. Check the PDF format (see README).",
        )

    db = get_db()
    doc = {
        "title": title,
        "description": description,
        "time_limit_seconds": max(0, time_limit_seconds),
        "questions": questions,
        "is_published": False,
        "created_by": admin["_id"],
        "created_at": datetime.now(timezone.utc),
        "source_filename": file.filename,
    }
    result = await db.quizzes.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _admin_detail(doc)


@router.get("/quizzes", response_model=list[QuizSummary])
async def list_all_quizzes(admin: dict = Depends(require_admin)):
    db = get_db()
    cursor = db.quizzes.find().sort("created_at", -1)
    return [quiz_summary(q) async for q in cursor]


@router.get("/quizzes/{quiz_id}", response_model=QuizAdminDetail)
async def get_quiz_detail(quiz_id: str, admin: dict = Depends(require_admin)):
    quiz = await _get_quiz(quiz_id)
    return _admin_detail(quiz)


@router.patch("/quizzes/{quiz_id}", response_model=QuizAdminDetail)
async def update_quiz(
    quiz_id: str, payload: QuizUpdate, admin: dict = Depends(require_admin)
):
    db = get_db()
    quiz = await _get_quiz(quiz_id)
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if update:
        await db.quizzes.update_one({"_id": quiz["_id"]}, {"$set": update})
        quiz = await _get_quiz(quiz_id)
    return _admin_detail(quiz)


@router.put("/quizzes/{quiz_id}/questions", response_model=QuizAdminDetail)
async def replace_questions(
    quiz_id: str, questions: list[Question], admin: dict = Depends(require_admin)
):
    """Let the admin fix parsed questions / set correct answers."""
    db = get_db()
    quiz = await _get_quiz(quiz_id)
    await db.quizzes.update_one(
        {"_id": quiz["_id"]},
        {"$set": {"questions": [q.model_dump() for q in questions]}},
    )
    quiz = await _get_quiz(quiz_id)
    return _admin_detail(quiz)


@router.delete("/quizzes/{quiz_id}", status_code=204)
async def delete_quiz(quiz_id: str, admin: dict = Depends(require_admin)):
    db = get_db()
    quiz = await _get_quiz(quiz_id)
    await db.quizzes.delete_one({"_id": quiz["_id"]})
    await db.attempts.delete_many({"quiz_id": quiz["_id"]})


@router.get("/quizzes/{quiz_id}/results", response_model=list[AttemptSummary])
async def quiz_results(quiz_id: str, admin: dict = Depends(require_admin)):
    db = get_db()
    quiz = await _get_quiz(quiz_id)
    cursor = db.attempts.find({"quiz_id": quiz["_id"]}).sort("submitted_at", -1)
    out: list[AttemptSummary] = []
    async for a in cursor:
        out.append(
            AttemptSummary(
                id=str(a["_id"]),
                user_name=a.get("user_name", ""),
                user_email=a.get("user_email", ""),
                score=a["score"],
                total=a["total"],
                percentage=a["percentage"],
                time_taken_seconds=a.get("time_taken_seconds", 0),
                submitted_at=a["submitted_at"],
            )
        )
    return out


@router.get("/attempts/{attempt_id}", response_model=AttemptResult)
async def attempt_detail(attempt_id: str, admin: dict = Depends(require_admin)):
    """Full review of one student's attempt: what they chose vs the correct answer."""
    db = get_db()
    try:
        oid = ObjectId(attempt_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Attempt not found")
    attempt = await db.attempts.find_one({"_id": oid})
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    quiz = await db.quizzes.find_one({"_id": attempt["quiz_id"]})
    questions = quiz.get("questions", []) if quiz else []
    answers = attempt.get("answers", [])

    review: list[AnswerReview] = []
    for i, q in enumerate(questions):
        chosen = answers[i] if i < len(answers) else -1
        correct = q.get("correct_index", -1)
        review.append(
            AnswerReview(
                question=q["text"],
                options=q["options"],
                chosen_index=chosen,
                correct_index=correct,
                is_correct=correct >= 0 and chosen == correct,
            )
        )

    return AttemptResult(
        id=str(attempt["_id"]),
        quiz_id=str(attempt["quiz_id"]),
        quiz_title=attempt.get("quiz_title", quiz["title"] if quiz else ""),
        score=attempt["score"],
        total=attempt["total"],
        percentage=attempt["percentage"],
        time_taken_seconds=attempt.get("time_taken_seconds", 0),
        submitted_at=attempt["submitted_at"],
        review=review,
    )
