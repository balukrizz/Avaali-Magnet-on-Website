"use client";
import { useEffect, useState } from "react";

export default function Admin() {
  const [cfg, setCfg] = useState<any>(null);
  const [ucs, setUcs] = useState<any[]>([]);
  const [tab, setTab] = useState<"usecases" | "prompt" | "provider" | "import" | "preview">("usecases");
  const [prompt, setPrompt] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const c = await fetch("/api/admin/config").then((r) => r.json());
    setCfg(c);
    setPrompt(JSON.stringify(c.promptTemplates, null, 2));
    const u = await fetch("/api/usecases").then((r) => r.json());
    setUcs(u.useCases);
  }
  useEffect(() => { load(); }, []);

  async function toggle(id: number, enabled: boolean) {
    await fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggleUseCase", id, enabled }) });
    setUcs((list) => list.map((u) => (u.id === id ? { ...u, enabled } : u)));
  }
  async function savePrompt() {
    try {
      const parsed = JSON.parse(prompt);
      await fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setPrompt", promptTemplates: parsed }) });
      flash("Prompt template saved.");
    } catch { flash("Invalid JSON — not saved."); }
  }
  async function setProvider(provider: string, enabled: boolean) {
    await fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setProvider", provider, enabled }) });
    flash(`Provider set to ${provider} (LLM ${enabled ? "on" : "off"}).`);
    load();
  }
  async function exportCfg() {
    const data = await fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "export" }) }).then((r) => r.json());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "meridian-config-export.json"; a.click();
  }
  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(""), 2600); }

  if (!cfg) return <div className="wrap" style={{ padding: 80 }}>Loading admin…</div>;

  const tabs = [["usecases", "Use Cases"], ["prompt", "Prompt Template"], ["provider", "LLM Provider"], ["import", "Import"], ["preview", "Preview"]] as const;

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 30 }}>Admin Portal</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/" className="btn btn-ghost" style={{ fontSize: 14 }}>← Site</a>
          <button className="btn btn-primary" onClick={exportCfg}>Export configuration</button>
        </div>
      </div>
      <p className="muted" style={{ marginBottom: 20 }}>
        {cfg.stats.totalUseCases} use cases · {cfg.stats.enabled} enabled · provider <b className="mono" style={{ color: "var(--accent)" }}>{cfg.config.llm.provider}</b> (LLM {cfg.config.llm.enabled ? "on" : "off"}) · threshold {cfg.rules.threshold}
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map(([id, label]) => (
          <button key={id} className={`btn ${tab === id ? "btn-primary" : "btn-ghost"}`} style={{ fontSize: 14 }} onClick={() => setTab(id as any)}>{label}</button>
        ))}
      </div>

      {msg && <div className="pill hot" style={{ display: "inline-block", marginBottom: 18 }}>{msg}</div>}

      {tab === "usecases" && (
        <div className="card">
          <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 160px 120px 90px", gap: 12, fontSize: 12, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".05em", paddingBottom: 12, borderBottom: "1px solid var(--line-soft)" }}>
            <span>ID</span><span>Use Case</span><span>Function</span><span>ROI / Pri</span><span>Enabled</span>
          </div>
          {ucs.map((u) => (
            <div key={u.id} style={{ display: "grid", gridTemplateColumns: "60px 1fr 160px 120px 90px", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 14 }}>
              <span className="mono faint">{u.id}</span>
              <span style={{ fontWeight: 600 }}>{u.name}<div className="faint" style={{ fontWeight: 400, fontSize: 12 }}>{u.painPoints?.join(", ")}</div></span>
              <span className="muted">{u.function}</span>
              <span className="mono" style={{ fontSize: 12 }}>{u.roi} / {u.priority}</span>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={u.enabled} onChange={(e) => toggle(u.id, e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
              </label>
            </div>
          ))}
        </div>
      )}

      {tab === "prompt" && (
        <div className="card">
          <p className="muted" style={{ marginBottom: 12, fontSize: 14 }}>Edit the system/user/schema templates. Placeholders like <code className="mono">{"{{candidates}}"}</code> are filled at runtime. Changes apply immediately to new reports.</p>
          <textarea className="inp mono" style={{ minHeight: 420, fontSize: 12.5, lineHeight: 1.5 }} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={savePrompt}>Save prompt template</button>
        </div>
      )}

      {tab === "provider" && (
        <div className="card">
          <p className="muted" style={{ marginBottom: 16, fontSize: 14 }}>Switch the active LLM. Keys are read from environment variables (see <code className="mono">.env.example</code>). Set the model/base URL per provider in <code className="mono">config/config.json</code>.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
            {Object.keys(cfg.config.llm.providers).map((p) => (
              <button key={p} className={`btn ${cfg.config.llm.provider === p ? "btn-primary" : "btn-ghost"}`} onClick={() => setProvider(p, true)}>{p}</button>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="btn btn-ghost" onClick={() => setProvider(cfg.config.llm.provider, !cfg.config.llm.enabled)}>
              {cfg.config.llm.enabled ? "Disable LLM (use deterministic engine)" : "Enable LLM"}
            </button>
          </div>
        </div>
      )}

      {tab === "import" && <Importer onDone={(m) => { flash(m); load(); }} />}
      {tab === "preview" && <Preview />}
    </div>
  );
}

function Importer({ onDone }: { onDone: (m: string) => void }) {
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"json" | "csv">("csv");
  async function submit() {
    const res = await fetch("/api/admin/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format, data: text }) }).then((r) => r.json());
    onDone(res.error ? `Import failed: ${res.error}` : `Imported ${res.imported} · repository now ${res.total}.`);
  }
  function onFile(e: any) {
    const f = e.target.files?.[0]; if (!f) return;
    setFormat(f.name.endsWith(".json") ? "json" : "csv");
    const reader = new FileReader(); reader.onload = () => setText(String(reader.result)); reader.readAsText(f);
  }
  return <div className="card">
    <p className="muted" style={{ marginBottom: 12, fontSize: 14 }}>Import use cases from CSV (Excel → Save As CSV) or JSON. CSV headers: Industry, Business Function, Use Case, Pain Point, AI Objective, Priority, ROI, Complexity, Timeline, Recommended Product, Tags. Use <code className="mono">;</code> to separate multiple values in a cell.</p>
    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
      <select className="sel" style={{ maxWidth: 160 }} value={format} onChange={(e) => setFormat(e.target.value as any)}><option value="csv">CSV</option><option value="json">JSON</option></select>
      <input type="file" accept=".csv,.json" onChange={onFile} style={{ color: "var(--muted)" }} />
    </div>
    <textarea className="inp mono" style={{ minHeight: 220, fontSize: 12.5 }} placeholder={format === "csv" ? "Industry,Business Function,Use Case,Pain Point,AI Objective,Priority,ROI,Complexity,Timeline,Recommended Product,Tags\nBFSI,Finance,Fraud Triage,Manual work;Poor visibility,AI Insights,High,High,Medium,5,AI Insights;Agentic AI,fraud" : '[{"id":9001,"name":"...","function":"Finance","industry":["All"],"painPoints":["Manual work"],"aiObjective":["Reduce Costs"],"difficulty":"Low","implementationMonths":2,"roi":"High","priority":"High","recommendedSolutions":["Workflow Automation"],"tags":[],"enabled":true}]'} value={text} onChange={(e) => setText(e.target.value)} />
    <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={submit}>Import to repository</button>
  </div>;
}

function Preview() {
  const [out, setOut] = useState<any>(null);
  const [a, setA] = useState({ company: "Preview Co", designation: "CFO", industry: "BFSI", orgSize: "5,000 – 25,000", functions: ["Finance"], painPoints: ["Manual work"], objectives: ["Reduce Costs"] });
  async function run() {
    const res = await fetch("/api/recommend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) }).then((r) => r.json());
    setOut(res);
  }
  return <div className="card">
    <p className="muted" style={{ marginBottom: 12, fontSize: 14 }}>Run the rule engine (no LLM) against a sample profile to see which candidates would be sent to the model and their scores.</p>
    <textarea className="inp mono" style={{ minHeight: 160, fontSize: 12.5 }} value={JSON.stringify(a, null, 2)} onChange={(e) => { try { setA(JSON.parse(e.target.value)); } catch {} }} />
    <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={run}>Preview recommendation</button>
    {out && <div style={{ marginTop: 18 }}>
      <div className="faint mono" style={{ fontSize: 12, marginBottom: 10 }}>{out.passed}/{out.evaluated} passed threshold {out.threshold}</div>
      {out.candidates?.map((c: any) => (
        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 14 }}>
          <span>{c.name} <span className="faint">({c.function})</span></span>
          <span className="mono" style={{ color: "var(--accent)" }}>{c.score} <span className="faint">[{c.breakdown.industryMatch}/{c.breakdown.functionMatch}/{c.breakdown.painPointMatch}/{c.breakdown.objectiveMatch}]</span></span>
        </div>))}
    </div>}
  </div>;
}
