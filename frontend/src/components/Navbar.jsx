import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        <img src="/logo.svg" alt="Track4u Logo" className="logo-img" />
        <span>Track4u</span>
      </Link>
      
      <div className="nav-links">
        {user ? (
          <>
            <Link to="/course-programs">Courses</Link>
            {user.role === "admin" ? (
              <>
                <Link to="/admin">Dashboard</Link>
                <Link to="/admin/upload">Upload PDF</Link>
                <Link to="/notes">Notes</Link>
              </>
            ) : (
              <>
                <Link to="/quizzes">Quizzes</Link>
                <Link to="/notes">Notes</Link>
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
            <Link to="/course-programs">Courses</Link>
            <Link to="/login" className="nav-btn nav-btn-light">
              Login
            </Link>
            <Link to="/register" className="nav-btn nav-btn-primary">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
