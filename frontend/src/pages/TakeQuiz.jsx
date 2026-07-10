import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";

function fmt(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function TakeQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [remaining, setRemaining] = useState(null); // seconds left, null = no limit
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const startRef = useRef(Date.now());
  const submittedRef = useRef(false);

  const submit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      const timeTaken = Math.round((Date.now() - startRef.current) / 1000);
      try {
        const { data } = await api.post(`/quizzes/${id}/submit`, {
          answers,
          time_taken_seconds: timeTaken,
        });
        navigate("/result", { state: { result: data, auto } });
      } catch (err) {
        submittedRef.current = false;
        setError(err.response?.data?.detail || "Submit failed");
        setSubmitting(false);
      }
    },
    [answers, id, navigate]
  );

  // Keep a ref to latest submit so the timer interval always calls the current one.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  useEffect(() => {
    api
      .get(`/quizzes/${id}`)
      .then(({ data }) => {
        setQuiz(data);
        setAnswers(new Array(data.questions.length).fill(-1));
        if (data.time_limit_seconds > 0) setRemaining(data.time_limit_seconds);
        startRef.current = Date.now();
      })
      .catch((err) =>
        setError(err.response?.data?.detail || "Failed to load quiz")
      );
  }, [id]);

  // Countdown timer.
  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      submitRef.current(true);
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const choose = (qi, oi) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[qi] = oi;
      return next;
    });
  };

  if (error && !quiz) return <div className="container error">{error}</div>;
  if (!quiz) return <div className="container">Loading…</div>;

  const answeredCount = answers.filter((a) => a >= 0).length;
  const lowTime = remaining !== null && remaining <= 10;

  return (
    <div className="container">
      <div className="quiz-header">
        <div>
          <h1>{quiz.title}</h1>
          <p className="muted">
            {answeredCount}/{quiz.questions.length} answered
          </p>
        </div>
        {remaining !== null && (
          <div className={`timer ${lowTime ? "timer-danger" : ""}`}>
            ⏱ {fmt(remaining)}
          </div>
        )}
      </div>

      {quiz.questions.map((q, qi) => (
        <div className="card question" key={qi}>
          <h3>
            {qi + 1}. {q.text}
          </h3>
          <div className="options">
            {q.options.map((opt, oi) => (
              <label
                key={oi}
                className={`option ${answers[qi] === oi ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name={`q-${qi}`}
                  checked={answers[qi] === oi}
                  onChange={() => choose(qi, oi)}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      {error && <p className="error">{error}</p>}
      <button className="btn btn-lg" disabled={submitting} onClick={() => submit(false)}>
        {submitting ? "Submitting…" : "Submit Quiz"}
      </button>
    </div>
  );
}
