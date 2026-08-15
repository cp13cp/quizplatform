import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
      const u = await login(email, password);
      const pendingCourse = sessionStorage.getItem("pendingCourse");
      const routeState = location.state || {};
      const nextPath = routeState.returnTo || new URLSearchParams(location.search).get("next") || "/course-programs";

      if (pendingCourse || routeState.pendingCourse || nextPath) {
        sessionStorage.removeItem("pendingCourse");
        navigate(nextPath);
      } else {
        navigate(u.role === "admin" ? "/admin" : "/quizzes");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow">
      <div className="card">
        <h2>Login</h2>
        <form onSubmit={submit}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label>Password</label>
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
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
          <button className="btn" disabled={busy}>
            {busy ? "Logging in…" : "Login"}
          </button>
        </form>
        <p className="muted">
          Forgot your password? <Link to="/forgot-password">Reset it here</Link>.
        </p>
        <p className="muted">
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
