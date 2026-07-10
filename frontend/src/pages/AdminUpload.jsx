import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function AdminUpload() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(0);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Please choose a PDF file");
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    form.append("description", description);
    form.append("time_limit_seconds", String(Math.round(minutes * 60)));
    try {
      const { data } = await api.post("/admin/quizzes/upload", form);
      navigate(`/admin/quizzes/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow">
      <div className="card">
        <h2>Upload Quiz PDF</h2>
        <p className="muted">
          The PDF should have numbered questions with lettered options and an
          optional <code>Answer:</code> line. See README for the exact format.
        </p>
        <form onSubmit={submit}>
          <label>Quiz Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />

          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          <label>Timer (minutes, 0 = no limit)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />

          <label>PDF File</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            required
          />

          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy}>
            {busy ? "Extracting…" : "Upload & Extract"}
          </button>
        </form>
      </div>
    </div>
  );
}
