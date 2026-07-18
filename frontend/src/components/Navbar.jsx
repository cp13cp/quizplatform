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
        📝 QuizPlatform
      </Link>
      
      <div className="nav-links">
        {user ? (
          <>
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
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
