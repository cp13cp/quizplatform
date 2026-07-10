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
  const [marked, setMarked] = useState([]); // marked-for-review flags
  const [current, setCurrent] = useState(0); // current question index
  const [remaining, setRemaining] = useState(null);
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
        setMarked(new Array(data.questions.length).fill(false));
        if (data.time_limit_seconds > 0) setRemaining(data.time_limit_seconds);
        startRef.current = Date.now();
      })
      .catch((err) =>
        setError(err.response?.data?.detail || "Failed to load quiz")
      );
  }, [id]);

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      submitRef.current(true);
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const choose = (oi) =>
    setAnswers((prev) => prev.map((a, i) => (i === current ? oi : a)));

  const clearAnswer = () =>
    setAnswers((prev) => prev.map((a, i) => (i === current ? -1 : a)));

  const toggleMark = () =>
    setMarked((prev) => prev.map((m, i) => (i === current ? !m : m)));

  const go = (i) => setCurrent(Math.max(0, Math.min(i, quiz.questions.length - 1)));

  const handleSubmit = () => {
    const unanswered = answers.filter((a) => a < 0).length;
    if (
      unanswered > 0 &&
      !window.confirm(
        `${unanswered} question(s) are unanswered. Submit anyway?`
      )
    )
      return;
    submit(false);
  };

  if (error && !quiz) return <div className="container error">{error}</div>;
  if (!quiz) return <div className="container">Loading…</div>;

  const q = quiz.questions[current];
  const answeredCount = answers.filter((a) => a >= 0).length;
  const lowTime = remaining !== null && remaining <= 10;

  const statusClass = (i) => {
    if (i === current) return "current";
    if (marked[i]) return "marked";
    if (answers[i] >= 0) return "answered";
    return "";
  };

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

      <div className="take-layout">
        {/* Current question */}
        <div className="card question take-main">
          <div className="quiz-header">
            <h3>
              Question {current + 1} of {quiz.questions.length}
            </h3>
            {marked[current] && <span className="badge orange">Marked</span>}
          </div>
          <p className="q-text">{q.text}</p>
          <div className="options">
            {q.options.map((opt, oi) => (
              <label
                key={oi}
                className={`option ${answers[current] === oi ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name={`q-${current}`}
                  checked={answers[current] === oi}
                  onChange={() => choose(oi)}
                />
                <span>
                  <strong>{String.fromCharCode(65 + oi)}.</strong> {opt}
                </span>
              </label>
            ))}
          </div>

          <div className="take-actions">
            <button
              className="btn-link"
              onClick={clearAnswer}
              disabled={answers[current] < 0}
            >
              Clear
            </button>
            <button className="btn-link" onClick={toggleMark}>
              {marked[current] ? "★ Unmark" : "☆ Mark for review"}
            </button>
            <div className="spacer" />
            <button
              className="btn"
              onClick={() => go(current - 1)}
              disabled={current === 0}
            >
              ← Prev
            </button>
            <button
              className="btn"
              onClick={() => go(current + 1)}
              disabled={current === quiz.questions.length - 1}
            >
              Next →
            </button>
          </div>
        </div>

        {/* Navigator */}
        <div className="card take-nav">
          <h4>Questions</h4>
          <div className="nav-grid">
            {quiz.questions.map((_, i) => (
              <button
                key={i}
                className={`nav-cell ${statusClass(i)}`}
                onClick={() => go(i)}
                title={
                  marked[i]
                    ? "Marked for review"
                    : answers[i] >= 0
                    ? "Answered"
                    : "Not answered"
                }
              >
                {i + 1}
              </button>
            ))}
          </div>
          <ul className="nav-legend">
            <li>
              <span className="dot answered" /> Answered
            </li>
            <li>
              <span className="dot marked" /> Marked
            </li>
            <li>
              <span className="dot" /> Not answered
            </li>
          </ul>
          {error && <p className="error">{error}</p>}
          <button
            className="btn btn-lg"
            disabled={submitting}
            onClick={handleSubmit}
            style={{ width: "100%" }}
          >
            {submitting ? "Submitting…" : "Submit Quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}
