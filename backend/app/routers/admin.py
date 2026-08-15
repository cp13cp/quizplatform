from datetime import date, datetime, timedelta, timezone
from pydantic import BaseModel

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from ..database import get_db
from ..models import (
    AnswerReview,
    AdminAccessGrant,
    AdminAccessUser,
    AttemptResult,
    AttemptSummary,
    CourseCreate,
    CourseForCatalog,
    CourseSummary,
    CourseUpdate,
    Question,
    QuizAdminDetail,
    QuizCreate,
    QuizParticipation,
    QuizParticipationStats,
    QuizParticipationStatsDay,
    QuizSummary,
    QuizUpdate,
)
from ..pdf_parser import parse_quiz_from_pdf
from ..security import require_admin
from .quizzes import quiz_summary

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/access/users", response_model=list[AdminAccessUser])
async def list_access_users(admin: dict = Depends(require_admin)):
    """Students and their current paid or admin-granted access expiry."""
    db = get_db()
    cursor = db.users.find({"role": "user"}).sort("name", 1)
    return [
        AdminAccessUser(
            id=str(user["_id"]),
            name=user.get("name", ""),
            email=user["email"],
            access_expires_at=max(
                (expiry for expiry in (user.get("access_expires_at"), user.get("free_access_expires_at")) if expiry is not None),
                default=None,
            ),
            free_access_expires_at=user.get("free_access_expires_at"),
        )
        async for user in cursor
    ]


@router.post("/access/grant", response_model=AdminAccessUser)
async def grant_free_access(
    payload: AdminAccessGrant, admin: dict = Depends(require_admin)
):
    """Give a registered student free access without collecting payment."""
    db = get_db()
    user = await db.users.find_one({"email": payload.email.lower(), "role": "user"})
    if not user:
        raise HTTPException(status_code=404, detail="Registered student not found")

    now = datetime.now(timezone.utc)
    current_expiry = user.get("free_access_expires_at")
    start = current_expiry if current_expiry and current_expiry > now else now
    expires_at = start + timedelta(days=payload.days)
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "access_expires_at": expires_at,
                "free_access_expires_at": expires_at,
                "access_granted_by": admin["_id"],
            }
        },
    )
    return AdminAccessUser(
        id=str(user["_id"]), name=user.get("name", ""), email=user["email"],
        access_expires_at=expires_at,
        free_access_expires_at=expires_at,
    )


@router.delete("/access/{user_id}", status_code=204)
async def revoke_free_access(user_id: str, admin: dict = Depends(require_admin)):
    """Remove a student's access immediately."""
    db = get_db()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Student not found")
    result = await db.users.update_one(
        {"_id": oid, "role": "user"},
        {
            "$unset": {
                "access_expires_at": "",
                "free_access_expires_at": "",
                "access_granted_by": "",
            }
        },
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Student not found")


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
    category: str = Form(""),
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
        "category": (category or "").strip(),
        "time_limit_seconds": max(0, time_limit_seconds),
        "questions": questions,
        "is_published": True,
        "created_by": admin["_id"],
        "created_at": datetime.now(timezone.utc),
        "source_filename": file.filename,
    }
    result = await db.quizzes.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _admin_detail(doc)


@router.post("/quizzes", response_model=QuizAdminDetail)
async def create_quiz(payload: QuizCreate, admin: dict = Depends(require_admin)):
    """Create a quiz manually (no PDF)."""
    db = get_db()
    questions = [q.model_dump() for q in payload.questions]
    if not questions:
        # Start with one blank question the admin can edit on the detail page.
        questions = [
            {
                "text": "New question",
                "options": ["Option 1", "Option 2"],
                "correct_index": 0,
            }
        ]
    doc = {
        "title": payload.title,
        "description": payload.description,
        "category": (payload.category or "").strip(),
        "time_limit_seconds": max(0, payload.time_limit_seconds),
        "questions": questions,
        "is_published": True,
        "created_by": admin["_id"],
        "created_at": datetime.now(timezone.utc),
        "source_filename": None,
    }
    result = await db.quizzes.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _admin_detail(doc)


class QuizTextCreate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    time_limit_seconds: int | None = 0
    text: str


def _parse_questions_from_text(text: str) -> list[dict]:
    """Parse a simple pasted quiz format into question dicts.

    Format (blocks separated by blank line):
    Question line
    A) option one
    B) option two *   <- trailing * marks correct

    If no letter prefixes are present, treat subsequent non-empty lines as options.
    """
    blocks = [b.strip() for b in text.split("\n\n") if b.strip()]
    questions: list[dict] = []
    for block in blocks:
        lines = [l.strip() for l in block.splitlines() if l.strip()]
        if not lines:
            continue
        qtext = lines[0]
        opts = []
        correct_idx = -1
        for i, line in enumerate(lines[1:]):
            # Detect markers like 'A) text', '- text', '1. text'
            opt = line
            # remove leading label like 'A)' or '1.' or '-'
            if len(opt) > 2 and (opt[1] == ')' or opt[1] == '.'):
                opt = opt[2:].strip()
            elif opt.startswith('- '):
                opt = opt[2:].strip()
            # detect correctness markers
            if opt.endswith('*'):
                opt = opt[:-1].strip()
                correct_idx = len(opts)
            elif opt.lower().endswith('(correct)'):
                opt = opt[: -len('(correct)')].strip()
                correct_idx = len(opts)
            elif opt.startswith('*'):
                opt = opt[1:].strip()
                correct_idx = len(opts)
            opts.append(opt)

        # If only question and no explicit options, try splitting by '|' or ';'
        if not opts:
            parts = [p.strip() for p in qtext.split('|') if p.strip()]
            if len(parts) > 1:
                # first part as question, rest as options
                qtext = parts[0]
                opts = parts[1:]

        questions.append({
            "text": qtext,
            "options": opts or ["Option 1", "Option 2"],
            "correct_index": correct_idx,
        })
    return questions


@router.post("/quizzes/from-text", response_model=QuizAdminDetail)
async def create_quiz_from_text(payload: QuizTextCreate, admin: dict = Depends(require_admin)):
    """Create a quiz by pasting plain text (admin only)."""
    db = get_db()
    questions = _parse_questions_from_text(payload.text)
    if not questions:
        raise HTTPException(status_code=422, detail="No questions parsed from text")
    doc = {
        "title": payload.title,
        "description": payload.description or "",
        "category": (payload.category or "").strip(),
        "time_limit_seconds": max(0, int(payload.time_limit_seconds or 0)),
        "questions": questions,
        "is_published": True,
        "created_by": admin["_id"],
        "created_at": datetime.now(timezone.utc),
        "source_filename": "pasted",
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


@router.get("/quizzes/{quiz_id}/participation", response_model=list[QuizParticipation])
async def quiz_participation(quiz_id: str, admin: dict = Depends(require_admin)):
    """List every student and whether they have submitted this quiz."""
    db = get_db()
    quiz = await _get_quiz(quiz_id)
    attempted_user_ids = {
        attempt["user_id"]
        async for attempt in db.attempts.find(
            {"quiz_id": quiz["_id"]}, {"user_id": 1}
        )
    }
    users = db.users.find({"role": "user"}).sort("name", 1)
    return [
        QuizParticipation(
            user_name=user.get("name", ""),
            user_email=user.get("email", ""),
            has_attempted=user["_id"] in attempted_user_ids,
        )
        async for user in users
    ]


@router.get("/quizzes/{quiz_id}/participation-stats", response_model=QuizParticipationStats)
async def quiz_participation_stats(
    quiz_id: str,
    days: int = Query(7, ge=0, le=365),
    admin: dict = Depends(require_admin),
):
    """Return quiz participation counts and daily breakdown for the requested window."""
    db = get_db()
    quiz = await _get_quiz(quiz_id)
    total_students = await db.users.count_documents({"role": "user"})

    period_filter: dict = {"quiz_id": quiz["_id"]}
    daily: list[QuizParticipationStatsDay] = []
    if days > 0:
        today = datetime.now(timezone.utc).date()
        start_date = today - timedelta(days=days - 1)
        start_dt = datetime(
            start_date.year,
            start_date.month,
            start_date.day,
            tzinfo=timezone.utc,
        )
        period_filter["submitted_at"] = {"$gte": start_dt}

    attempted_user_ids = set()
    user_ids_by_date: dict[date, set] = {}
    async for attempt in db.attempts.find(period_filter, {"user_id": 1, "submitted_at": 1}):
        attempted_user_ids.add(attempt["user_id"])
        if days > 0 and attempt.get("submitted_at") is not None:
            attempt_date = attempt["submitted_at"].date()
            if attempt_date >= start_date:
                user_ids_by_date.setdefault(attempt_date, set()).add(attempt["user_id"])

    if days > 0:
        for offset in range(days):
            day_date = start_date + timedelta(days=offset)
            day_attempted = len(user_ids_by_date.get(day_date, set()))
            daily.append(
                QuizParticipationStatsDay(
                    date=datetime(
                        day_date.year,
                        day_date.month,
                        day_date.day,
                        tzinfo=timezone.utc,
                    ),
                    attempted=day_attempted,
                    not_attempted=max(total_students - day_attempted, 0),
                    total_students=total_students,
                )
            )

    return QuizParticipationStats(
        total_students=total_students,
        attempted=len(attempted_user_ids),
        not_attempted=max(total_students - len(attempted_user_ids), 0),
        period_days=days,
        daily=daily,
    )


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


# ---------- COURSE MANAGEMENT ----------


def _course_summary(course: dict) -> CourseSummary:
    """Convert MongoDB course document to CourseSummary response."""
    return CourseSummary(
        id=str(course["_id"]),
        title=course["title"],
        overview=course["overview"],
        duration=course.get("duration", ""),
        schedule=course.get("schedule", ""),
        price_rupees=course.get("price_rupees", 0),
        features=course.get("features", []),
        color=course.get("color", "#e8f5e9"),
        is_active=course.get("is_active", True),
        created_at=course.get("created_at", datetime.now(timezone.utc)),
        updated_at=course.get("updated_at"),
    )


def _get_course(course_id: str, db) -> dict:
    """Retrieve course by ID or raise 404."""
    from bson.errors import InvalidId
    
    try:
        course = db.courses.find_one({"_id": ObjectId(course_id)})
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid course ID")
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.post("/courses", response_model=CourseSummary)
async def create_course(
    payload: CourseCreate,
    admin: dict = Depends(require_admin)
):
    """Create a new course (admin only)."""
    db = get_db()
    now = datetime.now(timezone.utc)
    
    course_doc = {
        "title": payload.title,
        "overview": payload.overview,
        "duration": payload.duration,
        "schedule": payload.schedule,
        "price_rupees": payload.price_rupees,
        "features": payload.features,
        "color": payload.color,
        "is_active": payload.is_active,
        "created_at": now,
        "updated_at": None,
    }
    
    result = db.courses.insert_one(course_doc)
    course_doc["_id"] = result.inserted_id
    return _course_summary(course_doc)


@router.get("/courses", response_model=list[CourseSummary])
async def list_courses(admin: dict = Depends(require_admin)):
    """List all courses (admin only)."""
    db = get_db()
    cursor = db.courses.find({}).sort("created_at", -1)
    return [_course_summary(course) async for course in cursor]


@router.get("/courses/{course_id}", response_model=CourseSummary)
async def get_course(course_id: str, admin: dict = Depends(require_admin)):
    """Get single course detail (admin only)."""
    db = get_db()
    course = _get_course(course_id, db)
    return _course_summary(course)


@router.patch("/courses/{course_id}", response_model=CourseSummary)
async def update_course(
    course_id: str,
    payload: CourseUpdate,
    admin: dict = Depends(require_admin)
):
    """Update course fields selectively (admin only)."""
    db = get_db()
    course = _get_course(course_id, db)
    
    update_data = payload.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    db.courses.update_one(
        {"_id": ObjectId(course_id)},
        {"$set": update_data}
    )
    
    updated = db.courses.find_one({"_id": ObjectId(course_id)})
    return _course_summary(updated)


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str, admin: dict = Depends(require_admin)):
    """Delete course permanently (admin only)."""
    db = get_db()
    course = _get_course(course_id, db)
    
    result = db.courses.delete_one({"_id": ObjectId(course_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return {"message": "Course deleted successfully"}
