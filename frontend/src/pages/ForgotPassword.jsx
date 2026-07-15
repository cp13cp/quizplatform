import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const sendOtp = async () => {
    setError("");
    setMessage("");
    setOtpBusy(true);
    try {
      await api.post("/auth/send-otp", { email });
      setOtpSent(true);
      setMessage("OTP sent to your email. Use it below to reset your password.");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send OTP");
    } finally {
      setOtpBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/reset-password", {
        email,
        otp,
        password,
        confirm_password: confirmPassword,
      });
      setMessage("Password reset successfully. Please login.");
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.detail || "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow">
      <div className="card">
        <h2>Reset Password</h2>
        <form onSubmit={submit}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p className="muted">
            Enter your email and click <strong>Send OTP</strong> to receive a reset code.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={sendOtp}
            disabled={otpBusy || !email}
          >
            {otpBusy ? "Sending OTP…" : "Send OTP"}
          </button>
          {otpSent && <p className="success">OTP sent to {email}</p>}
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
          <label>OTP</label>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            minLength={4}
            maxLength={8}
            required
          />
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
          <button className="btn" disabled={busy || !otpSent}>
            {busy ? "Resetting…" : "Reset Password"}
          </button>
        </form>
        <p className="muted">
          Remembered password? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
