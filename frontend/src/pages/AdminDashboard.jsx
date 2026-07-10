import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function AdminDashboard() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get("/admin/quizzes")
      .then(({ data }) => setQuizzes(data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <div className="container">Loading…</div>;

  return (
    <div className="container">
      <div className="quiz-header">
        <h1>Admin Dashboard</h1>
        <div className="row">
          <Link className="btn" to="/admin/create">
            + Create Manually
          </Link>
          <Link className="btn" to="/admin/upload">
            + Upload PDF
          </Link>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <p className="muted">No quizzes yet. Upload a PDF to get started.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Questions</th>
              <th>Timer</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quizzes.map((q) => (
              <tr key={q.id}>
                <td>{q.title}</td>
                <td>{q.question_count}</td>
                <td>
                  {q.time_limit_seconds
                    ? `${Math.floor(q.time_limit_seconds / 60)}m ${
                        q.time_limit_seconds % 60
                      }s`
                    : "No limit"}
                </td>
                <td>
                  <span className={`badge ${q.is_published ? "green" : "gray"}`}>
                    {q.is_published ? "Published" : "Draft"}
                  </span>
                </td>
                <td>
                  <Link to={`/admin/quizzes/${q.id}`}>Manage →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
