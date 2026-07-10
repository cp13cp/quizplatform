import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function AdminCreate() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/admin/quizzes", {
        title,
        description,
        time_limit_seconds: Math.round(minutes * 60),
        questions: [],
      });
      // Quiz created with one starter question — edit it on the detail page.
      navigate(`/admin/quizzes/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow">
      <div className="card">
        <h2>Create Quiz Manually</h2>
        <p className="muted">
          Create the quiz, then add questions/options and mark correct answers on
          the next screen.
        </p>
        <form onSubmit={submit}>
          <label>Quiz Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />

          <label>Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label>Timer (minutes, 0 = no limit)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />

          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy}>
            {busy ? "Creating…" : "Create & Add Questions"}
          </button>
        </form>
      </div>
    </div>
  );
}
