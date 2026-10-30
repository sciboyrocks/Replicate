"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Beaker,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Database,
  ExternalLink,
  FlaskConical,
  History,
  Layers3,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Square,
  Terminal,
  TrendingUp,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { base } from "@/lib/models";
import { summarize } from "@/lib/grading";
import research from "@/lib/research.json";
import type { Attempt, Config, Experiment, Model } from "@/lib/types";
type Draft = Omit<Config, "routes">;
type HistoryItem = {
  id: string;
  title: string;
  createdAt: string;
  status: string;
  mode: string;
  completed: number;
  total: number;
};
const defaults: Draft = {
  title: "Hidden analogy · pilot study",
  question:
    "A water treatment plant has many small filters. When one filter becomes blocked, nearby filters increase their flow, causing a cascade of failures. What design principle could prevent this cascade? Answer with the name of the principle only.",
  reference: "Negative feedback",
  rubric:
    "Accept an answer that explicitly proposes negative feedback: reduce or throttle neighboring flow as load rises. Do not accept positive feedback or simply adding capacity.",
  grading: "normalized",
  tolerance: 0.01,
  relativeTolerance: 0,
  models: ["llama32", "qwen354", "gemma431"],
  n: 10,
  mode: "demo",
  temperature: 0.7,
  topP: 0.95,
  seed: null,
  maxTokens: 1024,
  concurrency: 2,
  retries: 2,
  reasoning: "default",
  allowPaid: false,
  judgeModel: "google/gemma-4-31b-it:free",
  judgeProvider: "openrouter",
};
const name = (models: Model[], id: string) => {
  const m = models.find((m) => m.id === id);
  return m ? `${m.name} ${m.size}` : id;
};
const pct = (x: number | null) =>
  x === null ? "—" : `${(x * 100).toFixed(1)}%`;
const fmt = (x: number | null | undefined) =>
  x == null ? "—" : x.toLocaleString();
async function request(url: string, body?: unknown) {
  const r = await fetch("/api/" + url, {
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
export default function Page() {
  const [view, setView] = useState<
    "experiment" | "catalog" | "history" | "method"
  >("experiment");
  const [tab, setTab] = useState<"setup" | "results">("setup");
  const [draft, setDraft] = useState<Draft>(defaults);
  const [models, setModels] = useState<Model[]>(base);
  const [catalogInfo, setCatalogInfo] = useState<{
    checkedAt: string;
    errors: string[];
    credentials: Record<string, boolean>;
  } | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [filter, setFilter] = useState("all");
  const update = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  async function loadCatalog(force = false) {
    setCatalogLoading(true);
    try {
      const c = await request("catalog" + (force ? "?refresh=1" : ""));
      setModels(c.models);
      setCatalogInfo(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Catalog unavailable");
    } finally {
      setCatalogLoading(false);
    }
  }
  async function loadHistory() {
    try {
      setHistory(await request("experiments"));
    } catch {}
  }
  useEffect(() => {
    void loadCatalog();
    void loadHistory();
    try {
      const saved = localStorage.getItem("replicate-draft");
      if (saved) setDraft({ ...defaults, ...JSON.parse(saved) });
    } catch {}
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    localStorage.setItem("replicate-draft", JSON.stringify(draft));
  }, [draft]);
  useEffect(() => {
    if (experiment?.status !== "running") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const e = await request("experiments/" + experiment.id);
        if (!stopped) {
          setExperiment(e);
          if (e.status !== "running") void loadHistory();
        }
      } catch (e) {
        if (!stopped)
          setError(e instanceof Error ? e.message : "Progress refresh failed");
      }
      if (!stopped) timer = setTimeout(poll, 650);
    };
    timer = setTimeout(poll, 400);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [experiment?.id, experiment?.status]);
  async function loadExperiment(id: string) {
    setBusy(true);
    setError("");
    try {
      const e: Experiment = await request("experiments/" + id);
      setExperiment(e);
      const { routes, ...config } = e.config;
      setDraft(config);
      setTab("results");
      setView("experiment");
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot open experiment");
    } finally {
      setBusy(false);
    }
  }
  async function run() {
    setBusy(true);
    setError("");
    try {
      const e = await request("experiments", draft);
      setExperiment(e);
      setTab("results");
      setSelected(null);
      void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start experiment");
    } finally {
      setBusy(false);
    }
  }
  async function action(kind: string) {
    if (!experiment) return;
    setBusy(true);
    setError("");
    try {
      setExperiment(await request(`experiments/${experiment.id}/${kind}`, {}));
      void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }
  async function manual(correct: boolean) {
    if (!experiment || !selected || !overrideReason.trim()) return;
    setBusy(true);
    try {
      setExperiment(
        await request(`experiments/${experiment.id}/override`, {
          attemptId: selected,
          correct,
          reason: overrideReason,
        }),
      );
      setOverrideReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Override failed");
    } finally {
      setBusy(false);
    }
  }
  const newExperiment = () => {
    setExperiment(null);
    setTab("setup");
    setView("experiment");
    setSelected(null);
    setError("");
  };
  const active = experiment?.status === "running";
  const s = experiment
    ? summarize(experiment.attempts, experiment.attempts.length)
    : null;
  const chosen = models.filter((m) => draft.models.includes(m.id));
  const toggleSupported =
    draft.mode === "live" &&
    chosen.length > 0 &&
    chosen.every((m) =>
      m.routes.some(
        (r) =>
          r.available &&
          (draft.allowPaid || r.free) &&
          r.reasoning === "toggle" &&
          r.provider === "openrouter",
      ),
    );
  const selectedAttempt = experiment?.attempts.find((a) => a.id === selected);
  const displayConfig =
    tab === "results" && experiment ? experiment.config : draft;
  const doneCount =
    experiment?.attempts.filter(
      (a) =>
        a.status === "done" || a.status === "error" || a.status === "cancelled",
    ).length || 0;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Replicate home">
          <span className="brand-mark">
            <Layers3 size={21} />
          </span>
          replicate<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">
            <FlaskConical size={17} />
          </span>
          <div>
            <strong>Research workspace</strong>
            <small>Local environment</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {(
            [
              { id: "experiment", icon: Beaker, label: "Experiments" },
              { id: "catalog", icon: Layers3, label: "Model catalog" },
              { id: "history", icon: History, label: "Run history" },
              { id: "method", icon: BookOpen, label: "Methodology" },
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              className={view === id ? "nav-item current" : "nav-item"}
              key={id}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              {label}
              {id === "experiment" && (
                <span className="nav-count">{history.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="recent-heading">
          <span className="nav-caption">RECENT EXPERIMENTS</span>
          <button
            className="icon-button"
            aria-label="New experiment"
            onClick={newExperiment}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="recent-list">
          {history.slice(0, 5).map((e) => (
            <button
              key={e.id}
              onClick={() => void loadExperiment(e.id)}
              className={
                experiment?.id === e.id ? "recent active-recent" : "recent"
              }
            >
              <span className={`tiny-dot ${e.status}`} />
              <span>{e.title}</span>
            </button>
          ))}
          {history.length === 0 && (
            <p className="muted empty-recent">
              Your experiments will
              <br />
              appear here.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="tiny-dot completed" />
            <strong>Local & private</strong>
            <p>
              Experiments stay on this device.
              <br />
              Live prompts go to your provider.
            </p>
            <span>
              <Database size={12} /> File-backed persistence
            </span>
          </div>
          <div className="profile">
            <span>R</span>
            <div>
              <strong>Researcher</strong>
              <small>Personal workspace</small>
            </div>
            <Settings2 size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <span>
              {view === "experiment"
                ? "Experiments"
                : view === "catalog"
                  ? "Model catalog"
                  : view === "history"
                    ? "Run history"
                    : "Methodology"}
            </span>
          </div>
          <div className="top-status">
            <span className="tiny-dot completed" /> Local session
            <span className="divider" />
            <span className="shortcut">v1.0</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">LLM EVALUATION LAB</div>
              <h1>
                {view === "experiment"
                  ? "A better answer starts with evidence."
                  : view === "catalog"
                    ? "Know exactly what you’re testing."
                    : view === "history"
                      ? "Every run. Every result."
                      : "Built for repeatable research."}
              </h1>
              <p>
                {view === "experiment"
                  ? "Ask once. Test independently. Measure what holds up."
                  : view === "catalog"
                    ? "Exact checkpoints, transparent coverage, and provider-backed capabilities."
                    : view === "history"
                      ? "A persistent record of your experiments, ready to revisit."
                      : "A clear protocol from the first request to the final confidence interval."}
              </p>
            </div>
            <button className="button secondary" onClick={newExperiment}>
              <Plus size={16} />
              New experiment
            </button>
          </div>
          {error && (
            <div role="alert" className="error-banner">
              <XCircle size={17} />
              {error}
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {view === "experiment" && (
            <>
              <div className="experiment-title">
                <div>
                  <span className="experiment-icon">
                    <FlaskConical size={19} />
                  </span>
                  <h2>{displayConfig.title}</h2>
                  <span
                    className={`badge ${displayConfig.mode === "demo" ? "amber" : "green"}`}
                  >
                    {displayConfig.mode === "demo"
                      ? "Demo · simulated"
                      : "Live inference"}
                  </span>
                </div>
                <span className="save-status">
                  <ShieldCheck size={14} />
                  {experiment ? "Saved on device" : "Draft saved locally"}
                </span>
              </div>
              <div className="tabs">
                <button
                  onClick={() => setTab("setup")}
                  className={tab === "setup" ? "active" : ""}
                >
                  <Settings2 size={15} />
                  Experiment setup
                </button>
                <button
                  onClick={() => setTab("results")}
                  className={tab === "results" ? "active" : ""}
                >
                  <Activity size={15} />
                  Results
                  {experiment && (
                    <span>
                      {
                        experiment.attempts.filter((a) => a.status === "done")
                          .length
                      }
                    </span>
                  )}
                </button>
                <div className="tabs-end">FRESH CONTEXT · EVERY ATTEMPT</div>
              </div>
              {tab === "setup" ? (
                <div className="setup-grid">
                  <div className="form-stack">
                    <section className="panel">
                      <div className="section-title">
                        <span className="step">01</span>
                        <div>
                          <h3>Define your question</h3>
                          <p>
                            The same prompt is sent independently in every
                            trial.
                          </p>
                        </div>
                        <span className="pill">INPUT</span>
                      </div>
                      <label>
                        Experiment name
                        <input
                          value={draft.title}
                          onChange={(e) => update("title", e.target.value)}
                          maxLength={160}
                        />
                      </label>
                      <label>
                        Question <span className="required">*</span>
                        <textarea
                          className="question-area"
                          value={draft.question}
                          onChange={(e) => update("question", e.target.value)}
                          placeholder="What would you like to evaluate?"
                        />
                      </label>
                      <div className="field-footer">
                        <span>
                          <ShieldCheck size={12} /> Reference and rubric are
                          never sent to the tested model
                        </span>
                        <span>
                          {draft.question.length.toLocaleString()} characters
                        </span>
                      </div>
                      <div className="form-two">
                        <label>
                          Reference answer{" "}
                          {draft.grading !== "semantic" && (
                            <span className="required">*</span>
                          )}
                          <textarea
                            value={draft.reference}
                            onChange={(e) =>
                              update("reference", e.target.value)
                            }
                            placeholder="The expected correct answer"
                          />
                        </label>
                        <label>
                          Grading method
                          <select
                            value={draft.grading}
                            onChange={(e) =>
                              update(
                                "grading",
                                e.target.value as Draft["grading"],
                              )
                            }
                          >
                            <option value="normalized">
                              Normalized exact match
                            </option>
                            <option value="exact">Strict exact match</option>
                            <option value="numeric">Numeric tolerance</option>
                            <option value="semantic">
                              Semantic rubric judge
                            </option>
                          </select>
                          <small className="hint">
                            {draft.grading === "normalized"
                              ? "Ignore case and extra whitespace; preserve punctuation."
                              : draft.grading === "exact"
                                ? "Compare the entire answer, including case and whitespace."
                                : draft.grading === "numeric"
                                  ? "Require a single number; compare absolute or relative error."
                                  : "A separate LLM grades each response against your rubric."}
                          </small>
                        </label>
                      </div>
                      {draft.grading === "numeric" && (
                        <div className="form-two">
                          <label>
                            Absolute tolerance
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={draft.tolerance}
                              onChange={(e) =>
                                update("tolerance", Number(e.target.value))
                              }
                            />
                          </label>
                          <label>
                            Relative tolerance (fraction)
                            <input
                              type="number"
                              min="0"
                              max="1"
                              step=".001"
                              value={draft.relativeTolerance}
                              onChange={(e) =>
                                update(
                                  "relativeTolerance",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </label>
                        </div>
                      )}
                      {draft.grading === "semantic" && (
                        <>
                          <label>
                            Rubric
                            <textarea
                              value={draft.rubric}
                              onChange={(e) => update("rubric", e.target.value)}
                              placeholder="Define what counts as correct. Include partial-answer policy."
                            />
                          </label>
                          <div className="form-two">
                            <label>
                              Judge provider
                              <select
                                value={draft.judgeProvider}
                                onChange={(e) =>
                                  update(
                                    "judgeProvider",
                                    e.target.value as Draft["judgeProvider"],
                                  )
                                }
                              >
                                <option value="openrouter">OpenRouter</option>
                                <option value="vllm">Local vLLM</option>
                              </select>
                            </label>
                            <label>
                              Exact judge model ID
                              <input
                                value={draft.judgeModel}
                                onChange={(e) =>
                                  update("judgeModel", e.target.value)
                                }
                              />
                            </label>
                          </div>
                          <p className="notice">
                            Judge inference uses a separate request and budget.
                            Invalid judge output remains ungraded. Demo
                            responses require manual grading.
                          </p>
                        </>
                      )}
                    </section>
                    <section className="panel">
                      <div className="section-title">
                        <span className="step">02</span>
                        <div>
                          <h3>Select your models</h3>
                          <p>
                            Compare exact checkpoints across model families.
                          </p>
                        </div>
                        <span className="selection-count">
                          {draft.models.length} selected
                        </span>
                      </div>
                      <div className="model-grid">
                        {models.map((m) => {
                          const chosen = draft.models.includes(m.id),
                            routes = m.routes.filter(
                              (r) => r.available && (draft.allowPaid || r.free),
                            );
                          return (
                            <button
                              key={m.id}
                              aria-pressed={chosen}
                              className={`model-card ${chosen ? "chosen" : ""}`}
                              onClick={() =>
                                update(
                                  "models",
                                  chosen
                                    ? draft.models.filter((id) => id !== m.id)
                                    : [...draft.models, m.id],
                                )
                              }
                            >
                              <div className="model-card-top">
                                <span
                                  className={`family-mark ${m.family.toLowerCase()}`}
                                >
                                  {m.family === "Meta"
                                    ? "∞"
                                    : m.family === "Google"
                                      ? "G"
                                      : m.family === "Ai2"
                                        ? "ai²"
                                        : "Q"}
                                </span>
                                <span
                                  className={`checkbox ${chosen ? "checked" : ""}`}
                                >
                                  {chosen && <Check size={12} />}
                                </span>
                              </div>
                              <strong>
                                {m.name} <span>{m.size}</span>
                              </strong>
                              <small>
                                {m.id.startsWith("olmo")
                                  ? "Audit checkpoint"
                                  : m.id === "llama31" && draft.mode === "live"
                                    ? "Cloudflare uses FP8"
                                    : m.family === "Meta"
                                      ? "Instruct"
                                      : "Instruction tuned"}
                              </small>
                              <span
                                className={`model-route ${routes.length ? "connected" : ""}`}
                              >
                                <span className="tiny-dot" />
                                {draft.mode === "demo"
                                  ? "Simulated in demo"
                                  : routes.length
                                    ? `${routes[0].provider} · ${routes[0].free ? "free tier" : "paid"}`
                                    : m.routes.length
                                      ? "Key or paid access needed"
                                      : "Local adapter needed"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setView("catalog")}
                      >
                        Explore provider coverage & checkpoint details
                        <ArrowRight size={13} />
                      </button>
                    </section>
                    <section className="panel">
                      <div className="section-title">
                        <span className="step">03</span>
                        <div>
                          <h3>Set the protocol</h3>
                          <p>
                            Control sampling, execution, and transport recovery.
                          </p>
                        </div>
                      </div>
                      <div className="form-three">
                        <label>
                          Attempts per model (N)
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            value={draft.n}
                            onChange={(e) =>
                              update("n", Number(e.target.value))
                            }
                          />
                        </label>
                        <label>
                          Sampling preset
                          <select
                            value={
                              draft.temperature === 0
                                ? "deterministic"
                                : "stochastic"
                            }
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                temperature:
                                  e.target.value === "deterministic" ? 0 : 0.7,
                                topP:
                                  e.target.value === "deterministic" ? 1 : 0.95,
                                seed:
                                  e.target.value === "deterministic"
                                    ? 42
                                    : null,
                              }))
                            }
                          >
                            <option value="stochastic">
                              Stochastic sampling
                            </option>
                            <option value="deterministic">
                              Deterministic request
                            </option>
                          </select>
                        </label>
                        <label>
                          Reasoning
                          <select
                            value={draft.reasoning}
                            onChange={(e) =>
                              update(
                                "reasoning",
                                e.target.value as Draft["reasoning"],
                              )
                            }
                          >
                            <option value="default">Provider default</option>
                            <option value="on" disabled={!toggleSupported}>
                              On · verified routes only
                            </option>
                            <option value="off" disabled={!toggleSupported}>
                              Off · verified routes only
                            </option>
                          </select>
                        </label>
                      </div>
                      <details className="advanced">
                        <summary>
                          <Settings2 size={14} />
                          Advanced settings
                          <ChevronDown size={14} />
                        </summary>
                        <div className="form-three">
                          <label>
                            Temperature
                            <input
                              type="number"
                              min="0"
                              max="2"
                              step=".1"
                              value={draft.temperature}
                              onChange={(e) =>
                                update("temperature", Number(e.target.value))
                              }
                            />
                          </label>
                          <label>
                            Top-p
                            <input
                              type="number"
                              min=".001"
                              max="1"
                              step=".05"
                              value={draft.topP}
                              onChange={(e) =>
                                update("topP", Number(e.target.value))
                              }
                            />
                          </label>
                          <label>
                            Base seed (optional)
                            <input
                              type="number"
                              min="1"
                              placeholder="Random"
                              value={draft.seed ?? ""}
                              onChange={(e) =>
                                update(
                                  "seed",
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                                )
                              }
                            />
                          </label>
                          <label>
                            Max output tokens
                            <input
                              type="number"
                              min="1"
                              max="32768"
                              value={draft.maxTokens}
                              onChange={(e) =>
                                update("maxTokens", Number(e.target.value))
                              }
                            />
                          </label>
                          <label>
                            Concurrency
                            <input
                              type="number"
                              min="1"
                              max="16"
                              value={draft.concurrency}
                              onChange={(e) =>
                                update("concurrency", Number(e.target.value))
                              }
                            />
                          </label>
                          <label>
                            Transport retries / trial
                            <input
                              type="number"
                              min="0"
                              max="6"
                              value={draft.retries}
                              onChange={(e) =>
                                update("retries", Number(e.target.value))
                              }
                            />
                          </label>
                        </div>
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={draft.allowPaid}
                            onChange={(e) =>
                              update("allowPaid", e.target.checked)
                            }
                          />
                          Allow paid routes and paid judge calls
                        </label>
                        <p className="hint">
                          Trial i uses base seed + i. A seed and temperature 0
                          do not guarantee reproducibility. Retries may consume
                          provider quota and cost. Failover may change provider
                          precision; every route is recorded.
                        </p>
                      </details>
                    </section>
                  </div>
                  <aside className="protocol-column">
                    <div className="protocol-card">
                      <div className="protocol-heading">
                        <span className="green-icon">
                          <FlaskConical size={18} />
                        </span>
                        <h3>Experiment overview</h3>
                      </div>
                      <div className="mode-control">
                        <button
                          onClick={() => update("mode", "demo")}
                          className={draft.mode === "demo" ? "selected" : ""}
                        >
                          Demo
                        </button>
                        <button
                          onClick={() => update("mode", "live")}
                          className={draft.mode === "live" ? "selected" : ""}
                        >
                          Live providers
                        </button>
                      </div>
                      <div className="total-trials">
                        <strong>{draft.models.length * draft.n || 0}</strong>
                        <span>independent trials</span>
                        <div>
                          {draft.models.length} models <X size={11} />
                          {draft.n} attempts
                        </div>
                      </div>
                      <div className="protocol-lines">
                        <div>
                          <span>Grading</span>
                          <strong>
                            {draft.grading === "normalized"
                              ? "Normalized match"
                              : draft.grading === "exact"
                                ? "Exact match"
                                : draft.grading === "numeric"
                                  ? "Numeric tolerance"
                                  : "Semantic judge"}
                          </strong>
                        </div>
                        <div>
                          <span>Context</span>
                          <strong>Fresh per attempt</strong>
                        </div>
                        <div>
                          <span>Output budget</span>
                          <strong>{fmt(draft.maxTokens)} tokens</strong>
                        </div>
                        <div>
                          <span>Parallel requests</span>
                          <strong>{draft.concurrency}</strong>
                        </div>
                        <div>
                          <span>Retry budget</span>
                          <strong>{draft.retries} / trial</strong>
                        </div>
                      </div>
                      <div
                        className={`mode-notice ${draft.mode === "demo" ? "" : "live-notice"}`}
                      >
                        <Zap size={16} />
                        <div>
                          <strong>
                            {draft.mode === "demo"
                              ? "Try the workflow, free."
                              : "Your models. Real requests."}
                          </strong>
                          <p>
                            {draft.mode === "demo"
                              ? "Simulated answers let you explore the full evaluation flow. No API keys needed."
                              : "Only configured exact model routes can run. Credentials stay on your local server."}
                          </p>
                        </div>
                      </div>
                      <button
                        className="button primary run-button"
                        onClick={() => void run()}
                        disabled={
                          busy ||
                          active ||
                          !draft.models.length ||
                          !draft.question.trim()
                        }
                      >
                        {busy ? (
                          <Loader2 className="spin" size={16} />
                        ) : (
                          <Play size={15} fill="currentColor" />
                        )}
                        {active
                          ? "Experiment running"
                          : draft.mode === "demo"
                            ? "Run demo experiment"
                            : "Run experiment"}
                        <ArrowRight size={16} />
                      </button>
                      <small className="run-footnote">
                        {draft.mode === "demo"
                          ? "No model inference · no API cost"
                          : "Provider limits and charges apply"}
                      </small>
                    </div>
                    <div className="research-note">
                      <ShieldCheck size={18} />
                      <h4>Designed for valid comparisons</h4>
                      <p>
                        Every attempt starts with the same question and an empty
                        conversation. Network retries never increase N.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => setView("method")}
                      >
                        Read the methodology
                        <ArrowRight size={13} />
                      </button>
                    </div>
                    <div className="catalog-status">
                      <span
                        className={`tiny-dot ${catalogLoading ? "running" : "completed"}`}
                      />
                      {catalogLoading
                        ? "Checking provider catalogs…"
                        : `Catalog checked ${catalogInfo ? new Date(catalogInfo.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "unavailable"}`}
                      <button
                        className="icon-button"
                        aria-label="Refresh catalog"
                        onClick={() => void loadCatalog(true)}
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </aside>
                </div>
              ) : experiment ? (
                <div className="results-view">
                  <div className="run-banner">
                    <div>
                      <span className={`run-state ${active ? "pulse" : ""}`}>
                        {active ? (
                          <Loader2 className="spin" size={18} />
                        ) : experiment.status === "completed" ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <Circle size={18} />
                        )}
                      </span>
                      <div>
                        <strong>
                          {active
                            ? "Experiment in progress"
                            : experiment.status === "completed"
                              ? "Experiment complete"
                              : `Experiment ${experiment.status}`}
                        </strong>
                        <p>
                          {doneCount} / {experiment.attempts.length} trials
                          settled · {experiment.config.n} independent attempts
                          per model
                          {experiment.config.mode === "demo"
                            ? " · Simulated data"
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="run-actions">
                      {active ? (
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => void action("cancel")}
                        >
                          <Square size={13} />
                          Cancel run
                        </button>
                      ) : (
                        experiment.status !== "completed" && (
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => void action("resume")}
                          >
                            <Play size={14} />
                            Resume remaining
                          </button>
                        )
                      )}
                      <a
                        className="button secondary"
                        href={`/api/experiments/${experiment.id}/export?format=csv`}
                      >
                        <ArrowDownToLine size={14} />
                        CSV
                      </a>
                      <a
                        className="button secondary"
                        href={`/api/experiments/${experiment.id}/export?format=json`}
                      >
                        <ArrowDownToLine size={14} />
                        JSON
                      </a>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{
                        width: `${(doneCount / experiment.attempts.length) * 100}%`,
                      }}
                    />
                  </div>
                  {experiment.config.mode === "demo" && (
                    <div className="demo-ribbon">
                      <Zap size={14} />
                      SIMULATION · Answers and accuracy below are demonstration
                      data, not model performance.
                    </div>
                  )}
                  <div className="metric-grid">
                    <Metric
                      icon={<CheckCircle2 size={17} />}
                      label="CORRECT / PLANNED"
                      value={`${s?.correct} / ${s?.n}`}
                      note={`${s?.judged} graded · ${s?.errors} errors`}
                    />
                    <Metric
                      icon={<TrendingUp size={17} />}
                      label="GRADED ACCURACY"
                      value={pct(s?.accuracy ?? null)}
                      note={`${s?.judged} graded trials; errors excluded`}
                    />
                    <Metric
                      icon={<Clock3 size={17} />}
                      label="MEAN INFERENCE LATENCY"
                      value={
                        s?.latency ? `${(s.latency / 1000).toFixed(2)}s` : "—"
                      }
                      note="Successful inference calls only"
                    />
                    <Metric
                      icon={<Zap size={17} />}
                      label="RECORDED COST"
                      value={
                        s?.cost == null ? "Unknown" : `$${s.cost.toFixed(4)}`
                      }
                      note={`${fmt(s?.tokens)} tokens · judge included`}
                    />
                  </div>
                  <div className="panel comparison">
                    <div className="panel-heading">
                      <div>
                        <h3>Model comparison</h3>
                        <p>Accuracy with 95% Wilson confidence intervals</p>
                      </div>
                      <span className="pill">
                        {experiment.config.grading.toUpperCase()}
                      </span>
                    </div>
                    <div className="comparison-table">
                      <div className="comparison-head">
                        <span>MODEL / CHECKPOINT</span>
                        <span>CORRECT / N</span>
                        <span>ACCURACY & 95% CI</span>
                        <span>LATENCY</span>
                        <span>GRADED</span>
                      </div>
                      {experiment.config.models.map((id, i) => {
                        const a = experiment.attempts.filter(
                            (a) => a.modelId === id,
                          ),
                          stat = summarize(a, experiment.config.n);
                        return (
                          <div className="comparison-row" key={id}>
                            <div>
                              <span className={`model-color color-${i % 4}`} />
                              <strong>{name(models, id)}</strong>
                              <small>
                                {models.find((m) => m.id === id)?.checkpoint}
                              </small>
                            </div>
                            <strong>
                              {stat.correct}
                              <span className="muted"> / {stat.n}</span>
                            </strong>
                            <div className="ci-block">
                              <span>
                                {pct(stat.accuracy)}{" "}
                                <small>
                                  {stat.ci
                                    ? `${pct(stat.ci[0])} – ${pct(stat.ci[1])}`
                                    : "Not yet graded"}
                                </small>
                              </span>
                              <div className="ci-track">
                                {stat.ci && (
                                  <>
                                    <div
                                      className={`ci-range color-${i % 4}`}
                                      style={{
                                        left: `${stat.ci[0] * 100}%`,
                                        width: `${(stat.ci[1] - stat.ci[0]) * 100}%`,
                                      }}
                                    />
                                    <i
                                      style={{
                                        left: `${(stat.accuracy ?? 0) * 100}%`,
                                      }}
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                            <span>
                              {stat.latency
                                ? `${(stat.latency / 1000).toFixed(2)}s`
                                : "—"}
                            </span>
                            <span>
                              {stat.judged} / {stat.n}
                              {stat.errors > 0 && (
                                <small className="error-text">
                                  {stat.errors} errors
                                </small>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="chart-note">
                      CI uses graded trials only. Missing, failed, and ungraded
                      trials remain visible in N. These intervals describe
                      within-prompt repeatability, not general benchmark
                      ability.
                    </p>
                  </div>
                  <div className="panel attempts-panel">
                    <div className="panel-heading">
                      <div>
                        <h3>
                          Individual attempts{" "}
                          <span className="count-badge">
                            {experiment.attempts.length}
                          </span>
                        </h3>
                        <p>
                          Inspect responses, request metadata, and grading
                          decisions.
                        </p>
                      </div>
                      <select
                        aria-label="Filter attempts"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">All attempts</option>
                        <option value="correct">Correct</option>
                        <option value="incorrect">Incorrect</option>
                        <option value="error">Errors</option>
                        <option value="ungraded">Ungraded</option>
                      </select>
                    </div>
                    <div className="attempt-table">
                      <div className="attempt-head">
                        <span>TRIAL</span>
                        <span>MODEL</span>
                        <span>RESPONSE</span>
                        <span>VERDICT</span>
                        <span>TIME</span>
                        <span />
                      </div>
                      {experiment.attempts
                        .filter(
                          (a) =>
                            filter === "all" ||
                            (filter === "error" && a.status === "error") ||
                            (filter === "ungraded" &&
                              a.status === "done" &&
                              a.grade?.correct === null &&
                              !a.override) ||
                            (filter === "correct" &&
                              (a.override?.correct ?? a.grade?.correct) ===
                                true) ||
                            (filter === "incorrect" &&
                              (a.override?.correct ?? a.grade?.correct) ===
                                false),
                        )
                        .map((a) => (
                          <button
                            className="attempt-row"
                            key={a.id}
                            onClick={() => {
                              setSelected(a.id);
                              setOverrideReason("");
                            }}
                          >
                            <span className="trial-index">
                              {String(a.index + 1).padStart(2, "0")}
                            </span>
                            <strong>{name(models, a.modelId)}</strong>
                            <span className="response-preview">
                              {a.response?.text ||
                                a.error ||
                                (a.status === "running"
                                  ? "Generating a fresh response…"
                                  : a.status === "queued"
                                    ? "Waiting for a worker…"
                                    : a.status)}
                            </span>
                            <Verdict a={a} />
                            <span>
                              {a.response
                                ? `${(a.response.latency / 1000).toFixed(2)}s`
                                : "—"}
                            </span>
                            <ChevronRight size={14} />
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <Activity size={32} />
                  <h3>Your evidence will appear here.</h3>
                  <p>
                    Configure your first experiment and run independent trials.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setTab("setup")}
                  >
                    Set up experiment
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </>
          )}
          {view === "catalog" && (
            <div className="catalog-view">
              <div className="catalog-intro">
                <div>
                  <span className="badge green">AUDITED 31 OCT 2026</span>
                  <h2>Your research set, without substitutions.</h2>
                  <p>
                    Eight primary checkpoints and OLMo 3 audit variants. Live
                    OpenRouter routes refresh from its public catalog;
                    Cloudflare routes are documented integrations. A configured
                    key is not a successful inference check.
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => void loadCatalog(true)}
                  disabled={catalogLoading}
                >
                  <RefreshCw
                    size={15}
                    className={catalogLoading ? "spin" : ""}
                  />
                  Refresh live coverage
                </button>
              </div>
              {catalogInfo?.errors.map((e) => (
                <p className="notice" key={e}>
                  {e}
                </p>
              ))}
              <div className="catalog-models">
                {models.map((m) => (
                  <section className="panel catalog-model" key={m.id}>
                    <div className="panel-heading">
                      <div>
                        <span className="eyebrow">
                          {m.family.toUpperCase()} · {m.size}
                        </span>
                        <h3>
                          {m.name} {m.size}
                        </h3>
                      </div>
                      <a
                        className="icon-button"
                        href={m.source}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Official checkpoint for ${m.name}`}
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                    <code>{m.checkpoint}</code>
                    <div className="route-list">
                      {m.note && <p className="notice">{m.note}</p>}
                      {m.routes.length ? (
                        m.routes.map((r) => (
                          <div className="route" key={r.provider + r.model}>
                            <div>
                              <strong>{r.provider}</strong>
                              <span
                                className={`badge ${r.free ? "green" : "gray"}`}
                              >
                                {r.free ? "Free tier / local" : "Paid"}
                              </span>
                              <span
                                className={`tiny-dot ${r.available ? "completed" : ""}`}
                              />
                              <small>
                                {r.available
                                  ? "Configured"
                                  : "Needs server key"}
                              </small>
                            </div>
                            <code>{r.model}</code>
                            <p>
                              Precision: {r.precision} · Reasoning:{" "}
                              {r.reasoning === "toggle"
                                ? "On / off supported"
                                : r.reasoning === "always"
                                  ? "Always on"
                                  : r.reasoning === "none"
                                    ? "Not supported"
                                    : "Unverified; default only"}
                            </p>
                            {r.revision && (
                              <small className="muted">
                                Catalog version: {r.revision}
                              </small>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="muted">
                          No integrated hosted route detected. Use an explicitly
                          mapped local adapter. Hosted research findings are
                          below.
                        </p>
                      )}
                    </div>
                  </section>
                ))}
              </div>
              <div className="section-title providers-title">
                <span className="green-icon">
                  <Layers3 size={18} />
                </span>
                <div>
                  <h3>Provider audit</h3>
                  <p>
                    Recurring free allocation is distinct from starter credit.
                    Signup and an API key are required for every hosted option
                    below.
                  </p>
                </div>
              </div>
              <div className="provider-grid">
                {research.providers.map((p) => (
                  <div className="panel provider-card" key={p.id}>
                    <h3>
                      {p.id === "huggingface"
                        ? "Hugging Face"
                        : p.id === "google"
                          ? "Google AI Studio"
                          : p.id.charAt(0).toUpperCase() + p.id.slice(1)}
                    </h3>
                    <span className="badge gray">
                      {p.classification.replaceAll("-", " ")}
                    </span>
                    <p>
                      {p.id === "openrouter"
                        ? "Gemma 4 31B :free. 20 requests/min, 50/day without a credit purchase. $10 purchased credits enables 1,000/day. Failed requests count."
                        : p.id === "cloudflare"
                          ? "10,000 neurons/day; text generation default 300 requests/min. Llama 3.2 3B and explicitly FP8 Llama 3.1 8B. Shared free allocation."
                          : p.id === "groq"
                            ? "Requested Llama 3.1 8B is currently listed as Enterprise / Contact Sales. No exact free route verified."
                            : p.id === "huggingface"
                              ? "Free users currently receive no included credits. Qwen 3.5 4B is listed via Featherless. The OLMo Instruct page advertises Public AI, but the live API mapping did not confirm it. Neither is a verified recurring free route."
                              : p.id === "publicai"
                                ? "The OLMo Instruct page advertises Public AI; live mapping did not confirm it. Direct Public AI offers $2 starter credit, then paid usage. No direct adapter is claimed."
                                : p.id === "cerebras"
                                  ? "No exact requested checkpoint in the current shared model catalog. Current nearby Qwen sizes are different models."
                                  : "No direct requested Gemma checkpoint verified in the Gemini API catalog. An OpenRouter upstream name does not imply direct API access."}
                    </p>
                    <a
                      className="text-button"
                      href={p.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Official documentation
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          {view === "history" && (
            <div className="panel history-panel">
              <div className="panel-heading">
                <div>
                  <h3>Experiment history</h3>
                  <p>
                    Saved automatically as trials finish. Resume incomplete runs
                    without losing successful responses.
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label="Refresh history"
                  onClick={() => void loadHistory()}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              {history.length ? (
                history.map((h) => (
                  <button
                    className="history-row"
                    key={h.id}
                    onClick={() => void loadExperiment(h.id)}
                  >
                    <span className="experiment-icon">
                      <FlaskConical size={18} />
                    </span>
                    <div>
                      <strong>{h.title}</strong>
                      <small>
                        {new Date(h.createdAt).toLocaleString()} · {h.mode}
                      </small>
                    </div>
                    <span className="badge gray">{h.status}</span>
                    <span>
                      {h.completed} / {h.total} complete
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <History size={30} />
                  <h3>A clean slate.</h3>
                  <p>Run an experiment to build your research history.</p>
                  <button className="button primary" onClick={newExperiment}>
                    Create experiment
                    <Plus size={15} />
                  </button>
                </div>
              )}
            </div>
          )}
          {view === "method" && (
            <div className="method-grid">
              {[
                [
                  "01",
                  "Independent trials",
                  "Each trial sends exactly one user message containing the question. No previous response, reference answer, or grading rubric enters the tested model’s context. Models and trial indices have separate records. Independence of context does not guarantee independent provider random generators or uncached outputs.",
                ],
                [
                  "02",
                  "A transparent denominator",
                  "Correct / N uses the planned trial count. Accuracy and Wilson 95% confidence intervals use graded responses only. Errors and pending grades are reported separately; they are never silently treated as incorrect. An incomplete run must be interpreted alongside its completion rate.",
                ],
                [
                  "03",
                  "Explicit grading rules",
                  "Exact match compares the entire response. Normalized match applies Unicode NFKC, lowercase, trim, and whitespace collapse; punctuation remains. Numeric grading requires a single finite number and accepts error ≤ max(absolute tolerance, relative tolerance × |reference|).",
                ],
                [
                  "04",
                  "Judges and human review",
                  "A semantic judge is a separate model request with the reference and rubric. Its response, usage, model ID, and reasoning are retained. Invalid output stays ungraded. Human overrides record the original automatic verdict, replacement verdict, reason, and timestamp.",
                ],
                [
                  "05",
                  "Recovery without extra trials",
                  "Only connection errors, timeouts, HTTP 408, 429, and 5xx are retried with exponential backoff and jitter. Retries and exact-checkpoint failover are logged inside their trial. If a response already exists and judging fails, resume reuses the response. A crash during a request may incur a charge before that response can be saved.",
                ],
                [
                  "06",
                  "Version and budget honesty",
                  "The same max_tokens is requested for all models. Reasoning may consume this output budget; hiding reasoning is not disabling it. Unknown provider precision and unreported token or cost usage remain unknown. Catalog versions are not immutable weight digests. Zero temperature and seeds cannot guarantee identical output across changing infrastructure.",
                ],
                [
                  "07",
                  "Local storage and credentials",
                  "Experiments are written atomically to local data/*.json files with restrictive permissions. Server-side env variables hold credentials. The app binds to loopback and is intended for one researcher and one server process. Live inference sends the question to providers; semantic judges also receive the rubric and reference.",
                ],
                [
                  "08",
                  "Use the right inference",
                  "Repeated attempts on one prompt measure within-prompt reliability. They do not estimate performance across unseen prompts. Correlated outputs, deterministic decoding, provider caching, and judge bias limit statistical interpretations. Use multiple independent items and report sampling settings in your paper.",
                ],
              ].map(([num, title, body]) => (
                <section className="panel method-card" key={num}>
                  <span className="step">{num}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </section>
              ))}
            </div>
          )}
          <footer>
            <span>
              <Layers3 size={13} />
              replicate research lab
            </span>
            <span>Independent attempts. Transparent evidence.</span>
            <span>
              <span className="tiny-dot completed" />
              Runs locally
            </span>
          </footer>
        </main>
      </div>
      {selectedAttempt && experiment && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <aside
            className="attempt-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Attempt details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <div className="eyebrow">
                  ATTEMPT {String(selectedAttempt.index + 1).padStart(2, "0")}
                </div>
                <h2>{name(models, selectedAttempt.modelId)}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close attempt"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
            </div>
            <Verdict a={selectedAttempt} />
            <h4>Raw text response</h4>
            <pre className="raw-response">
              {selectedAttempt.response?.text ||
                selectedAttempt.error ||
                selectedAttempt.status}
            </pre>
            {selectedAttempt.response?.finishReason === "length" && (
              <p className="notice">
                Output token limit reached. The response may be truncated.
              </p>
            )}
            {selectedAttempt.response?.reasoning && (
              <details>
                <summary>Returned reasoning</summary>
                <pre>{selectedAttempt.response.reasoning}</pre>
              </details>
            )}
            <h4>Grading decision</h4>
            <p className="drawer-prose">
              {selectedAttempt.grade?.reason || "No grade yet."}
            </p>
            {selectedAttempt.override && (
              <div className="notice">
                <strong>
                  Manual override:{" "}
                  {selectedAttempt.override.correct ? "correct" : "incorrect"}
                </strong>
                <p>{selectedAttempt.override.reason}</p>
                <small>
                  {new Date(selectedAttempt.override.at).toLocaleString()}
                </small>
              </div>
            )}
            <div className="metadata-grid">
              {Object.entries({
                Provider: selectedAttempt.response?.provider,
                Model: selectedAttempt.response?.model,
                "Route ID": selectedAttempt.response?.routeModel,
                Version: selectedAttempt.response?.revision,
                Precision: selectedAttempt.response?.precision,
                "Prompt tokens": selectedAttempt.response?.usage.prompt,
                "Output tokens": selectedAttempt.response?.usage.completion,
                "Cost USD": selectedAttempt.response?.usage.cost,
                "Cost basis": selectedAttempt.response?.usage.costSource,
                "Finish reason": selectedAttempt.response?.finishReason,
                "Transport calls": selectedAttempt.transports.length,
              }).map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <strong>{v == null ? "Unknown" : String(v)}</strong>
                </div>
              ))}
            </div>
            {selectedAttempt.status === "done" && (
              <div className="override-box">
                <h4>Manual review</h4>
                <label>
                  Reason for override
                  <input
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Record your reasoning"
                    maxLength={1000}
                  />
                </label>
                <div className="form-two">
                  <button
                    className="button secondary"
                    disabled={busy || !overrideReason.trim()}
                    onClick={() => void manual(true)}
                  >
                    <Check size={14} />
                    Mark correct
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy || !overrideReason.trim()}
                    onClick={() => void manual(false)}
                  >
                    <X size={14} />
                    Mark incorrect
                  </button>
                </div>
              </div>
            )}
            <details>
              <summary>
                Transport log · {selectedAttempt.transports.length} calls
              </summary>
              <pre>{JSON.stringify(selectedAttempt.transports, null, 2)}</pre>
            </details>
            <details>
              <summary>Request & full provider response</summary>
              <pre>{JSON.stringify(selectedAttempt.response, null, 2)}</pre>
            </details>
            {selectedAttempt.grade?.judge && (
              <details>
                <summary>Semantic judge response & usage</summary>
                <pre>
                  {JSON.stringify(selectedAttempt.grade.judge, null, 2)}
                </pre>
              </details>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="metric">
      <div>
        {label}
        <span>{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}
function Verdict({ a }: { a: Attempt }) {
  const correct = a.override?.correct ?? a.grade?.correct;
  if (a.status === "done")
    return (
      <span
        className={`verdict ${correct === true ? "correct" : correct === false ? "incorrect" : "pending"}`}
      >
        {correct === true ? (
          <CheckCircle2 size={12} />
        ) : correct === false ? (
          <XCircle size={12} />
        ) : (
          <Circle size={12} />
        )}{" "}
        {correct === true
          ? "Correct"
          : correct === false
            ? "Incorrect"
            : "Ungraded"}
        {a.override ? " · manual" : ""}
      </span>
    );
  return (
    <span
      className={`verdict ${a.status === "error" ? "incorrect" : "pending"}`}
    >
      {a.status === "running" && <Loader2 size={12} className="spin" />}
      {a.status}
    </span>
  );
}
