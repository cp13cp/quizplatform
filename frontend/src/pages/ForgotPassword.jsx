import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(data.detail);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not send reset link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow">
      <div className="card">
        <h2>Forgot Password</h2>
        <p className="muted">Enter your email and we will send a password-reset link.</p>
        <form onSubmit={submit}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy}>
            {busy ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <p className="muted">
          Remembered your password? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
