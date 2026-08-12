import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

function buildMiniQuiz() {
  const pool = [
    { question: "2 + 2 = ?", options: ["3", "4", "5", "6"], answer: "4" },
    {
      question: "Which planet is called the Red Planet?",
      options: ["Venus", "Mars", "Mercury", "Jupiter"],
      answer: "Mars",
    },
    {
      question: "How many days are there in a week?",
      options: ["5", "6", "7", "8"],
      answer: "7",
    },
    {
      question: "Which is a prime number?",
      options: ["4", "6", "7", "8"],
      answer: "7",
    },
    {
      question: "What color do you get when you mix blue and yellow?",
      options: ["Red", "Green", "Purple", "Orange"],
      answer: "Green",
    },
  ];

  return [...pool]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((item) => ({
      ...item,
      options: [...item.options].sort(() => Math.random() - 0.5),
    }));
}

function fmtTime(sec) {
  if (!sec) return "No limit";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s ? s + "s" : ""}`.trim();
}

export default function Quizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [miniQuiz, setMiniQuiz] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [access, setAccess] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  const [paying, setPaying] = useState(false);

  const loadAccessStatus = async () => {
    try {
      const { data } = await api.get("/payments/status");
      setAccess(data);
    } catch {
      setPaymentError("Could not check test access. Please refresh or contact support.");
    }
  };

  useEffect(() => {
    setMiniQuiz(buildMiniQuiz());

    const load = async () => {
      try {
        const [quizzesResult, attemptsResult, accessResult] = await Promise.allSettled([
          api.get("/quizzes"),
          api.get("/quizzes/attempts/me"),
          api.get("/payments/status"),
        ]);

        if (quizzesResult.status === "fulfilled") setQuizzes(quizzesResult.value.data);
        if (attemptsResult.status === "fulfilled") setAttempts(attemptsResult.value.data);
        if (accessResult.status === "fulfilled") setAccess(accessResult.value.data);
      } finally {
        setLoading(false);
      }
    };

    load();
    const refreshAccess = setInterval(loadAccessStatus, 15000);
    const onVisible = () => {
      if (!document.hidden) {
        loadAccessStatus();
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(refreshAccess);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const startPayment = async () => {
    setPaymentError("");
    setPaying(true);
    try {
      const { data: order } = await api.post("/payments/order");
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
        name: "Quiz Platform",
        description: "Test access for 30 days",
        order_id: order.order_id,
        prefill: { name: JSON.parse(localStorage.getItem("user") || "{}").name || "" },
        handler: async (response) => {
          try {
            const verified = await api.post("/payments/verify", response);
            setAccess(verified.data);
          } catch (err) {
            setPaymentError(err.response?.data?.detail || "Payment could not be verified.");
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
        theme: { color: "#4f46e5" },
      });
      checkout.open();
    } catch (err) {
      setPaymentError(err.response?.data?.detail || err.message || "Could not start payment.");
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-card">
          <div className="loading-spinner" />
          <h2>Data is loading</h2>
          <p className="muted">
            It may take around 50 seconds to load the data. Meanwhile, try solving
            this short quiz.
          </p>

          <div className="mini-quiz-list">
            {miniQuiz.map((item, index) => (
              <div className="mini-quiz-item" key={`${item.question}-${index}`}>
                <p>{index + 1}. {item.question}</p>
                <div className="mini-options">
                  {item.options.map((option) => (
                    <span className="mini-option" key={`${item.question}-${option}`}>
                      {option}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const completed = new Set(attempts.map((a) => a.quiz_id)).size;
  const avgScore = attempts.length
    ? Math.round(
        attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length
      )
    : 0;
  const bestScore = attempts.length
    ? Math.round(Math.max(...attempts.map((a) => a.percentage)))
    : 0;

  const stats = [
    { label: "Total Quizzes", value: quizzes.length, icon: "📚" },
    { label: "Completed", value: completed, icon: "✅" },
    { label: "Average Score", value: `${avgScore}%`, icon: "📊" },
    { label: "Best Score", value: `${bestScore}%`, icon: "🏆" },
  ];

  const getQuizCategory = (quiz) => {
    const text = `${quiz.title || ""} ${quiz.description || ""}`.toLowerCase();
    return text.includes("aptitude") ? "aptitude" : "technical";
  };

  const filteredQuizzes = quizzes.filter((quiz) => {
    const haystack = `${quiz.title || ""} ${quiz.description || ""}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" ? true : getQuizCategory(quiz) === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container">
      <h1>Dashboard</h1>
      <div className="stats">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon">{s.icon}</div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <h1>Available Quizzes</h1>
      {access && !access.active && (
        <div className="banner warn access-banner">
          <div>
            <strong>Tests are locked</strong>
            <p>Pay ₹{access.price_rupees} to unlock every test for {access.duration_days} days.</p>
          </div>
          <button className="btn" onClick={startPayment} disabled={paying}>
            {paying ? "Opening payment…" : "Unlock for ₹199"}
          </button>
        </div>
      )}
      {access?.active && access.expires_at && (
        <div className="banner success">Test access active until {new Date(access.expires_at).toLocaleDateString()}.</div>
      )}
      {paymentError && <p className="error">{paymentError}</p>}
      <div className="filter-row">
        <input
          type="text"
          placeholder="Search by topic, title, or keyword"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="category-switcher">
          <button
            className={`category-chip ${selectedCategory === "all" ? "active" : ""}`}
            onClick={() => setSelectedCategory("all")}
          >
            All
          </button>
          <button
            className={`category-chip ${selectedCategory === "technical" ? "active" : ""}`}
            onClick={() => setSelectedCategory("technical")}
          >
            Technical
          </button>
          <button
            className={`category-chip ${selectedCategory === "aptitude" ? "active" : ""}`}
            onClick={() => setSelectedCategory("aptitude")}
          >
            Aptitude
          </button>
        </div>
      </div>
      {quizzes.length === 0 && <p className="muted">No published quizzes yet.</p>}
      {filteredQuizzes.length === 0 && quizzes.length > 0 && (
        <p className="muted">No quizzes available in this category right now.</p>
      )}
      <div className="grid">
        {filteredQuizzes.map((q) => (
          <div className="card" key={q.id}>
            <h3>{q.title}</h3>
            <p className="muted">{q.description || "—"}</p>
            <div className="meta">
              <span>❓ {q.question_count} questions</span>
              <span>⏱ {fmtTime(q.time_limit_seconds)}</span>
            </div>
            <div className="row">
              {access?.active ? (
                <Link className="btn" to={`/quizzes/${q.id}`}>Start Quiz</Link>
              ) : (
                <button className="btn" onClick={startPayment} disabled={paying}>🔒 Unlock Test for ₹199</button>
              )}
              <Link className="btn-link" to={`/leaderboard/${q.id}`}>
                🏆 Leaderboard
              </Link>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: "2rem" }}>My Attempts</h2>
      {attempts.length === 0 ? (
        <p className="muted">You haven't attempted any quiz yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Quiz</th>
              <th>Score</th>
              <th>%</th>
              <th>Time</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id}>
                <td>{a.quiz_title}</td>
                <td>
                  {a.score}/{a.total}
                </td>
                <td>{a.percentage}%</td>
                <td>{fmtTime(a.time_taken_seconds)}</td>
                <td>{new Date(a.submitted_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
