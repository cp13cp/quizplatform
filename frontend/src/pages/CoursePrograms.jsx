import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext.jsx";

export default function CoursePrograms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([
    {
      id: 1,
      label: "COURSE 01",
      title: "Python Full Stack + AI",
      price: "₹9,999",
      priceAmount: 999900,
      duration: "2 Months",
      schedule: "2 Hours Daily",
      type: "Live Projects",
      features: [
        "Python backend + APIs",
        "Frontend integration",
        "AI fundamentals",
        "Career-ready portfolio"
      ],
      color: "#e8f5e9"
    },
    {
      id: 2,
      label: "COURSE 02",
      title: "MERN Full Stack + AI",
      price: "₹9,999",
      priceAmount: 999900,
      duration: "2 Months",
      schedule: "2 Hours Daily",
      type: "Live Projects",
      features: [
        "MongoDB, Express, React, Node.js",
        "Modern UI development",
        "AI-powered app building",
        "Placement guidance"
      ],
      color: "#e3f2fd"
    },
    {
      id: 3,
      label: "COURSE 03",
      title: "Artificial Intelligence",
      price: "₹9,999",
      priceAmount: 999900,
      duration: "2 Months",
      schedule: "2 Hours Daily",
      type: "Live Projects",
      features: [
        "AI concepts and workflows",
        "Python for AI projects",
        "Model basics and automation",
        "Industry project exposure"
      ],
      color: "#fce4ec"
    }
  ]);

  const [paying, setPaying] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) return;

    const pendingCourse = sessionStorage.getItem("pendingCourse");
    if (!pendingCourse) return;

    try {
      const parsedCourse = JSON.parse(pendingCourse);
      sessionStorage.removeItem("pendingCourse");

      const course = courses.find((item) => item.id === parsedCourse.id) || parsedCourse;
      if (course) {
        handleCoursePayment(course);
      }
    } catch (err) {
      sessionStorage.removeItem("pendingCourse");
    }
  }, [user, courses]);

  const handleCoursePayment = async (course) => {
    if (!user) {
      sessionStorage.setItem("pendingCourse", JSON.stringify(course));
      navigate("/login", { state: { returnTo: "/course-programs", pendingCourse: course } });
      return;
    }

    setError("");
    setSuccess("");
    setPaying(prev => ({ ...prev, [course.id]: true }));

    try {
      // Create order
      const { data: order } = await api.post("/payments/course-order", {
        course_id: course.id,
        course_title: course.title,
        amount: course.priceAmount
      });

      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Could not load payment checkout"));
          document.body.appendChild(script);
        });
      }

      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Track4u Courses",
        description: `${course.title} - ${course.duration}`,
        order_id: order.order_id,
        prefill: { name: JSON.parse(localStorage.getItem("user") || "{}").name || "" },
        handler: async (response) => {
          try {
            const verified = await api.post("/payments/verify-course", {
              ...response,
              course_id: course.id
            });
            setSuccess(`🎉 Successfully enrolled in ${course.title}!`);
            setError("");
          } catch (err) {
            setError(err.response?.data?.detail || "Payment could not be verified.");
          } finally {
            setPaying(prev => ({ ...prev, [course.id]: false }));
          }
        },
        modal: { ondismiss: () => setPaying(prev => ({ ...prev, [course.id]: false })) },
        theme: { color: "#1f9fb5" },
      });
      checkout.open();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Could not start payment.");
      setPaying(prev => ({ ...prev, [course.id]: false }));
    }
  };

  return (
    <div className="container">
      <div className="course-programs-section">
        <h1>Our Course Programs</h1>
        <p className="course-intro">
          Explore industry-focused training paths in Python, full-stack development, and 
          Artificial Intelligence designed for modern career growth.
        </p>

        {success && <p className="banner success">{success}</p>}
        {error && <p className="banner warn">{error}</p>}

        <div className="course-programs-grid">
          {courses.map((course) => (
            <div 
              className="course-program-card" 
              key={course.id}
              style={{ backgroundColor: course.color }}
            >
              <span className="course-label">{course.label}</span>
              <h2 className="course-title">{course.title}</h2>
              
              <div className="course-price-badge">
                {course.price}
              </div>

              <div className="course-meta">
                <span className="course-duration">
                  📅 {course.duration}
                </span>
                <span className="course-schedule">
                  ⏰ {course.schedule}
                </span>
              </div>
              <div style={{ marginBottom: "0.8rem" }}>
                <span className="course-type-badge">
                  {course.type}
                </span>
              </div>

              <ul className="course-features">
                {course.features.map((feature, idx) => (
                  <li key={idx}>• {feature}</li>
                ))}
              </ul>

              <button 
                className="course-btn" 
                onClick={() => handleCoursePayment(course)}
                disabled={paying[course.id]}
              >
                {paying[course.id] ? "Processing..." : `Enroll for ${course.price}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
