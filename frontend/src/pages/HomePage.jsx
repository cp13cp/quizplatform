import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function HomePage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <>
      <section className="hero-section">
        <div className="hero-content">
        <div className="hero-copy">
          <h1>Practice smarter. Crack placements.</h1>
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
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
              />
            </div>
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

      <section className="why-choose-section" aria-labelledby="why-choose-title">
        <div className="why-choose-inner">
          <div className="section-heading">
            <p className="section-kicker">Built for placement readiness</p>
            <h2 id="why-choose-title">Why Choose Us</h2>
            <p>
              Focused preparation tools that help you move from practice to a
              confident placement attempt.
            </p>
          </div>

          <div className="why-choose-grid">
            <article className="why-choose-item">
              <span className="feature-number">01</span>
              <h3>Placement-focused practice</h3>
              <p>Build confidence across aptitude, technical rounds, and mock tests.</p>
            </article>
            <article className="why-choose-item">
              <span className="feature-number">02</span>
              <h3>Clear performance insights</h3>
              <p>Use every attempt to identify strengths and improve weak areas.</p>
            </article>
            <article className="why-choose-item">
              <span className="feature-number">03</span>
              <h3>Job-ready preparation</h3>
              <p>Practice with a structured approach for your campus hiring journey.</p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
