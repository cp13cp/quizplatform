import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function Result() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const result = state?.result;

  useEffect(() => {
    if (!result) navigate("/quizzes", { replace: true });
  }, [result, navigate]);

  if (!result) return null;

  const letter = (i) => (i >= 0 ? String.fromCharCode(65 + i) : "—");

  return (
    <div className="container">
      {state?.auto && (
        <div className="banner">⏰ Time's up — your quiz was auto-submitted.</div>
      )}
      <div className="card score-card">
        <h1>{result.quiz_title}</h1>
        <div className="big-score">{result.percentage}%</div>
        <p>
          You scored <strong>{result.score}</strong> out of{" "}
          <strong>{result.total}</strong>
        </p>
        <Link className="btn" to="/quizzes">
          Back to Quizzes
        </Link>
      </div>

      <h2>Review</h2>
      {result.review.map((r, i) => (
        <div
          className={`card question ${r.is_correct ? "correct" : "incorrect"}`}
          key={i}
        >
          <h3>
            {i + 1}. {r.question}
          </h3>
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
                  {isCorrect && " ✅"}
                  {isChosen && !isCorrect && " ❌ (your answer)"}
                </li>
              );
            })}
          </ul>
          {r.correct_index < 0 && (
            <p className="muted">No correct answer was set for this question.</p>
          )}
        </div>
      ))}
    </div>
  );
}
