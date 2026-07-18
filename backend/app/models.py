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
    time_limit_seconds: int = Field(default=0, ge=0)
    questions: list[Question] = []


class QuizUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    time_limit_seconds: int | None = Field(default=None, ge=0)
    is_published: bool | None = None


class QuizSummary(BaseModel):
    id: str
    title: str
    description: str
    time_limit_seconds: int
    question_count: int
    is_published: bool
    created_at: datetime


class QuizForTaking(BaseModel):
    id: str
    title: str
    description: str
    time_limit_seconds: int
    questions: list[QuestionPublic]


class QuizAdminDetail(QuizSummary):
    questions: list[Question]


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
