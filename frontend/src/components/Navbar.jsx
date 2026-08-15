import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  const handleLogout = () => {
    logout();
    closeMenu();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <Link to="/" className="brand" onClick={closeMenu}>
        <img src="/logo.svg" alt="Track4u Logo" className="logo-img" />
        <span>Track4u</span>
      </Link>

      <button
        type="button"
        className={`nav-toggle ${isMenuOpen ? "open" : ""}`}
        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`nav-links ${isMenuOpen ? "open" : ""}`}>
        {user ? (
          <>
            <Link to="/course-programs" onClick={closeMenu}>Courses</Link>
            {user.role === "admin" ? (
              <>
                <Link to="/admin" onClick={closeMenu}>Dashboard</Link>
                <Link to="/admin/upload" onClick={closeMenu}>Upload PDF</Link>
                <Link to="/notes" onClick={closeMenu}>Notes</Link>
              </>
            ) : (
              <>
                <Link to="/quizzes" onClick={closeMenu}>Quizzes</Link>
                <Link to="/notes" onClick={closeMenu}>Notes</Link>
              </>
            )}
            <span className="nav-user">
              {user.name} ({user.role})
            </span>
            <button className="btn-link" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/course-programs" onClick={closeMenu}>Courses</Link>
            <Link to="/login" className="nav-btn nav-btn-light" onClick={closeMenu}>
              Login
            </Link>
            <Link to="/register" className="nav-btn nav-btn-primary" onClick={closeMenu}>
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
