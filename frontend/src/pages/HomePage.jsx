import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <div className="hero-copy">
          <h1>Practice | Analyse | Excel</h1>
          <p>
            Join the best and most affordable online platform for your banking and
            government exam preparation needs.
          </p>
          <Link to="/register" className="primary-cta">
            Start Free Trial
          </Link>
        </div>

        <div className="hero-card hero-login-card">
          <h2>Login</h2>

          <form className="signup-form">
            <input type="email" placeholder="Email Id" aria-label="Email Id" />
            <input type="password" placeholder="Password" aria-label="Password" />
            <button type="submit" className="start-btn">Login</button>
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
