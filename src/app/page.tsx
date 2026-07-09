"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Settings, Sparkles, Target, Map, Cpu as _, ShieldAlert, Gauge, TrendingUp, Layers } from "lucide-react";

type Field = { id: string; label: string; type: string; required?: boolean; options?: string[]; maxSelections?: number; mapsTo: string; placeholder?: string };
type Step = { id: string; title: string; subtitle?: string; fields: Field[] };
type Questionnaire = { title: string; subtitle: string; steps: Step[] };

export default function Home() {
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [view, setView] = useState<"landing" | "wizard" | "loading" | "report">("landing");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [report, setReport] = useState<any>(null);

  useEffect(() => { fetch("/api/questions").then((r) => r.json()).then(setQ); }, []);

  const steps = q?.steps ?? [];
  const progress = steps.length ? ((step + 1) / steps.length) * 100 : 0;

  function setField(f: Field, value: any) {
    setAnswers((a) => ({ ...a, [f.mapsTo]: value }));
    setErrors([]);
  }
  function toggleMulti(f: Field, opt: string) {
    const cur: string[] = answers[f.mapsTo] ?? [];
    if (cur.includes(opt)) setField(f, cur.filter((x) => x !== opt));
    else if (!f.maxSelections || cur.length < f.maxSelections) setField(f, [...cur, opt]);
  }

  function validateStep(): boolean {
    const errs: string[] = [];
    for (const f of steps[step].fields) {
      const v = answers[f.mapsTo];
      if (f.required && (v == null || v === "" || (Array.isArray(v) && v.length === 0))) errs.push(`${f.label} is required.`);
    }
    setErrors(errs);
    return errs.length === 0;
  }

  async function next() {
    if (!validateStep()) return;
    if (step < steps.length - 1) { setStep(step + 1); return; }
    // final step -> generate
    setView("loading");
    const payload = {
      company: answers.company, designation: answers.designation, industry: answers.industry, orgSize: answers.orgSize,
      functions: answers.functions ?? [],
      painPoints: Array.isArray(answers.painPoints) ? answers.painPoints : answers.painPoints ? [answers.painPoints] : [],
      objectives: Array.isArray(answers.objectives) ? answers.objectives : answers.objectives ? [answers.objectives] : [],
    };
    try {
      const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      setReport(data);
      setView("report");
    } catch { setView("wizard"); }
  }

  function restart() { setAnswers({}); setStep(0); setReport(null); setView("landing"); }

  if (!q) return <div className="wrap" style={{ padding: 80 }}>Loading assessment…</div>;

  return (
    <>
      <nav style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(14px)", background: "rgba(10,14,26,.78)", borderBottom: "1px solid var(--line-soft)" }}>
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
          <div style={{ display: "flex", gap: 11, alignItems: "center", fontFamily: "Sora", fontWeight: 700, fontSize: 19 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--grad)" }} /> Meridian
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <a href="/admin" className="btn btn-ghost" style={{ fontSize: 14 }}><Settings size={16} /> Admin</a>
            <button className="btn btn-primary" onClick={() => { setView("wizard"); setStep(0); }}>Start assessment</button>
          </div>
        </div>
      </nav>

      {view === "landing" && <Landing onStart={() => { setView("wizard"); setStep(0); }} q={q} />}

      {view === "wizard" && (
        <div className="wrap" style={{ maxWidth: 720, paddingTop: 40, paddingBottom: 80 }}>
          <div style={{ marginBottom: 34 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }} className="muted">
              <span>{steps[step].title}</span><span className="mono" style={{ color: "var(--accent)" }}>{step + 1} / {steps.length}</span>
            </div>
            <div style={{ height: 6, background: "var(--line-soft)", borderRadius: 6 }}>
              <motion.div animate={{ width: `${progress}%` }} style={{ height: "100%", background: "var(--grad)", borderRadius: 6 }} />
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35 }}>
              <div className="kick" style={{ marginBottom: 12 }}>Step {step + 1}</div>
              <h2 style={{ fontSize: 32, marginBottom: 8 }}>{steps[step].title}</h2>
              {steps[step].subtitle && <p className="muted" style={{ marginBottom: 30, fontSize: 16 }}>{steps[step].subtitle}</p>}
              {steps[step].fields.map((f) => <FieldRender key={f.id} f={f} answers={answers} setField={setField} toggleMulti={toggleMulti} />)}
              {errors.length > 0 && <div style={{ color: "var(--rose)", fontSize: 14, marginTop: 14 }}>{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
            </motion.div>
          </AnimatePresence>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40 }}>
            <button className="btn btn-ghost" onClick={() => step > 0 ? setStep(step - 1) : setView("landing")}>← Back</button>
            <button className="btn btn-primary" onClick={next}>{step === steps.length - 1 ? "Generate my AI report ✦" : "Continue →"}</button>
          </div>
        </div>
      )}

      {view === "loading" && <Loading />}
      {view === "report" && report && <Report r={report} onRestart={restart} />}
    </>
  );
}

function FieldRender({ f, answers, setField, toggleMulti }: any) {
  if (f.type === "text")
    return <div style={{ marginBottom: 24 }}><label style={{ display: "block", fontWeight: 600, marginBottom: 9 }}>{f.label}{f.required && <span style={{ color: "var(--rose)" }}> *</span>}</label>
      <input className="inp" placeholder={f.placeholder} value={answers[f.mapsTo] ?? ""} onChange={(e) => setField(f, e.target.value)} /></div>;
  if (f.type === "select")
    return <div style={{ marginBottom: 24 }}><label style={{ display: "block", fontWeight: 600, marginBottom: 9 }}>{f.label}{f.required && <span style={{ color: "var(--rose)" }}> *</span>}</label>
      <select className="sel" value={answers[f.mapsTo] ?? ""} onChange={(e) => setField(f, e.target.value)}>
        <option value="">Select…</option>{f.options.map((o: string) => <option key={o}>{o}</option>)}
      </select></div>;
  const cur: string[] = f.type === "multiselect" ? (answers[f.mapsTo] ?? []) : [];
  const single = answers[f.mapsTo];
  return (
    <div>
      {f.maxSelections && <div className="faint" style={{ fontSize: 13, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
        <span>Select up to {f.maxSelections}</span><span className="mono" style={{ color: "var(--accent)" }}>{cur.length}/{f.maxSelections}</span></div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {f.options.map((o: string) => {
          const selected = f.type === "multiselect" ? cur.includes(o) : single === o;
          const disabled = f.type === "multiselect" && !selected && f.maxSelections && cur.length >= f.maxSelections;
          return <div key={o} className={`opt${selected ? " sel" : ""}${disabled ? " disabled" : ""}`}
            onClick={() => disabled ? null : f.type === "multiselect" ? toggleMulti(f, o) : setField(f, o)}>
            <span style={{ width: 20, height: 20, borderRadius: f.type === "multiselect" ? 6 : "50%", border: "2px solid var(--line)", background: selected ? "var(--accent)" : "transparent", flexShrink: 0 }} />{o}
          </div>;
        })}
      </div>
    </div>
  );
}

function Loading() {
  const msgs = ["Mapping functions to enterprise use cases…", "Scoring readiness & automation potential…", "Personalizing narrative with AI…"];
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % msgs.length), 1100); return () => clearInterval(t); }, []);
  return <div className="wrap" style={{ maxWidth: 520, textAlign: "center", padding: "120px 24px" }}>
    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.3, ease: "linear" }}
      style={{ width: 70, height: 70, margin: "0 auto 30px", border: "4px solid var(--line-soft)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
    <h2 style={{ fontSize: 26, marginBottom: 12 }}>Generating your report</h2>
    <p className="mono muted" style={{ fontSize: 14 }}>{msgs[i]}</p>
  </div>;
}

function Landing({ onStart, q }: any) {
  return <>
    <header className="wrap" style={{ paddingTop: 80, paddingBottom: 60 }}>
      <span className="pill hot" style={{ display: "inline-block", marginBottom: 24 }}>AI Opportunity Assessment</span>
      <h1 style={{ fontSize: "clamp(38px,5.4vw,62px)", fontWeight: 800, maxWidth: 820, marginBottom: 22 }}>
        Discover your organization's <span style={{ background: "var(--grad)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>AI readiness</span> in under 2 minutes
      </h1>
      <p className="muted" style={{ fontSize: 19, maxWidth: 560, marginBottom: 32 }}>{q.subtitle} Recommendations come only from a curated master repository — never invented by the model.</p>
      <button className="btn btn-primary" onClick={onStart}>Start assessment <ArrowRight size={17} /></button>
    </header>
    <section className="wrap" style={{ paddingBottom: 80 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 22 }}>
        {[[Target, "Rule-engine filtered", "Every use case is scored on industry, function, pain point, and objective. Only strong matches reach the LLM."],
          [Sparkles, "Grounded, never invented", "The LLM ranks and explains — it can only recommend from your master repository."],
          [Map, "Config-driven", "Questionnaires, rules, prompts, and use cases live in JSON. Change behavior with zero code."]].map(([Icon, t, d]: any, i) => (
          <div className="card" key={i}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--accent-soft)", display: "grid", placeItems: "center", marginBottom: 16, color: "var(--accent)" }}><Icon size={22} /></div>
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>{t}</h3><p className="muted" style={{ fontSize: 14.5 }}>{d}</p>
          </div>))}
      </div>
    </section>
  </>;
}

function Report({ r, onRestart }: any) {
  const pdf = () => window.print();
  return <div className="wrap" style={{ maxWidth: 940, paddingTop: 40, paddingBottom: 90 }}>
    <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 30, alignItems: "center", borderRadius: 22, marginBottom: 24 }}>
      <div>
        <div className="kick" style={{ marginBottom: 10 }}>AI Readiness Report</div>
        <h1 style={{ fontSize: 38, marginBottom: 12 }}>{r.company}</h1>
        <span className="pill hot"><Gauge size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />{r.maturity} maturity · for the {r.designation}</span>
        <div className="faint mono" style={{ fontSize: 12, marginTop: 12 }}>
          source: {r.meta?.source} {r.meta?.provider ? `(${r.meta.provider})` : ""} · {r.meta?.candidatesPassed}/{r.meta?.candidatesEvaluated} use cases passed rule engine · confidence {r.confidenceScore}
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 68, background: "linear-gradient(120deg,var(--amber),#ffd97a)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{r.overallReadinessScore}</div>
        <div className="faint mono" style={{ fontSize: 12 }}>/ 100 · Readiness</div>
      </div>
    </div>

    <Block icon={Sparkles} title="Executive summary"><p style={{ fontSize: 16, lineHeight: 1.7 }}>{r.executiveSummary}</p></Block>

    <Block icon={Target} title={`Top ${r.topOpportunities?.length ?? 0} AI opportunities`}>
      {r.topOpportunities?.map((o: any) => (
        <div key={o.id} style={{ border: "1px solid var(--line-soft)", borderRadius: 14, padding: 20, marginBottom: 12, background: "var(--panel-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
            <h4 style={{ fontSize: 16.5 }}>{o.name}</h4>
            <span className="mono" style={{ fontSize: 12, color: "var(--amber)" }}>{o.automationPotential} · ROI {o.estimatedROI}</span>
          </div>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{o.why}</p>
          <div className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>Complexity {o.complexity} · ~{o.timelineMonths} mo · {o.recommendedSolutions?.join(", ")}</div>
        </div>))}
    </Block>

    <Block icon={TrendingUp} title="Business outcomes & KPIs">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div><div className="kick" style={{ marginBottom: 10 }}>Outcomes</div>{r.businessOutcomes?.map((o: string, i: number) => <div key={i} className="muted" style={{ fontSize: 14.5, marginBottom: 6 }}>• {o}</div>)}</div>
        <div><div className="kick" style={{ marginBottom: 10 }}>Expected KPIs</div>{r.expectedKPIs?.map((o: string, i: number) => <div key={i} className="muted" style={{ fontSize: 14.5, marginBottom: 6 }}>• {o}</div>)}</div>
      </div>
    </Block>

    <Block icon={Map} title="18-month roadmap">
      {[["Quick wins", "0–3 months", r.roadmap?.quickWins], ["Medium term", "3–9 months", r.roadmap?.mediumTerm], ["Strategic", "9–18 months", r.roadmap?.strategic]].map(([t, w, items]: any) => (
        <div key={t} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 8 }}><h4 style={{ fontSize: 17 }}>{t}</h4><span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>{w}</span></div>
          {(items ?? []).map((i: string, k: number) => <div key={k} className="muted" style={{ fontSize: 14.5, marginBottom: 5 }}>→ {i}</div>)}
        </div>))}
    </Block>

    <Block icon={Layers} title="Recommended solutions">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{r.technologyRecommendations?.map((s: string) => <span key={s} className="pill hot">{s}</span>)}</div>
    </Block>

    <Block icon={ShieldAlert} title="Risk assessment">
      {r.riskAssessment?.map((s: string, i: number) => <div key={i} className="muted" style={{ fontSize: 14.5, marginBottom: 6 }}>• {s}</div>)}
    </Block>

    <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 34 }}>
      <button className="btn btn-primary" onClick={pdf}>Download PDF</button>
      <button className="btn btn-ghost" onClick={onRestart}>Restart assessment</button>
    </div>
  </div>;
}

function Block({ icon: Icon, title, children }: any) {
  return <div className="card" style={{ borderRadius: 20, marginBottom: 22 }}>
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
      <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center" }}><Icon size={20} /></span>
      <h3 style={{ fontSize: 21 }}>{title}</h3>
    </div>{children}
  </div>;
}
