import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function HomePage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const user = await login(email, password);
      navigate(user.role === "admin" ? "/admin" : "/quizzes");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="hero-section">
      <div className="hero-content">
        <div className="hero-copy">
          <h1>Practice | Analyse | Excel</h1>
          <p>
            Practice engineering aptitude, technical rounds, and placement mock tests
            designed for campus hiring and job-ready preparation.
          </p>
        </div>

        <div className="hero-card hero-login-card">
          <h2>Login</h2>

          <form className="signup-form" onSubmit={submit}>
            <input
              type="email"
              placeholder="Email Id"
              aria-label="Email Id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" className="start-btn" disabled={busy}>
              {busy ? "Logging in…" : "Login"}
            </button>
          </form>

          <div className="login-footer-row">
            <span>New here?</span>
            <Link to="/register" className="register-link">Register</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
