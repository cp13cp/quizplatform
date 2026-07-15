import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

function buildMiniQuiz() {
  const pool = [
    { question: "2 + 2 = ?", options: ["3", "4", "5", "6"], answer: "4" },
    {
      question: "Which planet is called the Red Planet?",
      options: ["Venus", "Mars", "Mercury", "Jupiter"],
      answer: "Mars",
    },
    {
      question: "How many days are there in a week?",
      options: ["5", "6", "7", "8"],
      answer: "7",
    },
    {
      question: "Which is a prime number?",
      options: ["4", "6", "7", "8"],
      answer: "7",
    },
    {
      question: "What color do you get when you mix blue and yellow?",
      options: ["Red", "Green", "Purple", "Orange"],
      answer: "Green",
    },
  ];

  return [...pool]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((item) => ({
      ...item,
      options: [...item.options].sort(() => Math.random() - 0.5),
    }));
}

function fmtTime(sec) {
  if (!sec) return "No limit";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s ? s + "s" : ""}`.trim();
}

export default function Quizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [miniQuiz, setMiniQuiz] = useState([]);

  useEffect(() => {
    setMiniQuiz(buildMiniQuiz());

    Promise.all([api.get("/quizzes"), api.get("/quizzes/attempts/me")])
      .then(([q, a]) => {
        setQuizzes(q.data);
        setAttempts(a.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container">
        <div className="loading-card">
          <div className="loading-spinner" />
          <h2>Data is loading</h2>
          <p className="muted">
            It may take around 50 seconds to load the data. Meanwhile, try solving
            this short quiz.
          </p>

          <div className="mini-quiz-list">
            {miniQuiz.map((item, index) => (
              <div className="mini-quiz-item" key={`${item.question}-${index}`}>
                <p>{index + 1}. {item.question}</p>
                <div className="mini-options">
                  {item.options.map((option) => (
                    <span className="mini-option" key={`${item.question}-${option}`}>
                      {option}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const completed = new Set(attempts.map((a) => a.quiz_id)).size;
  const avgScore = attempts.length
    ? Math.round(
        attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length
      )
    : 0;
  const bestScore = attempts.length
    ? Math.round(Math.max(...attempts.map((a) => a.percentage)))
    : 0;

  const stats = [
    { label: "Total Quizzes", value: quizzes.length, icon: "📚" },
    { label: "Completed", value: completed, icon: "✅" },
    { label: "Average Score", value: `${avgScore}%`, icon: "📊" },
    { label: "Best Score", value: `${bestScore}%`, icon: "🏆" },
  ];

  return (
    <div className="container">
      <h1>Dashboard</h1>
      <div className="stats">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon">{s.icon}</div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <h1>Available Quizzes</h1>
      {quizzes.length === 0 && <p className="muted">No published quizzes yet.</p>}
      <div className="grid">
        {quizzes.map((q) => (
          <div className="card" key={q.id}>
            <h3>{q.title}</h3>
            <p className="muted">{q.description || "—"}</p>
            <div className="meta">
              <span>❓ {q.question_count} questions</span>
              <span>⏱ {fmtTime(q.time_limit_seconds)}</span>
            </div>
            <div className="row">
              <Link className="btn" to={`/quizzes/${q.id}`}>
                Start Quiz
              </Link>
              <Link className="btn-link" to={`/leaderboard/${q.id}`}>
                🏆 Leaderboard
              </Link>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: "2rem" }}>My Attempts</h2>
      {attempts.length === 0 ? (
        <p className="muted">You haven't attempted any quiz yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Quiz</th>
              <th>Score</th>
              <th>%</th>
              <th>Time</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id}>
                <td>{a.quiz_title}</td>
                <td>
                  {a.score}/{a.total}
                </td>
                <td>{a.percentage}%</td>
                <td>{fmtTime(a.time_taken_seconds)}</td>
                <td>{new Date(a.submitted_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
