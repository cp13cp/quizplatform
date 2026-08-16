import { useEffect, useState } from "react";
import api from "../api";

export default function AdminPricing() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    default_price_rupees: "",
    discount_percentage: "",
    discount_active: false,
    tax_percentage: "",
    currency: "INR",
  });
  const [message, setMessage] = useState("");

  const loadConfig = () => {
    setLoading(true);
    api
      .get("/admin/subscriptions-pricing/config")
      .then(({ data }) => {
        setConfig(data);
        setFormData({
          default_price_rupees: data.default_price_rupees.toString(),
          discount_percentage: data.discount_percentage.toString(),
          discount_active: data.discount_active,
          tax_percentage: data.tax_percentage.toString(),
          currency: data.currency,
        });
      })
      .catch((error) => setMessage(error.response?.data?.detail || "Failed to load pricing config"))
      .finally(() => setLoading(false));
  };

  useEffect(loadConfig, []);

  const handleInputChange = (e) => {
    const { name, type, value, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!formData.default_price_rupees || formData.tax_percentage === "" || formData.discount_percentage === "") {
      setMessage("Please fill all required fields");
      return;
    }

    try {
      const payload = {
        default_price_rupees: parseInt(formData.default_price_rupees),
        discount_percentage: parseInt(formData.discount_percentage),
        discount_active: formData.discount_active,
        tax_percentage: parseInt(formData.tax_percentage),
        currency: formData.currency,
      };

      const { data } = await api.patch("/admin/subscriptions-pricing/config", payload);
      setConfig(data);
      setMessage("Pricing configuration updated successfully");
      setEditing(false);
    } catch (error) {
      setMessage(error.response?.data?.detail || "Failed to update pricing");
    }
  };

  if (loading) return <div className="container">Loading…</div>;

  return (
    <div className="container">
      <div className="quiz-header">
        <h1>Subscription Pricing Configuration</h1>
      </div>

      {message && (
        <p className={message.includes("successfully") ? "banner success" : "error"}>
          {message}
        </p>
      )}

      {config && !editing && (
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2>Current Pricing</h2>
            <button className="btn" onClick={() => setEditing(true)}>
              ✎ Edit Pricing
            </button>
          </div>

          <div className="pricing-display">
            <div className="pricing-item">
              <label>Base Price</label>
              <div className="price-value">₹{config.default_price_rupees}</div>
            </div>

            {config.discount_active && (
              <div className="pricing-item">
                <label>Discount</label>
                <div className="price-value" style={{ color: "#28a745" }}>
                  -{config.discount_percentage}%
                </div>
              </div>
            )}

            <div className="pricing-item">
              <label>Effective Price {config.discount_active && "(after discount)"}</label>
              <div className="price-value highlight">
                ₹{config.effective_price_rupees}
              </div>
            </div>

            {config.tax_percentage > 0 && (
              <div className="pricing-item">
                <label>Tax</label>
                <div className="price-value" style={{ color: "#dc3545" }}>
                  +{config.tax_percentage}%
                </div>
              </div>
            )}

            <div className="pricing-item">
              <label>Final Price {config.tax_percentage > 0 && "(with tax)"}</label>
              <div className="price-value highlight final">
                ₹{config.price_with_tax_rupees}
              </div>
            </div>

            <div className="pricing-item">
              <label>Currency</label>
              <div className="price-value">{config.currency}</div>
            </div>

            <div className="pricing-item">
              <label>Last Updated</label>
              <div className="price-value" style={{ fontSize: "14px", color: "#666" }}>
                {new Date(config.updated_at).toLocaleDateString()} by {config.updated_by_email}
              </div>
            </div>
          </div>
        </section>
      )}

      {editing && (
        <section className="card">
          <h2>Edit Pricing Configuration</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Base Price (₹) *</label>
              <input
                type="number"
                name="default_price_rupees"
                value={formData.default_price_rupees}
                onChange={handleInputChange}
                placeholder="99"
                min="0"
                required
              />
            </div>

            <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
              <div style={{ flex: 1 }}>
                <div className="form-group">
                  <label>Discount Percentage (%) *</label>
                  <input
                    type="number"
                    name="discount_percentage"
                    value={formData.discount_percentage}
                    onChange={handleInputChange}
                    placeholder="0"
                    min="0"
                    max="100"
                    required
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      name="discount_active"
                      checked={formData.discount_active}
                      onChange={handleInputChange}
                      style={{ marginRight: "8px" }}
                    />
                    Activate Discount
                  </label>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Tax Percentage (%) *</label>
              <input
                type="number"
                name="tax_percentage"
                value={formData.tax_percentage}
                onChange={handleInputChange}
                placeholder="0"
                min="0"
                max="100"
                required
              />
              <small className="muted">Common: 0%, 5%, 18%, 28%</small>
            </div>

            <div className="form-group">
              <label>Currency *</label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>

            <div className="preview-box">
              <h3>Price Preview</h3>
              <div>
                Base: ₹{formData.default_price_rupees || 0}
                {formData.discount_active && formData.discount_percentage > 0 && (
                  <>
                    {" → "}
                    <strong>After {formData.discount_percentage}% discount: ₹
                      {Math.round(
                        parseInt(formData.default_price_rupees || 0) *
                          (1 - parseInt(formData.discount_percentage) / 100)
                      )}
                    </strong>
                  </>
                )}
                {formData.tax_percentage > 0 && (
                  <>
                    {" → "}
                    <strong>
                      With {formData.tax_percentage}% tax: ₹
                      {Math.round(
                        (parseInt(formData.default_price_rupees || 0) *
                          (1 - (formData.discount_active ? parseInt(formData.discount_percentage) : 0) / 100)) *
                          (1 + parseInt(formData.tax_percentage) / 100)
                      )}
                    </strong>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="btn">
                Save Changes
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditing(false);
                  setFormData({
                    default_price_rupees: config.default_price_rupees.toString(),
                    discount_percentage: config.discount_percentage.toString(),
                    discount_active: config.discount_active,
                    tax_percentage: config.tax_percentage.toString(),
                    currency: config.currency,
                  });
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <style>{`
        .pricing-display {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .pricing-item {
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 4px;
          border-left: 4px solid #17a2b8;
        }
        .pricing-item label {
          display: block;
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
          font-weight: 500;
          text-transform: uppercase;
        }
        .price-value {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }
        .price-value.highlight {
          color: #17a2b8;
          font-size: 28px;
        }
        .price-value.highlight.final {
          color: #28a745;
          font-size: 32px;
          padding: 10px;
          background-color: white;
          border-radius: 4px;
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
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
        }
        .form-group input[type="checkbox"] {
          width: auto;
          margin-right: 8px;
        }
        .form-group small {
          display: block;
          margin-top: 4px;
        }
        .preview-box {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 15px;
          border: 1px solid #dee2e6;
        }
        .preview-box h3 {
          margin: 0 0 10px 0;
          font-size: 14px;
          text-transform: uppercase;
          color: #666;
        }
        .preview-box div {
          font-size: 16px;
          color: #333;
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
      `}</style>
    </div>
  );
}
