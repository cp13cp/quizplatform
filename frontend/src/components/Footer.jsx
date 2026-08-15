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
          <Link to="/course-programs">Courses</Link>
          <Link to="/quizzes">Quizzes</Link>
          <Link to="/notes">Notes</Link>
          <Link to="/login">Login</Link>
        </div>

        <div className="footer-contact">
          <strong>Contact Us</strong>
          <a href="mailto:track4uhelp@gmail.com">track4uhelp@gmail.com</a>
          <a href="tel:+919399693204">+91 93996 93204</a>
          <span>Based in Hyderabad, India (Fully Remote)</span>
          <span>Mon - Sat, 9:00 AM - 6:00 PM</span>
        </div>

        <div className="footer-meta">© {new Date().getFullYear()} Track4u</div>
      </div>
    </footer>
  );
}
