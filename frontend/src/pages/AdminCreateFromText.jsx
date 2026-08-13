import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

function detectCodeLike(text) {
  if (!text) return false;
  const indicators = ["{", "}", ";", "=>", "function", "console.log", "printf", "System.out", "#include"];
  const lines = text.split(/\r?\n/);
  if (lines.length > 1 && lines.some((l) => l.trim().length > 0)) return true;
  const lower = text.toLowerCase();
  return indicators.some((i) => lower.includes(i));
}

function parseTextToQuestions(text) {
  // Try CSV/TSV: many lines with tabs or commas and multiple columns
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const hasTabs = lines.every((l) => l.includes("\t"));
  const hasCommas = !hasTabs && lines.every((l) => l.split(",").length > 1);
  if (hasTabs || hasCommas) {
    return lines.map((l) => {
      const parts = hasTabs ? l.split("\t") : l.split(",");
      const q = parts[0].trim();
      const opts = parts.slice(1).map((p) => p.trim()).filter(Boolean);
      let correct = -1;
      const cleanOpts = opts.map((o, idx) => {
        let val = o;
        if (val.endsWith("*")) {
          val = val.slice(0, -1).trim();
          correct = idx;
        }
        if (val.toLowerCase().endsWith("(correct)")) {
          val = val.slice(0, -"(correct)".length).trim();
          correct = idx;
        }
        return val;
      });
      return { text: q, options: cleanOpts.length ? cleanOpts : ["Option 1", "Option 2"], correct_index: correct };
    });
  }

  // Split into blocks separated by blank line
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const questions = [];
  for (const block of blocks) {
    const blines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (blines.length === 0) continue;
    let qtext = blines[0];
    const opts = [];
    let correct = -1;
    for (let i = 1; i < blines.length; i++) {
      let line = blines[i];
      // Remove leading labels like 'A)' or '1.' or 'a.'
      if (line.length > 2 && (line[1] === ")" || line[1] === ".")) {
        line = line.slice(2).trim();
      } else if (line.startsWith("- ")) {
        line = line.slice(2).trim();
      }
      if (line.endsWith("*")) {
        line = line.slice(0, -1).trim();
        correct = opts.length;
      }
      if (line.toLowerCase().endsWith("(correct)")) {
        line = line.slice(0, -"(correct)".length).trim();
        correct = opts.length;
      }
      if (line.startsWith("*")) {
        line = line.slice(1).trim();
        correct = opts.length;
      }
      opts.push(line);
    }

    // fallback: if no options parsed, try splitting question line by '|' or ';'
    if (opts.length === 0) {
      if (qtext.includes("|")) {
        const parts = qtext.split("|").map((p) => p.trim()).filter(Boolean);
        if (parts.length > 1) {
          qtext = parts[0];
          for (let i = 1; i < parts.length; i++) {
            let p = parts[i];
            if (p.endsWith("*")) {
              p = p.slice(0, -1).trim();
              if (correct === -1) correct = i - 1;
            }
            opts.push(p);
          }
        }
      } else if (qtext.includes(";")) {
        const parts = qtext.split(";").map((p) => p.trim()).filter(Boolean);
        if (parts.length > 1) {
          qtext = parts[0];
          for (let i = 1; i < parts.length; i++) opts.push(parts[i]);
        }
      }
    }

    questions.push({ text: qtext, options: opts.length ? opts : ["Option 1", "Option 2"], correct_index: correct });
  }
  return questions;
}

export default function AdminCreateFromText() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState(null);

  const doParse = () => {
    setError("");
    try {
      const qs = parseTextToQuestions(text);
      // annotate with code detection
      const annotated = qs.map((q) => ({ ...q, is_code: detectCodeLike(q.text) }));
      setParsed(annotated);
      if (!qs.length) setError("No questions parsed. Check format.");
    } catch (e) {
      setError("Failed to parse text");
    }
  };

  const updateQuestion = (idx, field, value) => {
    setParsed((p) => p.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  };

  const addOption = (qi) => {
    setParsed((p) => p.map((q, i) => (i === qi ? { ...q, options: [...q.options, `Option ${q.options.length + 1}`] } : q)));
  };
  const removeOption = (qi, oi) => {
    setParsed((p) => p.map((q, i) => {
      if (i !== qi) return q;
      const opts = q.options.filter((_, j) => j !== oi);
      let correct = q.correct_index;
      if (correct === oi) correct = -1;
      else if (correct > oi) correct -= 1;
      return { ...q, options: opts, correct_index: correct };
    }));
  };

  const saveParsed = async () => {
    if (!parsed || parsed.length === 0) {
      setError("No parsed questions to save");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const questions = parsed.map((q) => ({ text: q.text, options: q.options, correct_index: q.correct_index ?? -1 }));
      const { data } = await api.post("/admin/quizzes", { title, description, time_limit_seconds: Math.round(minutes * 60), questions });
      navigate(`/admin/quizzes/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow">
      <div className="card">
        <h2>Paste Quiz Text (Preview & Edit)</h2>
        <p className="muted">Paste questions below. Click "Parse" to preview, edit parsed questions if needed, then "Create Quiz".</p>
        <div style={{ marginBottom: "1rem" }}>
          <label>Quiz Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />

          <label>Description</label>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />

          <label>Timer (minutes, 0 = no limit)</label>
          <input type="number" min={0} step={0.5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </div>

        <label>Quiz Text</label>
        <textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Question 1\nA) Option one\nB) Option two *\n\nQuestion 2\n- Option A\n- Option B (correct)`} />
        <div style={{ marginTop: "0.5rem" }}>
          <button className="btn" onClick={doParse}>Parse</button>
          <button className="btn" style={{ marginLeft: "0.5rem" }} onClick={() => { setText(''); setParsed(null); }}>Clear</button>
        </div>

        {error && <p className="error">{error}</p>}

        {parsed && (
          <div style={{ marginTop: "1rem" }}>
            <h3>Preview ({parsed.length} questions)</h3>
            {parsed.map((q, i) => (
              <div className="card question" key={i} style={{ marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>Q{i + 1}</strong>
                  <span className="muted">{q.is_code ? "Code" : "Text"}</span>
                </div>
                <textarea rows={q.is_code ? 6 : 2} value={q.text} onChange={(e) => updateQuestion(i, 'text', e.target.value)} />
                <div style={{ marginTop: "0.5rem" }}>
                  {q.options.map((opt, oi) => (
                    <div key={oi} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <input type="radio" name={`correct-${i}`} checked={q.correct_index === oi} onChange={() => updateQuestion(i, 'correct_index', oi)} />
                      <input value={opt} onChange={(e) => {
                        const val = e.target.value;
                        setParsed((p) => p.map((qq, idx) => idx === i ? { ...qq, options: qq.options.map((o, j) => j === oi ? val : o) } : qq));
                      }} />
                      <button className="btn-link danger-link" onClick={() => removeOption(i, oi)} disabled={q.options.length <= 2}>✕</button>
                    </div>
                  ))}
                  <div>
                    <button className="btn-link" onClick={() => addOption(i)}>+ Add option</button>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: "1rem" }}>
              <button className="btn" onClick={saveParsed} disabled={busy}>{busy ? "Creating…" : "Create Quiz"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
