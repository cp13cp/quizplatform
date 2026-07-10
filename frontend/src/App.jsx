import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminQuizDetail from "./pages/AdminQuizDetail.jsx";
import AdminUpload from "./pages/AdminUpload.jsx";
import Login from "./pages/Login.jsx";
import Notes from "./pages/Notes.jsx";
import Quizzes from "./pages/Quizzes.jsx";
import Register from "./pages/Register.jsx";
import Result from "./pages/Result.jsx";
import TakeQuiz from "./pages/TakeQuiz.jsx";

function Protected({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin")
    return <Navigate to="/quizzes" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <>
      <Navbar />
      <Routes>
        <Route
          path="/"
          element={
            <Navigate to={user?.role === "admin" ? "/admin" : "/quizzes"} replace />
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/quizzes"
          element={
            <Protected>
              <Quizzes />
            </Protected>
          }
        />
        <Route
          path="/quizzes/:id"
          element={
            <Protected>
              <TakeQuiz />
            </Protected>
          }
        />
        <Route
          path="/result"
          element={
            <Protected>
              <Result />
            </Protected>
          }
        />
        <Route
          path="/notes"
          element={
            <Protected>
              <Notes />
            </Protected>
          }
        />

        <Route
          path="/admin"
          element={
            <Protected adminOnly>
              <AdminDashboard />
            </Protected>
          }
        />
        <Route
          path="/admin/upload"
          element={
            <Protected adminOnly>
              <AdminUpload />
            </Protected>
          }
        />
        <Route
          path="/admin/quizzes/:id"
          element={
            <Protected adminOnly>
              <AdminQuizDetail />
            </Protected>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
