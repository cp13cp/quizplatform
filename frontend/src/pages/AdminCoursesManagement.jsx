import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function AdminCoursesManagement() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    overview: "",
    duration: "2 Months",
    schedule: "2 Hours Daily",
    price_rupees: 9999,
    features: "",
    color: "#e8f5e9",
  });

  const loadCourses = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/courses");
      setCourses(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    
    try {
      const payload = {
        ...formData,
        price_rupees: parseInt(formData.price_rupees, 10),
        features: formData.features
          .split(",")
          .map(f => f.trim())
          .filter(f => f),
      };

      if (editingId) {
        const { data } = await api.patch(`/admin/courses/${editingId}`, payload);
        setCourses(prev => prev.map(c => c.id === data.id ? data : c));
        setMessage(`✓ Course "${data.title}" updated successfully`);
        setEditingId(null);
      } else {
        const { data } = await api.post("/admin/courses", payload);
        setCourses(prev => [data, ...prev]);
        setMessage(`✓ Course "${data.title}" created successfully`);
      }

      setFormData({
        title: "",
        overview: "",
        duration: "2 Months",
        schedule: "2 Hours Daily",
        price_rupees: 9999,
        features: "",
        color: "#e8f5e9",
      });
      setShowForm(false);
    } catch (error) {
      setMessage(error.response?.data?.detail || "Could not save course");
    }
  };

  const handleEdit = (course) => {
    setEditingId(course.id);
    setFormData({
      title: course.title,
      overview: course.overview,
      duration: course.duration,
      schedule: course.schedule,
      price_rupees: course.price_rupees,
      features: course.features.join(", "),
      color: course.color,
    });
    setShowForm(true);
    setMessage("");
  };

  const handleDelete = async (courseId, courseTitle) => {
    if (!window.confirm(`Delete course "${courseTitle}"? This cannot be undone.`)) return;

    try {
      await api.delete(`/admin/courses/${courseId}`);
      setCourses(prev => prev.filter(c => c.id !== courseId));
      setMessage(`✓ Course deleted`);
    } catch (error) {
      setMessage(error.response?.data?.detail || "Could not delete course");
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      title: "",
      overview: "",
      duration: "2 Months",
      schedule: "2 Hours Daily",
      price_rupees: 9999,
      features: "",
      color: "#e8f5e9",
    });
    setMessage("");
  };

  if (loading) return <div className="container">Loading courses…</div>;

  return (
    <div className="container">
      <div className="quiz-header">
        <h1>Manage Courses</h1>
        <button 
          className="btn" 
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : "+ Add Course"}
        </button>
      </div>

      {message && (
        <p className={`banner ${message.startsWith("✗") ? "error" : "success"}`}>
          {message}
        </p>
      )}

      {showForm && (
        <div className="form-card">
          <h2>{editingId ? "Edit Course" : "Create New Course"}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Course Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Python Full Stack + AI"
                required
              />
            </div>

            <div className="form-group">
              <label>Overview *</label>
              <textarea
                name="overview"
                value={formData.overview}
                onChange={handleInputChange}
                placeholder="Brief course description"
                rows="3"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Duration</label>
                <input
                  type="text"
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  placeholder="e.g., 2 Months"
                />
              </div>
              <div className="form-group">
                <label>Schedule</label>
                <input
                  type="text"
                  name="schedule"
                  value={formData.schedule}
                  onChange={handleInputChange}
                  placeholder="e.g., 2 Hours Daily"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Price (₹)</label>
                <input
                  type="number"
                  name="price_rupees"
                  value={formData.price_rupees}
                  onChange={handleInputChange}
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>Card Color</label>
                <input
                  type="color"
                  name="color"
                  value={formData.color}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Features (comma-separated)</label>
              <textarea
                name="features"
                value={formData.features}
                onChange={handleInputChange}
                placeholder="e.g., Python backend + APIs, Frontend integration, AI fundamentals"
                rows="3"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingId ? "Update Course" : "Create Course"}
              </button>
              <button type="button" className="btn" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {courses.length === 0 ? (
        <p className="muted">No courses yet. Create one to get started.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Price</th>
              <th>Duration</th>
              <th>Features</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id}>
                <td>{course.title}</td>
                <td>₹{course.price_rupees}</td>
                <td>{course.duration}</td>
                <td>{course.features.length} items</td>
                <td>
                  <span className={`badge ${course.is_active ? "green" : "gray"}`}>
                    {course.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => handleEdit(course)}
                    className="btn-link"
                    style={{ marginRight: "0.5rem" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(course.id, course.title)}
                    className="btn-link"
                    style={{ color: "#dc2626" }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb" }}>
        <Link to="/admin" className="btn-link">← Back to Admin Dashboard</Link>
      </div>
    </div>
  );
}
