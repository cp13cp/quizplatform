import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext.jsx";

function humanSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export default function Notes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get("/notes")
      .then(({ data }) => setNotes(data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const upload = async (e) => {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Please choose a file");
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    form.append("description", description);
    try {
      await api.post("/admin/notes", form);
      setTitle("");
      setDescription("");
      setFile(null);
      e.target.reset();
      setMsg("Uploaded!");
      setTimeout(() => setMsg(""), 2000);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const download = async (note) => {
    try {
      const res = await api.get(`/notes/${note.id}/download`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = note.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed");
    }
  };

  const remove = async (note) => {
    if (!window.confirm(`Delete "${note.title}"?`)) return;
    await api.delete(`/admin/notes/${note.id}`);
    load();
  };

  return (
    <div className="container">
      <h1>Study Notes</h1>

      {isAdmin && (
        <div className="card">
          <h3>Upload a note</h3>
          {msg && <div className="banner success">{msg}</div>}
          <form onSubmit={upload}>
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            <label>Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <label>File (PDF, doc, image, anything)</label>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} required />
            {error && <p className="error">{error}</p>}
            <button className="btn" disabled={busy}>
              {busy ? "Uploading…" : "Upload Note"}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : notes.length === 0 ? (
        <p className="muted">No notes uploaded yet.</p>
      ) : (
        <div className="grid">
          {notes.map((n) => (
            <div className="card" key={n.id}>
              <h3>📄 {n.title}</h3>
              <p className="muted">{n.description || "—"}</p>
              <div className="meta">
                <span>{n.filename}</span>
                <span>{humanSize(n.size)}</span>
              </div>
              <div className="row">
                <button className="btn" onClick={() => download(n)}>
                  ⬇ Download
                </button>
                {isAdmin && (
                  <button className="btn btn-danger" onClick={() => remove(n)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!isAdmin && error && <p className="error">{error}</p>}
    </div>
  );
}
