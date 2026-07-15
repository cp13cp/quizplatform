import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";

export default function AdminQuizDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [participation, setParticipation] = useState([]);
  const [participationStats, setParticipationStats] = useState(null);
  const [statsDays, setStatsDays] = useState(7);
  const [minutes, setMinutes] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null); // one student's full review
  const [detailUser, setDetailUser] = useState("");

  const loadQuiz = () =>
    api.get(`/admin/quizzes/${id}`).then(({ data }) => {
      setQuiz(data);
      setQuestions(data.questions);
      setTitle(data.title);
      setDescription(data.description);
      setMinutes(data.time_limit_seconds / 60);
    });

  const loadResults = () =>
    api.get(`/admin/quizzes/${id}/results`).then(({ data }) => setResults(data));

  const loadParticipation = () =>
    api
      .get(`/admin/quizzes/${id}/participation`)
      .then(({ data }) => setParticipation(data));

  const loadParticipationStats = (days = statsDays) =>
    api
      .get(`/admin/quizzes/${id}/participation-stats`, {
        params: { days },
      })
      .then(({ data }) => setParticipationStats(data));

  useEffect(() => {
    loadQuiz().catch((e) => setError(e.response?.data?.detail || "Load failed"));
    loadResults().catch(() => {});
    loadParticipation().catch(() => {});
    loadParticipationStats().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const flash = (m) => {
    setMsg(m);
    setError("");
    setTimeout(() => setMsg(""), 2500);
  };

  const saveSettings = async () => {
    try {
      const { data } = await api.patch(`/admin/quizzes/${id}`, {
        title,
        description,
        time_limit_seconds: Math.round(minutes * 60),
      });
      setQuiz(data);
      flash("Settings saved");
    } catch (e) {
      setError(e.response?.data?.detail || "Save failed");
    }
  };

  const togglePublish = async () => {
    try {
      const { data } = await api.patch(`/admin/quizzes/${id}`, {
        is_published: !quiz.is_published,
      });
      setQuiz(data);
      flash(data.is_published ? "Quiz published" : "Quiz unpublished");
    } catch (e) {
      setError(e.response?.data?.detail || "Failed");
    }
  };

  const saveQuestions = async () => {
    try {
      const { data } = await api.put(`/admin/quizzes/${id}/questions`, questions);
      setQuestions(data.questions);
      flash("Questions saved");
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to save questions");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this quiz and all its attempts?")) return;
    await api.delete(`/admin/quizzes/${id}`);
    navigate("/admin");
  };

  const viewAnswers = async (attemptId) => {
    if (detail?.id === attemptId) {
      setDetail(null);
      return;
    }
    const row = results.find((r) => r.id === attemptId);
    setDetailUser(row ? row.user_name : "");
    try {
      const { data } = await api.get(`/admin/attempts/${attemptId}`);
      setDetail(data);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load answers");
    }
  };

  const setCorrect = (qi, oi) =>
    setQuestions((prev) =>
      prev.map((q, i) => (i === qi ? { ...q, correct_index: oi } : q))
    );

  const editQ = (qi, value) =>
    setQuestions((prev) =>
      prev.map((q, i) => (i === qi ? { ...q, text: value } : q))
    );

  const editOpt = (qi, oi, value) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) }
          : q
      )
    );

  const addOption = (qi) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? { ...q, options: [...q.options, `Option ${q.options.length + 1}`] }
          : q
      )
    );

  const removeOption = (qi, oi) =>
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qi) return q;
        if (q.options.length <= 2) return q; // keep at least 2 options
        const options = q.options.filter((_, j) => j !== oi);
        // Re-point the correct answer after removal.
        let correct = q.correct_index;
        if (correct === oi) correct = -1;
        else if (correct > oi) correct -= 1;
        return { ...q, options, correct_index: correct };
      })
    );

  const addQuestion = () =>
    setQuestions((prev) => [
      ...prev,
      {
        text: "New question",
        options: ["Option 1", "Option 2"],
        correct_index: 0,
      },
    ]);

  const removeQuestion = (qi) => {
    if (!window.confirm(`Remove question ${qi + 1}?`)) return;
    setQuestions((prev) => prev.filter((_, i) => i !== qi));
  };

  if (error && !quiz) return <div className="container error">{error}</div>;
  if (!quiz) return <div className="container">Loading…</div>;

  const missingAnswers = questions.filter((q) => q.correct_index < 0).length;
  const attemptedCount = participation.filter((user) => user.has_attempted).length;
  const notAttemptedCount = participation.length - attemptedCount;
  const participationMax = Math.max(attemptedCount, notAttemptedCount, 1);
  const stats = participationStats || {
    total_students: participation.length,
    attempted: attemptedCount,
    not_attempted: notAttemptedCount,
    period_days: statsDays,
    daily: [],
  };

  return (
    <div className="container">
      <div className="quiz-header">
        <h1>{quiz.title}</h1>
        <div className="row">
          <button className="btn" onClick={togglePublish}>
            {quiz.is_published ? "Unpublish" : "Publish"}
          </button>
          <button className="btn btn-danger" onClick={remove}>
            Delete
          </button>
        </div>
      </div>

      {msg && <div className="banner success">{msg}</div>}
      {error && <p className="error">{error}</p>}
      {missingAnswers > 0 && (
        <div className="banner warn">
          ⚠ {missingAnswers} question(s) have no correct answer set. Mark them
          below and save, otherwise they always score 0.
        </div>
      )}

      <div className="card">
        <h3>Settings</h3>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <label>Description</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label>Timer (minutes, 0 = no limit)</label>
        <input
          type="number"
          min={0}
          step={0.5}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        />
        <button className="btn" onClick={saveSettings}>
          Save Settings
        </button>
      </div>

      <div className="quiz-header">
        <h3>Questions ({questions.length})</h3>
        <button className="btn" onClick={saveQuestions}>
          Save Questions
        </button>
      </div>

      {questions.map((q, qi) => (
        <div className="card question" key={qi}>
          <div className="quiz-header">
            <label>Question {qi + 1}</label>
            <button
              className="btn-link danger-link"
              onClick={() => removeQuestion(qi)}
            >
              🗑 Remove question
            </button>
          </div>
          <input value={q.text} onChange={(e) => editQ(qi, e.target.value)} />
          <p className="muted">Select the correct option:</p>
          {q.options.map((opt, oi) => (
            <div className="opt-edit" key={oi}>
              <input
                type="radio"
                name={`correct-${qi}`}
                checked={q.correct_index === oi}
                onChange={() => setCorrect(qi, oi)}
              />
              <span className="opt-letter">{String.fromCharCode(65 + oi)}</span>
              <input
                className="opt-input"
                value={opt}
                onChange={(e) => editOpt(qi, oi, e.target.value)}
              />
              <button
                className="btn-link danger-link"
                title={
                  q.options.length <= 2
                    ? "A question needs at least 2 options"
                    : "Remove this option"
                }
                disabled={q.options.length <= 2}
                onClick={() => removeOption(qi, oi)}
              >
                ✕
              </button>
            </div>
          ))}
          <button className="btn-link" onClick={() => addOption(qi)}>
            + Add option
          </button>
        </div>
      ))}

      <button className="btn" onClick={addQuestion}>
        + Add Question
      </button>{" "}
      <button className="btn" onClick={saveQuestions}>
        Save Questions
      </button>

      <h2 style={{ marginTop: "2rem" }}>Results ({results.length})</h2>
      {results.length === 0 ? (
        <p className="muted">No attempts yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Score</th>
              <th>%</th>
              <th>Time</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id}>
                <td>{r.user_name}</td>
                <td>{r.user_email}</td>
                <td>
                  {r.score}/{r.total}
                </td>
                <td>{r.percentage}%</td>
                <td>
                  {Math.floor(r.time_taken_seconds / 60)}m{" "}
                  {r.time_taken_seconds % 60}s
                </td>
                <td>{new Date(r.submitted_at).toLocaleString()}</td>
                <td>
                  <button className="btn-link" onClick={() => viewAnswers(r.id)}>
                    {detail?.id === r.id ? "Hide" : "View answers"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="card participation-card">
        <h2>Test Participation</h2>
        <p className="muted">All registered users who gave or did not give this test.</p>
        <div className="participation-summary">
          <div className="participation-stat given">
            <strong>{stats.attempted}</strong>
            <span>Test diya</span>
          </div>
          <div className="participation-stat not-given">
            <strong>{stats.not_attempted}</strong>
            <span>Test nahi diya</span>
          </div>
        </div>

        <div className="stats-filter-row">
          <label htmlFor="stats-days">Filter:</label>
          <select
            id="stats-days"
            value={statsDays}
            onChange={(e) => {
              const days = Number(e.target.value);
              setStatsDays(days);
              loadParticipationStats(days).catch(() => {});
            }}
          >
            <option value={1}>Last 1 day</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>

        {participation.length > 0 ? (
          <div className="participation-chart" role="img" aria-label={`${stats.attempted} users gave the test and ${stats.not_attempted} did not`}>
            <div className="chart-row">
              <span className="chart-label">Test diya</span>
              <div className="chart-track"><div className="chart-bar given" style={{ width: `${(stats.attempted / Math.max(stats.total_students, 1)) * 100}%` }} /></div>
              <strong>{stats.attempted}</strong>
            </div>
            <div className="chart-row">
              <span className="chart-label">Nahi diya</span>
              <div className="chart-track"><div className="chart-bar not-given" style={{ width: `${(stats.not_attempted / Math.max(stats.total_students, 1)) * 100}%` }} /></div>
              <strong>{stats.not_attempted}</strong>
            </div>
          </div>
        ) : (
          <p className="muted">No student users registered yet.</p>
        )}

        {participationStats?.daily?.length > 0 && (
          <div className="daily-graph-card">
            <h3>Daily participation ({stats.period_days} day{stats.period_days === 1 ? "" : "s"})</h3>
            <div className="daily-graph">
              {participationStats.daily.map((day) => {
                const dayLabel = new Date(day.date).toLocaleDateString();
                const attemptedPct = Math.round((day.attempted / Math.max(day.total_students, 1)) * 100);
                return (
                  <div className="daily-bar-row" key={dayLabel}>
                    <div className="daily-bar-label">{dayLabel}</div>
                    <div className="daily-bar-track">
                      <div className="daily-bar attempted" style={{ width: `${attemptedPct}%` }} />
                    </div>
                    <div className="daily-bar-count">{day.attempted}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {participation.length > 0 && (
          <div className="user-status-list">
            {participation.map((user) => (
              <div className="user-status" key={user.user_email}>
                <span>{user.user_name} <small>{user.user_email}</small></span>
                <span className={`badge ${user.has_attempted ? "green" : "gray"}`}>
                  {user.has_attempted ? "Test diya" : "Test nahi diya"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {detail && (
        <div className="card">
          <div className="quiz-header">
            <h3>
              Answers — {detailUser} ({detail.score}/{detail.total})
            </h3>
            <button className="btn-link" onClick={() => setDetail(null)}>
              Close ✕
            </button>
          </div>
          {detail.review.map((r, i) => {
            const letter = (idx) =>
              idx >= 0 ? String.fromCharCode(65 + idx) : "—";
            return (
              <div
                className={`card question ${
                  r.is_correct ? "correct" : "incorrect"
                }`}
                key={i}
              >
                <h4>
                  {i + 1}. {r.question}
                </h4>
                <ul className="review-options">
                  {r.options.map((opt, oi) => {
                    const isCorrect = oi === r.correct_index;
                    const isChosen = oi === r.chosen_index;
                    return (
                      <li
                        key={oi}
                        className={`${isCorrect ? "opt-correct" : ""} ${
                          isChosen && !isCorrect ? "opt-wrong" : ""
                        }`}
                      >
                        {letter(oi)}. {opt}
                        {isCorrect && " ✅ correct"}
                        {isChosen && !isCorrect && " ❌ student's answer"}
                      </li>
                    );
                  })}
                </ul>
                {r.chosen_index < 0 && (
                  <p className="muted">Student did not answer this question.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
