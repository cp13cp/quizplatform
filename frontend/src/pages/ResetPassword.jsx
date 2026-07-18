import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("This reset link is invalid.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/reset-password", {
        token,
        password,
        confirm_password: confirmPassword,
      });
      navigate("/login", { state: { message: "Password reset successfully. Please log in." } });
    } catch (err) {
      setError(err.response?.data?.detail || "Could not reset password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow">
      <div className="card">
        <h2>Set New Password</h2>
        <form onSubmit={submit}>
          <label>New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={4}
            required
          />
          <label>Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={4}
            required
          />
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy || !token}>
            {busy ? "Resetting..." : "Reset password"}
          </button>
        </form>
        <p className="muted">
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
