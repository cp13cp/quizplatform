# Quiz Platform (React + FastAPI + MongoDB)

Admin ek **PDF** upload karta hai → questions automatically **extract** ho jaate hain →
admin timer/answers set karke quiz **publish** karta hai → users quiz **solve** karke
turant **result + review** dekhte hain. Admin har quiz ke **results** dekh sakta hai.

## Features

- 🔐 JWT auth, do roles: **admin** aur **user**
- 📄 PDF se quiz extraction (questions + options + correct answer)
- ⏱ Har quiz par **timer** (auto-submit jab time khatam)
- ✅ Auto-scoring + detailed answer review
- 🛠 Admin: upload, timer set, parsed answers edit/fix, publish/unpublish, results
- 📊 User: quiz list, quiz solve, apne attempts ka history

## Tech stack

| Layer     | Tech                                   |
| --------- | -------------------------------------- |
| Frontend  | React 18 + Vite + React Router + Axios |
| Backend   | FastAPI + Motor (async MongoDB)        |
| Database  | MongoDB (local ya Atlas)               |
| PDF parse | pdfplumber                             |
| Auth      | JWT (python-jose) + bcrypt (passlib)   |

---

## 1. Backend setup

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env      # phir .env me apni values daalein
```

`.env` me set karein:

```env
MONGO_URI=mongodb://localhost:27017          # ya Atlas: mongodb+srv://...
DB_NAME=quizapp
JWT_SECRET=<koi-lamba-random-string>
ADMIN_EMAIL=admin@quiz.com
ADMIN_PASSWORD=admin123
CORS_ORIGINS=http://localhost:5173
```

Server chalayein:

```bash
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Startup par ek **admin** user automatically ban jaata hai (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

> **Atlas note:** agar `SSL: TLSV1_ALERT_INTERNAL_ERROR` aaye to
> Atlas → Network Access me apna IP (ya test ke liye `0.0.0.0/0`) allow karein.
> Code Atlas ke liye `certifi` CA bundle automatically use karta hai.

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_URL=http://localhost:8000
npm run dev
```

App: http://localhost:5173

---

## 3. PDF format (important)

Extraction in rules ko follow karta hai:

- Question ek **number + `.` ya `)`** se shuru: `1.` ya `12)`
- Options ek letter (A–H) + `.` `)` ya bracket se: `A)` `b.` `(C)`
- Optional answer line: `Answer: A` / `Ans: b` / `Correct: 3`
  (letter ya 1-based number — dono chalte hain)
- Answer line na ho to question phir bhi import hota hai; admin baad me
  dashboard se correct answer set kar sakta hai.

**Example:**

```
1. What is the capital of France?
A) Paris
B) London
C) Berlin
D) Madrid
Answer: A

2) 7 + 5 = ?
a. 10
b. 11
c. 12
d. 13
Ans: c
```

### Sample PDF banayein

```bash
cd backend
pip install reportlab
python scripts/make_sample_pdf.py     # sample_quiz.pdf banega
```

---

## 4. Flow (kaise use karein)

1. `admin@quiz.com / admin123` se **login** karein.
2. **Upload PDF** → title, description, timer (minutes) dekar upload.
3. Quiz detail page par parsed questions verify karein, zaroorat ho to correct
   answer/text fix karein, **Save Questions**.
4. **Publish** dabayein.
5. Naya **user register** karein (ya alag browser), quiz solve karein — timer
   chalega, submit par result + review milega.
6. Admin quiz detail page par sabhi users ke **results** dekh sakta hai.

## API summary

| Method | Endpoint                          | Role  | Kaam                          |
| ------ | --------------------------------- | ----- | ----------------------------- |
| POST   | `/auth/send-otp`                  | -     | Send OTP to email before signup or password reset |
| POST   | `/auth/register`                  | -     | User register                 |
| POST   | `/auth/reset-password`            | -     | Reset password using OTP      |
| POST   | `/auth/login`                     | -     | Login (admin/user)            |
| GET    | `/quizzes`                        | user  | Published quizzes list        |
| GET    | `/quizzes/{id}`                   | user  | Quiz (answers hidden)         |
| POST   | `/quizzes/{id}/submit`            | user  | Submit + score + review       |
| GET    | `/quizzes/attempts/me`            | user  | Mere attempts                 |
| POST   | `/admin/quizzes/upload`           | admin | PDF upload + extract          |
| GET    | `/admin/quizzes`                  | admin | Saare quizzes                 |
| PATCH  | `/admin/quizzes/{id}`             | admin | Title/timer/publish update    |
| PUT    | `/admin/quizzes/{id}/questions`   | admin | Questions/answers replace     |
| DELETE | `/admin/quizzes/{id}`             | admin | Quiz delete                   |
| GET    | `/admin/quizzes/{id}/results`     | admin | Quiz ke saare attempts        |

## Project structure

```
tracknew/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, startup, admin bootstrap, CORS
│   │   ├── config.py          # env settings
│   │   ├── database.py        # motor client (+ certifi for Atlas)
│   │   ├── security.py        # JWT + password hashing + role guards
│   │   ├── models.py          # Pydantic schemas
│   │   ├── pdf_parser.py      # PDF → questions
│   │   └── routers/{auth,quizzes,admin}.py
│   ├── scripts/make_sample_pdf.py
│   └── requirements.txt
└── frontend/
    └── src/
        ├── api.js             # axios + token interceptor
        ├── context/AuthContext.jsx
        ├── components/Navbar.jsx
        └── pages/{Login,Register,Quizzes,TakeQuiz,Result,
                    AdminDashboard,AdminUpload,AdminQuizDetail}.jsx
```
