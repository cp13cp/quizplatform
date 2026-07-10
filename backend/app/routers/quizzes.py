from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..models import (
    AnswerReview,
    AttemptResult,
    QuestionPublic,
    QuizForTaking,
    QuizSummary,
    SubmitAttempt,
)
from ..security import get_current_user

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


def quiz_summary(quiz: dict) -> QuizSummary:
    return QuizSummary(
        id=str(quiz["_id"]),
        title=quiz["title"],
        description=quiz.get("description", ""),
        time_limit_seconds=quiz.get("time_limit_seconds", 0),
        question_count=len(quiz.get("questions", [])),
        is_published=quiz.get("is_published", False),
        created_at=quiz["created_at"],
    )


@router.get("", response_model=list[QuizSummary])
async def list_published_quizzes(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.quizzes.find({"is_published": True}).sort("created_at", -1)
    return [quiz_summary(q) async for q in cursor]


async def _get_quiz_or_404(quiz_id: str) -> dict:
    db = get_db()
    try:
        oid = ObjectId(quiz_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Quiz not found")
    quiz = await db.quizzes.find_one({"_id": oid})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@router.get("/{quiz_id}", response_model=QuizForTaking)
async def get_quiz_for_taking(quiz_id: str, user: dict = Depends(get_current_user)):
    quiz = await _get_quiz_or_404(quiz_id)
    if not quiz.get("is_published") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Quiz is not published")
    return QuizForTaking(
        id=str(quiz["_id"]),
        title=quiz["title"],
        description=quiz.get("description", ""),
        time_limit_seconds=quiz.get("time_limit_seconds", 0),
        questions=[
            QuestionPublic(text=q["text"], options=q["options"])
            for q in quiz.get("questions", [])
        ],
    )


@router.post("/{quiz_id}/submit", response_model=AttemptResult)
async def submit_quiz(
    quiz_id: str,
    payload: SubmitAttempt,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    quiz = await _get_quiz_or_404(quiz_id)
    if not quiz.get("is_published") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Quiz is not published")

    questions = quiz.get("questions", [])
    answers = payload.answers
    review: list[AnswerReview] = []
    score = 0

    for i, q in enumerate(questions):
        chosen = answers[i] if i < len(answers) else -1
        correct = q.get("correct_index", -1)
        is_correct = correct >= 0 and chosen == correct
        if is_correct:
            score += 1
        review.append(
            AnswerReview(
                question=q["text"],
                options=q["options"],
                chosen_index=chosen,
                correct_index=correct,
                is_correct=is_correct,
            )
        )

    total = len(questions)
    percentage = round((score / total) * 100, 2) if total else 0.0
    now = datetime.now(timezone.utc)

    attempt_doc = {
        "quiz_id": quiz["_id"],
        "quiz_title": quiz["title"],
        "user_id": user["_id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "answers": answers,
        "score": score,
        "total": total,
        "percentage": percentage,
        "time_taken_seconds": payload.time_taken_seconds,
        "submitted_at": now,
    }
    result = await db.attempts.insert_one(attempt_doc)

    return AttemptResult(
        id=str(result.inserted_id),
        quiz_id=str(quiz["_id"]),
        quiz_title=quiz["title"],
        score=score,
        total=total,
        percentage=percentage,
        time_taken_seconds=payload.time_taken_seconds,
        submitted_at=now,
        review=review,
    )


@router.get("/attempts/me", response_model=list[AttemptResult])
async def my_attempts(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.attempts.find({"user_id": user["_id"]}).sort("submitted_at", -1)
    out: list[AttemptResult] = []
    async for a in cursor:
        out.append(
            AttemptResult(
                id=str(a["_id"]),
                quiz_id=str(a["quiz_id"]),
                quiz_title=a["quiz_title"],
                score=a["score"],
                total=a["total"],
                percentage=a["percentage"],
                time_taken_seconds=a.get("time_taken_seconds", 0),
                submitted_at=a["submitted_at"],
                review=[],
            )
        )
    return out
