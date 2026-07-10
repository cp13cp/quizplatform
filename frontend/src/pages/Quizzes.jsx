import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

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

  useEffect(() => {
    Promise.all([api.get("/quizzes"), api.get("/quizzes/attempts/me")])
      .then(([q, a]) => {
        setQuizzes(q.data);
        setAttempts(a.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="container">Loading…</div>;

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
