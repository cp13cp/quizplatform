import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function AdminDashboard() {
  const [quizzes, setQuizzes] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessDays, setAccessDays] = useState(30);
  const [accessMessage, setAccessMessage] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get("/admin/quizzes")
      .then(({ data }) => setQuizzes(data))
      .finally(() => setLoading(false));
    api.get("/admin/access/users").then(({ data }) => setUsers(data)).catch(() => {});
  };

  useEffect(load, []);

  const grantAccess = async (event) => {
    event.preventDefault();
    setAccessMessage("");
    try {
      const { data } = await api.post("/admin/access/grant", {
        email: accessEmail,
        days: Number(accessDays),
      });
      setUsers((current) => current.map((user) => user.id === data.id ? data : user));
      setAccessMessage(`Free access granted to ${data.name} until ${new Date(data.access_expires_at).toLocaleDateString()}.`);
      setAccessEmail("");
    } catch (error) {
      setAccessMessage(error.response?.data?.detail || "Could not grant access.");
    }
  };

  const revokeAccess = async (userId) => {
    if (!window.confirm("Remove this user's admin-granted free access?")) return;
    try {
      await api.delete(`/admin/access/${userId}`);
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, free_access_expires_at: null } : user));
    } catch (error) {
      setAccessMessage(error.response?.data?.detail || "Could not remove access.");
    }
  };

  if (loading) return <div className="container">Loading…</div>;

  return (
    <div className="container">
      <div className="quiz-header">
        <h1>Admin Dashboard</h1>
        <div className="row">
          <Link className="btn" to="/admin/create">
            + Create Manually
          </Link>
          <Link className="btn" to="/admin/paste">
            + Paste Quiz
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

      <section className="card access-management">
        <h2>Free Test Access</h2>
        <p className="muted">Grant a registered student access without a ₹99 payment.</p>
        <form className="access-grant-form" onSubmit={grantAccess}>
          <input type="email" placeholder="Student email" value={accessEmail} onChange={(e) => setAccessEmail(e.target.value)} required />
          <input type="number" min="1" max="3650" value={accessDays} onChange={(e) => setAccessDays(e.target.value)} required />
          <button className="btn" type="submit">Grant Free Access</button>
        </form>
        {accessMessage && <p className={accessMessage.startsWith("Free access") ? "banner success" : "error"}>{accessMessage}</p>}
        {users.length > 0 && (
          <table className="table access-users-table">
            <thead><tr><th>Student</th><th>Access until</th><th></th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}<br /><small>{user.email}</small></td>
                  <td>{user.access_expires_at ? new Date(user.access_expires_at).toLocaleDateString() : "Locked"}</td>
                  <td>{user.free_access_expires_at && <button className="btn-link" onClick={() => revokeAccess(user.id)}>Remove free access</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
