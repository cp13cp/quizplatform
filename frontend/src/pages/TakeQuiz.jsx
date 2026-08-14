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
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [tabWarning, setTabWarning] = useState("");

  const startRef = useRef(Date.now());
  const submittedRef = useRef(false);
  const questionRef = useRef(null);
  const tabSwitchCountRef = useRef(0);

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

  useEffect(() => {
    const handleTabLeave = () => {
      if (submittedRef.current) return;

      const nextCount = tabSwitchCountRef.current + 1;
      tabSwitchCountRef.current = nextCount;
      setTabSwitchCount(nextCount);

      const message =
        "Tab switch detected. You left the quiz tab, so the quiz has been auto-submitted.";
      setTabWarning(message);
      setError(message);
      submitRef.current(true);
    };

    const handleVisibility = () => {
      if (document.hidden) handleTabLeave();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleTabLeave);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleTabLeave);
    };
  }, []);

  const choose = (oi) =>
    setAnswers((prev) => prev.map((a, i) => (i === current ? oi : a)));

  const clearAnswer = () =>
    setAnswers((prev) => prev.map((a, i) => (i === current ? -1 : a)));

  const toggleMark = () =>
    setMarked((prev) => prev.map((m, i) => (i === current ? !m : m)));

  const go = (i) => setCurrent(Math.max(0, Math.min(i, quiz.questions.length - 1)));

  // Prevent copying/question text selection inside the question card
  useEffect(() => {
    const el = questionRef.current;
    if (!el) return;
    const prevent = (e) => e.preventDefault();
    el.addEventListener("copy", prevent);
    el.addEventListener("cut", prevent);
    el.addEventListener("contextmenu", prevent);
    el.addEventListener("selectstart", prevent);
    return () => {
      el.removeEventListener("copy", prevent);
      el.removeEventListener("cut", prevent);
      el.removeEventListener("contextmenu", prevent);
      el.removeEventListener("selectstart", prevent);
    };
  }, [questionRef, current]);

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

  const { questionText, codeText } = (() => {
    if (!q || !q.text) return { questionText: "", codeText: "" };
    const t = q.text.trim();
    // Prefer splitting on a blank line (question above, code below)
    const parts = t.split(/\n\s*\n/);
    if (parts.length > 1) {
      return { questionText: parts[0].trim(), codeText: parts.slice(1).join("\n\n").trim() };
    }
    // Otherwise look for a code-like token and split there
    const codeMarker = t.search(/const\s+|let\s+|function\s+|class\s+|console\.|=>|\{|\}/);
    if (codeMarker !== -1) {
      const qPart = t.slice(0, codeMarker).trim();
      const cPart = t.slice(codeMarker).trim();
      if (qPart) return { questionText: qPart, codeText: cPart };
      // fallback: use first line as question, rest as code
      const lines = t.split(/\n/);
      return { questionText: lines[0].trim(), codeText: lines.slice(1).join("\n").trim() };
    }
    return { questionText: t, codeText: "" };
  })();

  const displayCode = (() => {
    if (!codeText) return "";
    // Insert a newline after every semicolon that isn't already followed by a newline.
    // Keep existing newlines intact.
    let s = codeText;
    // semicolons -> newline
    s = s.replace(/;\s*(?!\n)/g, ";\n");
    // comma followed by a function-like token -> newline after comma
    s = s.replace(/,\s*(?=(?:function\b|const\b|let\b|var\b|class\b|[A-Za-z_$][A-Za-z0-9_$]*\s*\(|[A-Za-z_$][A-Za-z0-9_$]*\s*=>))/g, ",\n");
    // closing brace -> newline (if not already)
    s = s.replace(/\}\s*(?![\n,;])/g, "}\n");

    // Remove accidental scanned/page text like "this concept Page 3"
    s = s.replace(/this concept\s*Page\s*\d+/ig, "");
    // Remove repeated blank lines caused by removals
    s = s.replace(/\n{3,}/g, "\n\n");

    // Now add indentation based on brace nesting (display-only)
    const lines = s.split(/\n/);
    let depth = 0;
    const out = [];
    for (let rawLine of lines) {
      let line = rawLine.trim();
      if (!line) {
        out.push("");
        continue;
      }
      // if line starts with closing brace, reduce depth first
      if (/^\}/.test(line)) depth = Math.max(0, depth - 1);
      const indent = "  ".repeat(depth);
      out.push(indent + line);
      // increase depth for lines that contain opening brace (not in same-line close)
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      depth += Math.max(0, opens - closes);
    }
    return out.join("\n");
  })();
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

      {tabSwitchCount === 0 && (
        <div className="tab-warning" role="alert">
          <span>⚠️</span>
          <span>Do not switch tabs. One tab switch will auto-submit the quiz.</span>
        </div>
      )}

      {tabWarning && (
        <div className="tab-warning" role="alert">
          <span>⚠️</span>
          <span>{tabWarning}</span>
          <strong>({tabSwitchCount})</strong>
        </div>
      )}

      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}

      <div className="take-layout">
        {/* Current question */}
        <div className="card question take-main" ref={questionRef}>
          <div className="quiz-header">
            <h3>
              Question {current + 1} of {quiz.questions.length}
            </h3>
            {marked[current] && <span className="badge orange">Marked</span>}
          </div>
          {questionText && <p className="q-text">{questionText}</p>}
          {codeText && <pre className="q-code">{displayCode}</pre>}
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
