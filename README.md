# Quiz Platform | React + FastAPI + MongoDB Quiz App

A modern quiz platform built with React, FastAPI, and MongoDB for creating, publishing, and taking online quizzes. Admins can upload PDF-based question papers, review extracted questions, set timers, and publish exams. Users can register, unlock test access, take quizzes, and view instant results with answer reviews.

This project is ideal for educational platforms, exam portals, and online assessment systems that need quiz creation, exam management, and leaderboard tracking in one scalable app.

## Features

- JWT-based authentication with admin and user roles
- PDF quiz upload and automatic question extraction
- Quiz timer and auto-submit support
- Instant scoring and detailed answer review
- Admin dashboard for quiz management and results
- User dashboard with available quizzes, leaderboard, and attempt history
- Category-based quiz filters
- Razorpay payment integration for paid test access
- MongoDB-ready architecture for scalable deployment

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, React Router, Axios |
| Backend | FastAPI, Python, Motor |
| Database | MongoDB |
| PDF Parsing | pdfplumber |
| Authentication | JWT, Passlib, Bcrypt |
| Payments | Razorpay |

---

## Why This Project Is Useful

This app solves common problems in online exam systems:

- Admins can convert PDF question papers into structured quiz data in minutes
- Students get a clean, timed, exam-like experience
- Results are available immediately after submission
- Quiz categories help organize and filter learning content
- Payment-gated access can control test availability

It is a strong example of a full-stack quiz application built with modern web technologies and suitable for educational, hiring, or training use cases.

---

## 1. Backend Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Add the required environment variables in `.env`:

```env
MONGO_URI=mongodb://localhost:27017
DB_NAME=quizapp
JWT_SECRET=your_super_secure_secret_key
ADMIN_EMAIL=admin@quiz.com
ADMIN_PASSWORD=admin123
CORS_ORIGINS=http://localhost:5173
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

Run the backend server:

```bash
uvicorn app.main:app --reload --port 8000
```

Useful links:

- API docs: http://localhost:8000/docs
- Default admin login: `admin@quiz.com / admin123`

> If using MongoDB Atlas, ensure your IP is whitelisted. If you see `SSL: TLSV1_ALERT_INTERNAL_ERROR`, check Atlas network access and required CA settings.

---

## 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend app URL:

- http://localhost:5173

---

## 3. PDF Quiz Format

The PDF parser supports common exam formats such as:

- Questions starting with `1.` or `12)`
- Options labeled as `A)`, `b.`, or `(C)`
- Optional answer lines such as `Answer: A`, `Ans: c`, or `Correct: 3`

Example:

```text
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

If an answer line is missing, the admin can still fix or set the correct answer manually from the dashboard later.

### Generate Sample PDF

```bash
cd backend
pip install reportlab
python scripts/make_sample_pdf.py
```

This creates a sample quiz PDF for testing the extraction pipeline.

---

## 4. How It Works

1. Admin logs in with the admin account.
2. Admin uploads a quiz PDF and enters a title, description, category, and timer.
3. Quiz questions are extracted and can be reviewed and corrected.
4. Admin publishes the quiz.
5. A user registers, unlocks access, and starts the quiz.
6. The user submits the quiz and sees the result with review details.
7. Admin can view attempts and performance reports for each quiz.

---

## API Overview

| Method | Endpoint | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | User | Create account |
| POST | `/auth/forgot-password` | User | Request password reset |
| POST | `/auth/reset-password` | User | Confirm password reset |
| POST | `/auth/login` | User/Admin | Login |
| GET | `/quizzes` | User | List published quizzes |
| GET | `/quizzes/{id}` | User | Fetch quiz details |
| POST | `/quizzes/{id}/submit` | User | Submit answers |
| GET | `/quizzes/attempts/me` | User | View my attempts |
| POST | `/admin/quizzes/upload` | Admin | Upload and parse PDF quiz |
| GET | `/admin/quizzes` | Admin | View all quizzes |
| PATCH | `/admin/quizzes/{id}` | Admin | Update quiz settings |
| PUT | `/admin/quizzes/{id}/questions` | Admin | Replace quiz questions |
| DELETE | `/admin/quizzes/{id}` | Admin | Delete quiz |
| GET | `/admin/quizzes/{id}/results` | Admin | View all quiz attempts |

---

## Project Structure

```text
tracknew/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── security.py
│   │   ├── models.py
│   │   ├── pdf_parser.py
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── quizzes.py
│   │       └── admin.py
│   ├── scripts/
│   │   └── make_sample_pdf.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/
│   │   ├── context/
│   │   └── pages/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── README.md
├── netlify.toml
├── render.yaml
└── .gitignore
```

---

## License

This project is intended for educational and demo purposes. Use it as a starting point for your own online quiz system or learning platform.

## Contributing

Pull requests and improvements are welcome. You can extend this project by adding:

- more question formats
- exam analytics dashboards
- student progress tracking
- better anti-cheating features
- multi-language support
