import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext.jsx";

function fmtTime(sec) {
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

const medal = (rank) =>
  rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

export default function Leaderboard() {
  const { id } = useParams();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get(`/quizzes/${id}/leaderboard`),
      api.get(`/quizzes/${id}`),
    ])
      .then(([lb, q]) => {
        setRows(lb.data);
        setQuiz(q.data);
      })
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="container">Loading…</div>;
  if (error) return <div className="container error">{error}</div>;

  return (
    <div className="container">
      <div className="quiz-header">
        <h1>🏆 Leaderboard{quiz ? ` — ${quiz.title}` : ""}</h1>
        <Link className="btn-link" to={user?.role === "admin" ? "/admin" : "/quizzes"}>
          ← Back
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="muted">No attempts yet. Be the first!</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Score</th>
              <th>%</th>
              <th>Time</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rank} className={r.rank <= 3 ? "top-rank" : ""}>
                <td>{medal(r.rank)}</td>
                <td>{r.user_name}</td>
                <td>
                  {r.score}/{r.total}
                </td>
                <td>{r.percentage}%</td>
                <td>{fmtTime(r.time_taken_seconds)}</td>
                <td>{new Date(r.submitted_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted" style={{ marginTop: "0.8rem" }}>
        Best attempt per user is ranked by score, then by fastest time.
      </p>
    </div>
  );
}
