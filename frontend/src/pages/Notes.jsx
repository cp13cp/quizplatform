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
  const [category, setCategory] = useState("");
  const [file, setFile] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [priceRupees, setPriceRupees] = useState(0);
  const [search, setSearch] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [access, setAccess] = useState(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const loadAccessStatus = () => {
    api
      .get("/payments/status")
      .then(({ data }) => setAccess(data))
      .catch(() => setAccess({ active: false, price_rupees: 199, duration_days: 30 }));
  };

  const load = () => {
    setLoading(true);
    api
      .get("/notes")
      .then(({ data }) => setNotes(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    loadAccessStatus();
  }, []);

  const resetForm = (target) => {
    setTitle("");
    setDescription("");
    setCategory("");
    setFile(null);
    setIsLocked(false);
    setPriceRupees(0);
    setEditingNoteId(null);
    if (target) target.reset();
  };

  const upload = async (e) => {
    e.preventDefault();
    setError("");
    if (!file && !editingNoteId) {
      setError("Please choose a file");
      return;
    }
    setBusy(true);
    try {
      if (editingNoteId) {
        await api.patch(`/admin/notes/${editingNoteId}`, {
          title,
          description,
          category,
          is_locked: isLocked,
          price_rupees: Number(priceRupees) || 0,
        });
        setMsg("Updated!");
      } else {
        const form = new FormData();
        form.append("file", file);
        form.append("title", title);
        form.append("description", description);
        form.append("category", category);
        form.append("is_locked", String(isLocked));
        form.append("price_rupees", String(Number(priceRupees) || 0));
        await api.post("/admin/notes", form);
        setMsg("Uploaded!");
      }
      resetForm(e.target);
      setTimeout(() => setMsg(""), 2000);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const startPayment = async () => {
    setError("");
    setPaying(true);
    try {
      const { data: order } = await api.post("/payments/order");
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Could not load payment checkout"));
          document.body.appendChild(script);
        });
      }

      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Quiz Platform",
        description: "Note access for 30 days",
        order_id: order.order_id,
        prefill: { name: JSON.parse(localStorage.getItem("user") || "{}").name || "" },
        handler: async (response) => {
          try {
            const verified = await api.post("/payments/verify", response);
            setAccess(verified.data);
            setMsg("Payment successful! Your access is now active.");
            setTimeout(() => setMsg(""), 2500);
          } catch (err) {
            setError(err.response?.data?.detail || "Payment could not be verified.");
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
        theme: { color: "#4f46e5" },
      });
      checkout.open();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Could not start payment.");
      setPaying(false);
    }
  };

  const hasActiveAccess = user?.role === "admin" || Boolean(access?.active);

  const download = async (note) => {
    if (note.is_locked && !hasActiveAccess) {
      setError("Please buy the subscription to unlock and download this note.");
      return;
    }

    setError("");
    setDownloadingId(note.id);
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
      setError("Download failed. Please activate your access first.");
    } finally {
      setDownloadingId(null);
    }
  };

  const startEdit = (note) => {
    setEditingNoteId(note.id);
    setTitle(note.title);
    setDescription(note.description || "");
    setCategory(note.category || "");
    setIsLocked(Boolean(note.is_locked));
    setPriceRupees(Number(note.price_rupees || 0));
    setError("");
  };

  const cancelEdit = (e) => {
    if (e) e.preventDefault();
    resetForm(null);
  };

  const remove = async (note) => {
    if (!window.confirm(`Delete "${note.title}"?`)) return;
    await api.delete(`/admin/notes/${note.id}`);
    load();
  };

  const categories = [...new Set(notes.map((n) => n.category).filter(Boolean))].sort();

  const filteredNotes = notes.filter((n) => {
    const q = search.trim().toLowerCase();
    const matchesQuery = !q || [n.title, n.description, n.category, n.filename]
      .join(" ")
      .toLowerCase()
      .includes(q);
    const matchesCategory = !search || !search.trim() || !categories.includes(search.trim()) || n.category === search.trim();
    return matchesQuery && matchesCategory;
  });

  const handleCategoryClick = (categoryName) => {
    setSearch(categoryName);
  };

  return (
    <div className="container">
      <h1>Study Notes</h1>

      {!isAdmin && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <label>Search notes or subject</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, category or keyword"
          />
          {categories.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-link"
                onClick={() => setSearch("")}
                style={{ padding: "0.35rem 0.7rem" }}
              >
                All
              </button>
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="btn btn-link"
                  onClick={() => handleCategoryClick(item)}
                  style={{ padding: "0.35rem 0.7rem" }}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <h3>{editingNoteId ? "Edit note" : "Upload a note"}</h3>
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
            <label>Subject / Category</label>
            <input
              list="note-subjects"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Mathematics, Physics, Biology"
            />
            <datalist id="note-subjects">
              <option value="Mathematics" />
              <option value="Physics" />
              <option value="Chemistry" />
              <option value="Biology" />
              <option value="Computer Science" />
              <option value="English" />
              <option value="General" />
            </datalist>
            {!editingNoteId && (
              <>
                <label>File (PDF, doc, image, anything)</label>
                <input type="file" onChange={(e) => setFile(e.target.files[0])} required />
              </>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={isLocked}
                onChange={(e) => setIsLocked(e.target.checked)}
              />
              Lock this note for paid access
            </label>
            <label>Price for unlock (₹)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={priceRupees}
              onChange={(e) => setPriceRupees(e.target.value)}
              disabled={!isLocked}
            />
            {error && <p className="error">{error}</p>}
            <div className="row">
              <button className="btn" disabled={busy}>
                {busy ? (editingNoteId ? "Saving…" : "Uploading…") : editingNoteId ? "Save changes" : "Upload Note"}
              </button>
              {editingNoteId && (
                <button className="btn btn-link" type="button" onClick={cancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : filteredNotes.length === 0 ? (
        <p className="muted">No notes found for this search.</p>
      ) : (
        <div className="grid">
          {filteredNotes.map((n) => (
            <div className="card" key={n.id}>
              <h3>📄 {n.title}</h3>
              {n.category && (
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={() => handleCategoryClick(n.category)}
                  style={{ padding: 0, marginBottom: "0.5rem" }}
                >
                  <p className="muted" style={{ margin: 0 }}>📚 {n.category}</p>
                </button>
              )}
              <p className="muted">{n.description || "—"}</p>
              <div className="meta">
                <span>{n.filename}</span>
                <span>{humanSize(n.size)}</span>
              </div>
              {n.is_locked ? (
                (hasActiveAccess || isAdmin) ? (
                  <p>
                    <span className="badge green">Unlocked</span>
                  </p>
                ) : (
                  <p>
                    <span className="badge danger">Locked</span>
                    <span className="muted" style={{ marginLeft: "0.6rem" }}>subscription required</span>
                  </p>
                )
              ) : (
                <p>
                  <span className="badge">Free</span>
                </p>
              )}
              <div className="row">
                {!isAdmin && n.is_locked && !hasActiveAccess ? (
                  <button className="btn" onClick={startPayment} disabled={paying}>
                    {paying ? "Opening payment…" : "Buy Subscription"}
                  </button>
                ) : (
                  <button
                    className="btn"
                    onClick={() => download(n)}
                    disabled={downloadingId === n.id}
                  >
                    {downloadingId === n.id ? "Downloading…" : "⬇ Download"}
                  </button>
                )}
                {isAdmin && (
                  <>
                    <button className="btn btn-link" type="button" onClick={() => startEdit(n)}>
                      Edit
                    </button>
                    <button className="btn btn-danger" onClick={() => remove(n)}>
                      Delete
                    </button>
                  </>
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
