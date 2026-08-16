import { useEffect, useState } from "react";
import api from "../api";

export default function AdminSubscriptions() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_rupees: "",
    duration_days: "",
  });
  const [message, setMessage] = useState("");

  const loadPlans = () => {
    setLoading(true);
    api
      .get("/admin/subscriptions")
      .then(({ data }) => setPlans(data))
      .catch((error) => setMessage(error.response?.data?.detail || "Failed to load plans"))
      .finally(() => setLoading(false));
  };

  useEffect(loadPlans, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!formData.name || !formData.price_rupees || !formData.duration_days) {
      setMessage("Please fill all required fields");
      return;
    }

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        price_rupees: parseInt(formData.price_rupees),
        duration_days: parseInt(formData.duration_days),
      };

      if (editingId) {
        await api.patch(`/admin/subscriptions/${editingId}`, payload);
        setMessage("Plan updated successfully");
      } else {
        await api.post("/admin/subscriptions", payload);
        setMessage("Plan created successfully");
      }

      loadPlans();
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: "", description: "", price_rupees: "", duration_days: "" });
    } catch (error) {
      setMessage(error.response?.data?.detail || "Failed to save plan");
    }
  };

  const handleEdit = (plan) => {
    setEditingId(plan.id);
    setFormData({
      name: plan.name,
      description: plan.description,
      price_rupees: plan.price_rupees.toString(),
      duration_days: plan.duration_days.toString(),
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this subscription plan?")) return;
    try {
      await api.delete(`/admin/subscriptions/${id}`);
      setMessage("Plan deleted successfully");
      loadPlans();
    } catch (error) {
      setMessage(error.response?.data?.detail || "Failed to delete plan");
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: "", description: "", price_rupees: "", duration_days: "" });
  };

  if (loading) return <div className="container">Loading…</div>;

  return (
    <div className="container">
      <div className="quiz-header">
        <h1>Subscription Plans</h1>
        {!showForm && (
          <button className="btn" onClick={() => setShowForm(true)}>
            + Create Plan
          </button>
        )}
      </div>

      {message && (
        <p className={message.includes("successfully") ? "banner success" : "error"}>
          {message}
        </p>
      )}

      {showForm && (
        <section className="card">
          <h2>{editingId ? "Edit Plan" : "Create New Plan"}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Plan Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Basic Plan"
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Plan details and benefits"
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Price (₹) *</label>
              <input
                type="number"
                name="price_rupees"
                value={formData.price_rupees}
                onChange={handleInputChange}
                placeholder="99"
                min="0"
                required
              />
            </div>
            <div className="form-group">
              <label>Duration (Days) *</label>
              <input
                type="number"
                name="duration_days"
                value={formData.duration_days}
                onChange={handleInputChange}
                placeholder="30"
                min="1"
                required
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="btn">
                {editingId ? "Update Plan" : "Create Plan"}
              </button>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {plans.length === 0 ? (
        <p className="muted">No subscription plans yet. Create one to get started.</p>
      ) : (
        <div className="subscriptions-grid">
          {plans.map((plan) => (
            <div key={plan.id} className="card subscription-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "10px" }}>
                <h3>{plan.name}</h3>
                <span className={`badge ${plan.is_active ? "green" : "gray"}`}>
                  {plan.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="muted" style={{ marginBottom: "15px", minHeight: "40px" }}>
                {plan.description}
              </p>
              <div style={{ marginBottom: "15px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>Price:</span>
                  <strong>₹{plan.price_rupees}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Duration:</span>
                  <strong>{plan.duration_days} days</strong>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn-link"
                  onClick={() => handleEdit(plan)}
                  style={{ flex: 1, textAlign: "center" }}
                >
                  Edit
                </button>
                <button
                  className="btn-link error"
                  onClick={() => handleDelete(plan.id)}
                  style={{ flex: 1, textAlign: "center" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .subscriptions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .subscription-card {
          display: flex;
          flex-direction: column;
        }
        .btn-secondary {
          background-color: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-secondary:hover {
          background-color: #5a6268;
        }
        .form-group {
          margin-bottom: 15px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}
