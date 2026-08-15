from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator

# ---------- Auth ----------


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=4)
    confirm_password: str = Field(min_length=4)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=32)
    password: str = Field(min_length=4)
    confirm_password: str = Field(min_length=4)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Literal["admin", "user"]


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AccessStatus(BaseModel):
    active: bool
    expires_at: datetime | None = None
    price_rupees: int = 99
    duration_days: int = 30


class PaymentOrderOut(BaseModel):
    key_id: str
    order_id: str
    amount: int
    currency: str = "INR"


class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class AdminAccessGrant(BaseModel):
    email: EmailStr
    days: int = Field(default=30, ge=1, le=3650)


class AdminAccessUser(BaseModel):
    id: str
    name: str
    email: EmailStr
    access_expires_at: datetime | None = None
    free_access_expires_at: datetime | None = None


# ---------- Quiz ----------


class Question(BaseModel):
    text: str
    options: list[str]
    correct_index: int  # index into options; -1 if unknown


class QuestionPublic(BaseModel):
    """Question as sent to a test taker (no correct answer)."""

    text: str
    options: list[str]


class QuizCreate(BaseModel):
    title: str
    description: str = ""
    category: str = ""
    time_limit_seconds: int = Field(default=0, ge=0)
    questions: list[Question] = []


class QuizUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    time_limit_seconds: int | None = Field(default=None, ge=0)
    is_published: bool | None = None


class QuizSummary(BaseModel):
    id: str
    title: str
    description: str
    category: str = ""
    time_limit_seconds: int
    question_count: int
    is_published: bool
    created_at: datetime


class QuizForTaking(BaseModel):
    id: str
    title: str
    description: str
    category: str = ""
    time_limit_seconds: int
    questions: list[QuestionPublic]


class QuizAdminDetail(QuizSummary):
    questions: list[Question]


class NoteUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    is_locked: bool | None = None
    price_rupees: int | None = Field(default=None, ge=0)


# ---------- Courses ----------


class CourseCreate(BaseModel):
    title: str
    overview: str
    duration: str = "2 Months"
    schedule: str = "2 Hours Daily"
    price_rupees: int = 9999
    features: list[str] = []
    color: str = "#e8f5e9"
    is_active: bool = True


class CourseUpdate(BaseModel):
    title: str | None = None
    overview: str | None = None
    duration: str | None = None
    schedule: str | None = None
    price_rupees: int | None = None
    features: list[str] | None = None
    color: str | None = None
    is_active: bool | None = None


class CourseSummary(BaseModel):
    id: str
    title: str
    overview: str
    duration: str
    schedule: str
    price_rupees: int
    features: list[str]
    color: str
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None


class CourseForCatalog(BaseModel):
    id: str
    title: str
    overview: str
    duration: str
    schedule: str
    price_rupees: int
    features: list[str]
    color: str


class NoteSummary(BaseModel):
    id: str
    title: str
    description: str
    category: str = ""
    filename: str
    size: int
    content_type: str
    uploaded_at: datetime | None = None
    is_locked: bool = False
    price_rupees: int = 0


# ---------- Attempts / results ----------


class SubmitAttempt(BaseModel):
    # answers[i] = chosen option index for question i, or -1 if unanswered
    answers: list[int]
    time_taken_seconds: int = 0


class AnswerReview(BaseModel):
    question: str
    options: list[str]
    chosen_index: int
    correct_index: int
    is_correct: bool


class AttemptResult(BaseModel):
    id: str
    quiz_id: str
    quiz_title: str
    score: int
    total: int
    percentage: float
    time_taken_seconds: int
    submitted_at: datetime
    review: list[AnswerReview]


class AttemptSummary(BaseModel):
    id: str
    user_name: str
    user_email: str
    score: int
    total: int
    percentage: float
    time_taken_seconds: int
    submitted_at: datetime


class QuizParticipation(BaseModel):
    """A registered student's participation state for one quiz."""

    user_name: str
    user_email: str
    has_attempted: bool


class QuizParticipationStatsDay(BaseModel):
    date: datetime
    attempted: int
    not_attempted: int
    total_students: int


class QuizParticipationStats(BaseModel):
    total_students: int
    attempted: int
    not_attempted: int
    period_days: int
    daily: list[QuizParticipationStatsDay]


class LeaderboardEntry(BaseModel):
    rank: int
    user_name: str
    score: int
    total: int
    percentage: float
    time_taken_seconds: int
    submitted_at: datetime
