import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <strong>Track4u</strong>
          <p>Practice, learn, and improve with smart quizzes and notes.</p>
        </div>

        <div className="footer-links">
          <Link to="/quizzes">Quizzes</Link>
          <Link to="/notes">Notes</Link>
          <Link to="/login">Login</Link>
        </div>

        <div className="footer-meta">© {new Date().getFullYear()} Track4u</div>
      </div>
    </footer>
  );
}
