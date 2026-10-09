import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ShieldCheck,
  Activity,
  ArrowUpRight,
  BarChart3,
  Radio,
  LockKeyhole,
  FileClock,
  Settings2,
  Play,
  Square,
  Mic,
  Upload,
  Check,
  X,
  AlertTriangle,
  Download,
  Link2,
  Github,
  ChevronRight,
  Headphones,
  CircleHelp,
  Fingerprint,
  RotateCcw,
  Server,
  Wallet,
  CheckCheck,
} from "lucide-react";
import { scenarios, demoSample, demoDecision, demoExecute } from "./demo";
import "./styles.css";
import benchmark from "../../evaluation/benchmark.json";

const money = (paise) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
const statusName = (value) =>
  ({
    model_unavailable: "Model unavailable",
    model_error: "Model error",
    silence: "No speech detected",
    buffering: "Collecting audio",
    high_risk: "Elevated risk",
    monitoring: "Monitoring",
    idle: "Awaiting a call",
  })[value] || value;
const fmtTime = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
function download(name, data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Tag({ children, tone = "" }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
function App() {
  const modalRef = useRef(null);
  const [view, setView] = useState("monitor");
  const [mode, setMode] = useState("demo");
  const [scenario, setScenario] = useState("impersonation");
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [risk, setRisk] = useState(null);
  const [series, setSeries] = useState([]);
  const [audioStatus, setAudioStatus] = useState("idle");
  const [latency, setLatency] = useState(null);
  const [call, setCall] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [events, setEvents] = useState([]);
  const [chain, setChain] = useState(null);
  const [modal, setModal] = useState(false);
  const [amount, setAmount] = useState("800000");
  const [beneficiary, setBeneficiary] = useState("Northstar Supplies · DEMO");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [apiBase, setApiBase] = useState("");
  const [token, setToken] = useState("");
  const [approverToken, setApproverToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [role, setRole] = useState("operator");
  const [now, setNow] = useState(Date.now());
  const media = useRef(null),
    socket = useRef(null),
    processor = useRef(null),
    context = useRef(null),
    source = useRef(null),
    callRef = useRef(null),
    stopping = useRef(false),
    fileInput = useRef(null);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const nodes = modalRef.current?.querySelectorAll(
        "button:not(:disabled),input:not(:disabled)",
      );
      if (!nodes?.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [modal]);
  const high = risk !== null && risk >= 0.8;
  const pending = transfers.filter((t) => t.status === "pending").length;
  const addEvent = (event, details = {}) =>
    setEvents((old) => [
      ...old,
      {
        seq: old.length + 1,
        timestamp: Date.now() / 1000,
        actor: "demo",
        event,
        details,
      },
    ]);
  const api = async (path, method = "GET", body, credential = token) => {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${credential}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : "Request rejected. Check the entered values.",
      );
    return data;
  };
  const refresh = async () => {
    const [ts, log] = await Promise.all([api("/transfers"), api("/audit")]);
    setTransfers(ts);
    setEvents(log.events);
    setChain(log.chain_valid);
  };
  const act = async (fn) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  const closeMedia = () => {
    socket.current?.close();
    socket.current = null;
    processor.current?.disconnect();
    processor.current = null;
    source.current?.disconnect();
    source.current = null;
    media.current?.getTracks().forEach((t) => t.stop());
    media.current = null;
    context.current?.close().catch(() => {});
    context.current = null;
  };
  const finish = async () => {
    if (stopping.current) return;
    stopping.current = true;
    closeMedia();
    setActive(false);
    setAudioStatus("idle");
    const current = callRef.current;
    callRef.current = null;
    try {
      if (mode === "live" && current) {
        await api(`/calls/${current.id}/stop`, "POST");
        await refresh();
      } else if (current) addEvent("call.ended", { call_id: current.id });
    } finally {
      stopping.current = false;
    }
  };
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      closeMedia();
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setElapsed((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
  useEffect(() => {
    if (!active || mode !== "demo") return;
    let tick = 0;
    const timer = setInterval(() => {
      const point = demoSample(scenario, tick++);
      setRisk(point.risk);
      setAudioStatus(point.risk >= 0.8 ? "high_risk" : "monitoring");
      setSeries((old) => [...old, point.risk].slice(-120));
      if (tick === 36 && scenario === "impersonation")
        addEvent("call.high_risk", { risk: point.risk, source: "simulation" });
    }, 200);
    return () => clearInterval(timer);
  }, [active, mode, scenario]);
  useEffect(() => {
    if (mode !== "live" || !connected) return;
    const timer = setInterval(
      () => refresh().catch((e) => setError(e.message)),
      3000,
    );
    return () => clearInterval(timer);
  }, [mode, connected, apiBase, token]);
  useEffect(() => {
    if (mode === "demo")
      setTransfers((ts) =>
        ts.map((t) =>
          ["pending", "approved"].includes(t.status) && t.expires * 1000 <= now
            ? { ...t, status: "expired" }
            : t,
        ),
      );
  }, [now, mode]);
  const startDemo = () => {
    setRisk(null);
    setSeries([]);
    setElapsed(0);
    setLatency(null);
    setAudioStatus("buffering");
    const c = { id: crypto.randomUUID(), label: scenarios[scenario].title };
    setCall(c);
    callRef.current = c;
    setActive(true);
    addEvent("call.started", { call_id: c.id, scenario, source: "simulation" });
  };
  const startAudio = async (file) => {
    if (!connected)
      throw new Error("Connect the local gateway in Settings first.");
    if (role !== "operator")
      throw new Error("Use an operator credential to start calls.");
    try {
      const ctx = new AudioContext({ sampleRate: 16000 });
      context.current = ctx;
      await ctx.resume();
      if (ctx.sampleRate !== 16000)
        throw new Error(
          "This browser cannot capture at 16 kHz. Try a current desktop browser.",
        );
      let src;
      if (file) {
        if (file.size > 25 * 1024 * 1024)
          throw new Error("Choose an audio file under 25 MB.");
        const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
        if (buffer.duration > 180)
          throw new Error("Choose a recording up to 3 minutes.");
        src = ctx.createBufferSource();
        src.buffer = buffer;
      } else {
        media.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        src = ctx.createMediaStreamSource(media.current);
      }
      source.current = src;
      const c = await api("/calls", "POST", {
        label: file ? "Uploaded audio playback" : "Live microphone",
      });
      setCall(c);
      callRef.current = c;
      const wsUrl = new URL(
        `${apiBase.replace(/\/$/, "")}/api/audio/${c.id}`,
        location.origin,
      );
      wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(wsUrl);
      socket.current = ws;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Audio connection timed out.")),
          8000,
        );
        ws.onopen = () => ws.send(JSON.stringify({ token }));
        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Audio gateway is unreachable."));
        };
        ws.onclose = () => {
          clearTimeout(timeout);
          reject(new Error("Audio connection rejected."));
        };
        ws.onmessage = (e) => {
          const d = JSON.parse(e.data);
          if (d.status === "ready") {
            clearTimeout(timeout);
            resolve();
          }
        };
      });
      ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        setAudioStatus(d.status);
        setRisk(d.risk);
        setLatency(d.inference_ms);
        setSeries((old) => [...old, d.risk].slice(-120));
      };
      ws.onclose = () => {
        if (!stopping.current) {
          closeMedia();
          setActive(false);
          setAudioStatus("idle");
          setError("Audio stream closed. Start a new call to reconnect.");
        }
      };
      await ctx.audioWorklet.addModule(
        `${import.meta.env.BASE_URL}pcm-worklet.js`,
      );
      const node = new AudioWorkletNode(ctx, "pcm-capture");
      processor.current = node;
      node.port.onmessage = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          if (ws.bufferedAmount > 128000) {
            setError("Audio network buffer full. Call stopped.");
            finish().catch((e) => setError(e.message));
            return;
          }
          ws.send(e.data);
        }
      };
      src.connect(node);
      node.connect(ctx.destination);
      setSeries([]);
      setRisk(null);
      setLatency(null);
      setElapsed(0);
      setAudioStatus("buffering");
      setActive(true);
      if (file) {
        src.onended = () => finish().catch((e) => setError(e.message));
        src.start();
      }
      await refresh();
    } catch (e) {
      closeMedia();
      setActive(false);
      const current = callRef.current;
      callRef.current = null;
      if (current)
        await api(`/calls/${current.id}/stop`, "POST").catch(() => {});
      throw e;
    }
  };
  const requestTransfer = async (e) => {
    e.preventDefault();
    await act(async () => {
      const paise = Math.round(Number(amount) * 100);
      if (!Number.isSafeInteger(paise) || paise <= 0 || paise > 10000000000)
        throw new Error("Enter an amount between ₹0.01 and ₹10 crore.");
      if (!active || !call)
        throw new Error("Start a call before requesting a transaction.");
      if (mode === "live") {
        await api("/transfers", "POST", {
          call_id: call.id,
          amount_paise: paise,
          beneficiary: beneficiary.trim(),
        });
        await refresh();
      } else {
        const id = crypto.randomUUID();
        const buffer = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(
            JSON.stringify({
              id,
              call_id: call.id,
              beneficiary,
              amount_paise: paise,
            }),
          ),
        );
        const digest = Array.from(new Uint8Array(buffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        setTransfers((ts) => [
          {
            id,
            call_id: call.id,
            beneficiary,
            amount_paise: paise,
            digest,
            status: "pending",
            created: Date.now() / 1000,
            expires: Date.now() / 1000 + 300,
          },
          ...ts,
        ]);
        addEvent("transfer.requested", { transfer_id: id, digest });
      }
      setModal(false);
      setNotice("Transaction held. Independent approval is required.");
    });
  };
  const decide = async (t, approve) =>
    act(async () => {
      if (mode === "demo") {
        const next = demoDecision(t, approve);
        setTransfers((ts) => ts.map((x) => (x.id === t.id ? next : x)));
        addEvent(approve ? "transfer.approved" : "transfer.rejected", {
          transfer_id: t.id,
        });
      } else {
        await api(
          `/transfers/${t.id}/decision`,
          "POST",
          { digest: t.digest, approve },
          approverToken || token,
        );
        await refresh();
      }
      setNotice(
        approve
          ? "Approval recorded for these exact transaction details."
          : "Transaction rejected.",
      );
    });
  const execute = async (t) =>
    act(async () => {
      if (mode === "demo") {
        const next = demoExecute(t);
        setTransfers((ts) => ts.map((x) => (x.id === t.id ? next : x)));
        addEvent("transfer.executed_sandbox", { transfer_id: t.id });
      } else {
        await api(`/transfers/${t.id}/execute`, "POST");
        await refresh();
      }
      setNotice("Sandbox transaction completed. No money moved.");
    });
  const changeMode = (next) => {
    if (active) {
      setError("End the current call before changing modes.");
      return;
    }
    setMode(next);
    setRisk(null);
    setSeries([]);
    setCall(null);
    setTransfers([]);
    setEvents([]);
    setChain(null);
    setNotice("");
    setError("");
    setConnected(false);
    setAudioStatus("idle");
    setBeneficiary(
      next === "live" ? "Northstar Supplies DEMO" : "Northstar Supplies · DEMO",
    );
    if (next === "live") setView("settings");
  };
  const connect = () =>
    act(async () => {
      if (apiBase && !/^https?:\/\//.test(apiBase))
        throw new Error(
          "Use a full http:// or https:// gateway URL, or leave it blank for this server.",
        );
      if (apiBase) {
        const target = new URL(apiBase);
        if (
          target.protocol !== "https:" &&
          !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
        )
          throw new Error("Use HTTPS for a remote gateway.");
      }
      const health = await fetch(
        `${apiBase.replace(/\/$/, "")}/api/health`,
      ).then((r) => {
        if (!r.ok) throw new Error("Gateway unavailable.");
        return r.json();
      });
      const me = await api("/session");
      setRole(me.role);
      setModelReady(health.model_available);
      await refresh();
      setConnected(true);
      setNotice(`Gateway connected as ${me.role}.`);
      setView(me.role === "approver" ? "approvals" : "monitor");
    });
  const reset = () => {
    setTransfers([]);
    setEvents([]);
    setSeries([]);
    setRisk(null);
    setCall(null);
    setElapsed(0);
    setNotice("Demo session cleared.");
  };
  const trace = series.map((v, i) =>
    v === null ? null : `${(i / 119) * 760},${144 - v * 126}`,
  );
  let paths = [];
  let group = [];
  trace.forEach((p) => {
    if (p) group.push(p);
    else if (group.length) {
      paths.push(group.join(" "));
      group = [];
    }
  });
  if (group.length) paths.push(group.join(" "));
  const transferCards = (approval = false) => (
    <div className="transfer-list">
      {transfers.length === 0 ? (
        <div className="empty">
          <LockKeyhole size={28} />
          <h3>No transactions yet</h3>
          <p>
            Start a call, then request a sandbox transfer.
            <br />
            Every transfer requires independent approval.
          </p>
        </div>
      ) : (
        transfers.map((t) => (
          <article className="transfer" key={t.id}>
            <div className="transfer-top">
              <div className="square-icon">
                <Wallet size={18} />
              </div>
              <div className="grow">
                <strong>{money(t.amount_paise)}</strong>
                <p>{t.beneficiary}</p>
              </div>
              <Tag
                tone={
                  t.status === "executed"
                    ? "green"
                    : t.status === "rejected"
                      ? "red"
                      : "amber"
                }
              >
                {t.status}
              </Tag>
            </div>
            <div className="transaction-meta">
              <span>Ref {t.id.slice(0, 8)}</span>
              <span>
                {["pending", "approved"].includes(t.status)
                  ? `${Math.max(0, Math.ceil(t.expires - now / 1000))}s remaining`
                  : "Decision recorded"}
              </span>
            </div>
            {approval && (
              <p className="digest">
                Approval fingerprint <code>{t.digest}</code>
              </p>
            )}
            <div className="transfer-actions">
              {approval && t.status === "pending" ? (
                <>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => decide(t, false)}
                  >
                    <X size={15} />
                    Reject
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => decide(t, true)}
                  >
                    <Check size={15} />
                    Approve exact details
                  </button>
                </>
              ) : t.status === "approved" ? (
                <button
                  className="primary"
                  disabled={busy || (role === "approver" && mode === "live")}
                  onClick={() => execute(t)}
                >
                  <CheckCheck size={16} />
                  Execute sandbox transfer
                </button>
              ) : t.status === "pending" ? (
                <button onClick={() => setView("approvals")}>
                  Review approval <ChevronRight size={15} />
                </button>
              ) : null}
            </div>
          </article>
        ))
      )}
    </div>
  );
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("monitor");
          }}
        >
          <span className="brand-mark">
            <ShieldCheck size={25} />
          </span>
          <span>
            SENTINEL<small>VOICE TRUST GATEWAY</small>
          </span>
        </a>
        <div className="workspace-label">
          WORKSPACE <span>SIH / 2026</span>
        </div>
        <nav>
          {[
            ["monitor", Activity, "Live monitor"],
            ["approvals", LockKeyhole, "Approvals"],
            ["audit", FileClock, "Audit trail"],
            ["evaluation", BarChart3, "Evaluation"],
            ["settings", Settings2, "Gateway settings"],
          ].map(([id, Icon, label]) => (
            <button
              key={id}
              className={view === id ? "selected" : ""}
              onClick={() => setView(id)}
            >
              <Icon size={19} />
              {label}
              {id === "approvals" && pending > 0 && (
                <span className="nav-count">{pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="environment">
            <span className="small-dot" /> Sandbox environment
            <p>No real funds can move.</p>
          </div>
          <a
            href="https://github.com/Bhuvaneshj-dev/sentinel.SIH"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={17} />
            Project repository
            <ArrowUpRight size={15} />
          </a>
          <div className="team">
            <div className="avatar">OW</div>
            <div>
              Ocean Waves<small>of innovation</small>
            </div>
            <Tag>v0.1</Tag>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <span>
              {view === "monitor"
                ? "Live monitor"
                : view === "approvals"
                  ? "Approvals"
                  : view === "audit"
                    ? "Audit trail"
                    : view === "evaluation"
                      ? "Evaluation evidence"
                      : "Gateway settings"}
            </span>
          </div>
          <div className="top-right">
            <span className="desktop-only">Research prototype</span>
            <Tag tone="green">
              <ShieldCheck size={13} />
              Sandbox
            </Tag>
            <div className="avatar small">BJ</div>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                VOICE INTEGRITY / ACTION VERIFICATION
              </div>
              <h1>
                {view === "monitor"
                  ? "Trust the voice. Verify the action."
                  : view === "approvals"
                    ? "Independent approvals"
                    : view === "audit"
                      ? "Every decision, accounted for."
                      : view === "evaluation"
                        ? "Evaluation evidence"
                        : "Gateway settings"}
              </h1>
              <p>
                {view === "monitor"
                  ? "Monitor the call. Keep sensitive actions behind independent approval."
                  : view === "approvals"
                    ? "Confirm the beneficiary and amount before authorizing a sandbox transfer."
                    : view === "audit"
                      ? "Review the events behind each call and transaction."
                      : view === "evaluation"
                        ? "Measured compute performance and clearly stated research gaps."
                        : "Connect the console to your local SENTINEL backend."}
              </p>
            </div>
            <div className="mode-switch" aria-label="Operating mode">
              <button
                className={mode === "demo" ? "chosen" : ""}
                onClick={() => changeMode("demo")}
              >
                Scenario demo
              </button>
              <button
                className={mode === "live" ? "chosen" : ""}
                onClick={() => changeMode("live")}
              >
                Live gateway
              </button>
            </div>
          </div>
          <div className="disclosure">
            <CircleHelp size={17} />
            <span>
              {mode === "demo" ? (
                <>
                  Demo mode uses <strong>simulated risk scores</strong> and
                  browser-only transactions. Explore the full workflow without
                  moving money.
                </>
              ) : (
                <>
                  Live audio stays in memory.{" "}
                  {modelReady
                    ? "A configured ONNX model supplies scores; validation is your responsibility."
                    : "No trained model is bundled. Audio cannot be classified until a compatible model is configured."}
                </>
              )}
            </span>
            {mode === "demo" && !active && (
              <button className="text-button" onClick={reset}>
                <RotateCcw size={14} />
                Reset
              </button>
            )}
          </div>
          {error && (
            <div className="message error" role="alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="message success" role="status">
              <Check size={17} />
              <span>{notice}</span>
              <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {view === "monitor" && (
            <>
              <div className="stats">
                <div>
                  <span>
                    <Radio size={16} />
                    Call session
                  </span>
                  <strong>{active ? "Monitoring" : "Ready to connect"}</strong>
                  <small>
                    {active
                      ? `${fmtTime(elapsed)} elapsed`
                      : "Start a scenario or live audio"}
                  </small>
                </div>
                <div>
                  <span>
                    <Fingerprint size={16} />
                    Voice assessment
                  </span>
                  <strong className={high ? "text-red" : ""}>
                    {risk === null
                      ? "Awaiting evidence"
                      : high
                        ? "Elevated risk"
                        : "Below alert threshold"}
                  </strong>
                  <small>
                    {mode === "demo"
                      ? "Simulated · not a detection result"
                      : statusName(audioStatus)}
                  </small>
                </div>
                <div>
                  <span>
                    <LockKeyhole size={16} />
                    Action protection
                  </span>
                  <strong>Approval required</strong>
                  <small>Applies at every risk level</small>
                </div>
                <div>
                  <span>
                    <FileClock size={16} />
                    Pending approvals
                  </span>
                  <strong>
                    {String(pending).padStart(2, "0")}{" "}
                    <span className="unit">requests</span>
                  </strong>
                  <small>5-minute authorization window</small>
                </div>
              </div>
              <div className="monitor-grid">
                <section className="panel call-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-label">
                        01 / CALL INTELLIGENCE
                      </span>
                      <h2>Live call monitor</h2>
                    </div>
                    <Tag tone={active ? "green" : ""}>
                      <span
                        className={
                          active ? "small-dot pulse" : "small-dot muted"
                        }
                      />
                      {active ? "Session active" : "Standby"}
                    </Tag>
                  </div>
                  <div className="call-identity">
                    <div className="caller-icon">
                      <Headphones size={28} />
                    </div>
                    <div>
                      <h3>
                        {call ? call.label : "Finance desk · incoming voice"}
                      </h3>
                      <p>
                        {call
                          ? `Session ${call.id.slice(0, 8)} · ${mode === "demo" ? "Scenario playback" : "16 kHz mono audio"}`
                          : "Select an input to begin a protected call session"}
                      </p>
                    </div>
                    <span className="call-clock">{fmtTime(elapsed)}</span>
                  </div>
                  <div className="risk-layout">
                    <div
                      className={`risk-dial ${high ? "risk-high" : ""}`}
                      style={{ "--risk": `${(risk || 0) * 100}%` }}
                    >
                      <div>
                        <span className="risk-number">
                          {risk === null ? "—" : Math.round(risk * 100)}
                          <small>{risk === null ? "" : "/100"}</small>
                        </span>
                        <span>IMPERSONATION RISK</span>
                        <Tag tone={high ? "red" : ""}>
                          {risk === null
                            ? "No assessment"
                            : high
                              ? "Elevated"
                              : "Below threshold"}
                        </Tag>
                      </div>
                    </div>
                    <div className="risk-explanation">
                      <span className="section-label">
                        {mode === "demo"
                          ? "SIMULATED ASSESSMENT"
                          : "AUDIO ASSESSMENT"}
                      </span>
                      <h3>
                        {high
                          ? "Pause. Verify independently."
                          : risk !== null
                            ? "Keep verification in place."
                            : "Listening starts with evidence."}
                      </h3>
                      <p>
                        {high
                          ? "The risk score crossed the 0.80 alert threshold. The transaction remains held for independent approval."
                          : risk !== null
                            ? "A low risk score does not prove identity. Sensitive actions still require a separate approval."
                            : "Start a session to see the risk timeline and transaction controls."}
                      </p>
                      <div className="mini-metrics">
                        <span>
                          Window<strong>2 seconds</strong>
                        </span>
                        <span>
                          Inference
                          <strong>
                            {latency === null
                              ? "Not measured"
                              : `${latency} ms`}
                          </strong>
                        </span>
                        <span>
                          Audio storage<strong>None by app</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="chart-heading">
                    <span>Risk over time</span>
                    <span>
                      <i className="legend-line" />{" "}
                      {mode === "demo" ? "Simulated risk" : "EWMA risk"}{" "}
                      <i className="legend-dash" /> Alert threshold
                    </span>
                  </div>
                  <div className="chart">
                    <svg
                      viewBox="0 0 780 174"
                      role="img"
                      aria-label="Risk history, with alert threshold at 80 percent"
                    >
                      <defs>
                        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor={high ? "#ff8c8c" : "#60e6b0"}
                            stopOpacity=".19"
                          />
                          <stop
                            offset="100%"
                            stopColor="#60e6b0"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>
                      {[0.2, 0.4, 0.6, 0.8].map((v) => (
                        <g key={v}>
                          <line
                            x1="0"
                            x2="760"
                            y1={144 - v * 126}
                            y2={144 - v * 126}
                            stroke={v === 0.8 ? "#846d41" : "#1d2937"}
                            strokeDasharray={v === 0.8 ? "5 5" : ""}
                          />
                          <text
                            x="767"
                            y={148 - v * 126}
                            fill="#8392a7"
                            fontSize="10"
                          >
                            {v * 100}
                          </text>
                        </g>
                      ))}
                      {paths.map((p, i) => (
                        <polyline
                          key={i}
                          points={p}
                          fill="none"
                          stroke={high ? "#ff8c8c" : "#60e6b0"}
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                        />
                      ))}
                      <text x="0" y="170" fill="#8795a8" fontSize="11">
                        Last 24 seconds
                      </text>
                      <text x="731" y="170" fill="#8795a8" fontSize="11">
                        Now
                      </text>
                    </svg>
                    {series.length === 0 && (
                      <div className="chart-empty">
                        Your session timeline will appear here
                      </div>
                    )}
                  </div>
                  <div className="call-controls">
                    {mode === "demo" ? (
                      <label className="scenario-select">
                        <span>SCENARIO</span>
                        <select
                          value={scenario}
                          disabled={active}
                          onChange={(e) => setScenario(e.target.value)}
                        >
                          {Object.entries(scenarios).map(([key, s]) => (
                            <option key={key} value={key}>
                              {s.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <span className="live-input">
                        <Mic size={17} />
                        Microphone or audio file
                      </span>
                    )}
                    <div>
                      {active ? (
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() => act(finish)}
                        >
                          <Square size={15} />
                          End session
                        </button>
                      ) : (
                        <>
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() =>
                              act(
                                mode === "demo"
                                  ? startDemo
                                  : () => startAudio(),
                              )
                            }
                          >
                            {mode === "demo" ? (
                              <Play size={16} />
                            ) : (
                              <Mic size={16} />
                            )}{" "}
                            {mode === "demo"
                              ? "Start scenario"
                              : "Use microphone"}
                          </button>
                          {mode === "live" && (
                            <button
                              disabled={busy}
                              onClick={() => fileInput.current.click()}
                            >
                              <Upload size={16} />
                              Audio file
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="audio/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files[0];
                      e.target.value = "";
                      if (f) act(() => startAudio(f));
                    }}
                  />
                  {mode === "demo" && (
                    <p className="scenario-note">
                      {scenarios[scenario].description}
                    </p>
                  )}
                </section>
                <section className="panel action-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-label">02 / ACTION GATEWAY</span>
                      <h2>Protected transactions</h2>
                    </div>
                    <LockKeyhole size={20} />
                  </div>
                  <div className="protection-note">
                    <ShieldCheck size={20} />
                    <div>
                      <strong>Voice cannot authorize payment</strong>
                      <p>
                        Every request needs approval bound to its exact details.
                      </p>
                    </div>
                  </div>
                  <button
                    className="new-transfer"
                    disabled={!active || busy}
                    onClick={() => setModal(true)}
                  >
                    <Wallet size={18} />
                    Request sandbox transfer<span>+</span>
                  </button>
                  {transferCards()}
                  <div className="gateway-footer">
                    <LockKeyhole size={14} /> All payments are simulated. No
                    banking connection.
                  </div>
                </section>
              </div>
              <div className="bottom-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Recent activity</h2>
                    <button
                      className="text-button"
                      onClick={() => setView("audit")}
                    >
                      View audit trail
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  {events.length === 0 ? (
                    <div className="quiet-empty">
                      Session events will appear as you use the gateway.
                    </div>
                  ) : (
                    events
                      .slice(-4)
                      .reverse()
                      .map((e) => (
                        <div className="event-row" key={e.seq}>
                          <span className="event-icon">
                            <Check size={14} />
                          </span>
                          <span>
                            {e.event
                              .replaceAll(".", " / ")
                              .replaceAll("_", " ")}
                          </span>
                          <time>
                            {new Date(e.timestamp * 1000).toLocaleTimeString()}
                          </time>
                        </div>
                      ))
                  )}
                </section>
                <section className="panel assurance">
                  <div className="square-icon">
                    <ShieldCheck size={23} />
                  </div>
                  <div>
                    <span className="section-label">INDEPENDENT BY DESIGN</span>
                    <h3>
                      Detection can be uncertain.
                      <br />
                      Authorization must be explicit.
                    </h3>
                    <p>
                      Try “Detector misses the attack” to see why a separate
                      approval remains essential.
                    </p>
                  </div>
                </section>
              </div>
            </>
          )}
          {view === "approvals" && (
            <div className="approval-layout">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Transaction review queue</h2>
                  <Tag tone="amber">{pending} pending</Tag>
                </div>
                {mode === "demo" ? (
                  <div className="inline-note">
                    <CircleHelp size={17} />
                    You are acting as a demo approver. The live backend requires
                    a separate credential.
                  </div>
                ) : (
                  <label className="field approval-key">
                    Approver credential (kept only in this tab)
                    <input
                      type="password"
                      autoComplete="off"
                      value={approverToken}
                      onChange={(e) => setApproverToken(e.target.value)}
                      placeholder={
                        role === "approver"
                          ? "Current approver session will be used"
                          : "Enter a separate approver token"
                      }
                    />
                  </label>
                )}
                {transferCards(true)}
              </section>
              <section className="panel review-guide">
                <Fingerprint size={30} />
                <h2>
                  Approve the action,
                  <br />
                  not the voice.
                </h2>
                <p>
                  Check the request through an independently trusted channel
                  before approving.
                </p>
                <ol>
                  <li>Verify the intended beneficiary.</li>
                  <li>Confirm the exact amount.</li>
                  <li>Check the approval fingerprint.</li>
                  <li>Approve or reject before expiry.</li>
                </ol>
                <p className="muted-text">
                  Approval expires after five minutes from the request. It can
                  authorize one sandbox execution only.
                </p>
              </section>
            </div>
          )}
          {view === "audit" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Decision audit trail</h2>
                  <p className="muted-text">
                    {mode === "demo"
                      ? "Browser session events · cleared on refresh"
                      : `Server event hash chain · ${chain === true ? "verification passed" : chain === false ? "verification failed" : "not checked"}`}
                  </p>
                </div>
                <button
                  disabled={!events.length}
                  onClick={() =>
                    download("sentinel-audit.json", {
                      mode,
                      chain_valid: chain,
                      events,
                    })
                  }
                >
                  <Download size={16} />
                  Export JSON
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Event</th>
                      <th>Actor</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events
                      .slice()
                      .reverse()
                      .map((e) => (
                        <tr key={e.seq}>
                          <td>
                            {new Date(e.timestamp * 1000).toLocaleTimeString()}
                          </td>
                          <td>{e.event}</td>
                          <td>
                            <Tag>{e.actor}</Tag>
                          </td>
                          <td>
                            <code>
                              {(
                                e.details.transfer_id ||
                                e.details.call_id ||
                                "—"
                              ).slice(0, 12)}
                            </code>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!events.length && (
                  <div className="empty">
                    <FileClock size={30} />
                    <h3>No recorded events</h3>
                    <p>Run a call scenario to create an audit trail.</p>
                  </div>
                )}
              </div>
            </section>
          )}
          {view === "evaluation" && (
            <div className="settings-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Baseline compute benchmark</h2>
                  <Tag>Measured locally</Tag>
                </div>
                <div className="settings-body">
                  <p>
                    Third-party Wav2Vec2 baseline · CPU · {benchmark.threads}{" "}
                    threads · {benchmark.window_ms / 1000}-second input window
                  </p>
                  <div className="stats benchmark-stats">
                    <div>
                      <span>Median inference</span>
                      <strong>{benchmark.median_ms} ms</strong>
                    </div>
                    <div>
                      <span>p95 inference</span>
                      <strong>{benchmark.p95_ms} ms</strong>
                    </div>
                  </div>
                  <p>{benchmark.note}</p>
                  <p className="muted-text">
                    {benchmark.measured_runs} measured runs after{" "}
                    {benchmark.warmup_runs} warmups. Environment:{" "}
                    {benchmark.platform}. Results vary with hardware and load.
                  </p>
                  <button
                    onClick={() =>
                      download("sentinel-compute-benchmark.json", benchmark)
                    }
                  >
                    <Download size={16} />
                    Download measurement
                  </button>
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Speech validation status</h2>
                  <Tag tone="amber">Not evaluated</Tag>
                </div>
                <div className="settings-body">
                  <p>
                    No independently measured speech accuracy is published.
                    Codec robustness, Indian-language performance, and
                    unseen-generator detection remain research tasks.
                  </p>
                  <div className="inline-note">
                    <CircleHelp size={18} />A successful model load and
                    synthetic-tone timing test do not establish detection
                    accuracy.
                  </div>
                  <a
                    className="doc-link"
                    href="https://github.com/Bhuvaneshj-dev/sentinel.SIH/blob/main/evaluation/README.md"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View evaluation protocol <ArrowUpRight size={15} />
                  </a>
                </div>
              </section>
            </div>
          )}
          {view === "settings" && (
            <div className="settings-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-label">LOCAL BACKEND</span>
                    <h2>Connect your gateway</h2>
                  </div>
                  <Server size={22} />
                </div>
                <div className="settings-body">
                  <p>
                    The scenario demo works without a server. Live audio and
                    server-enforced approvals require the included Python
                    backend.
                  </p>
                  <label className="field">
                    Gateway URL
                    <input
                      value={apiBase}
                      disabled={active}
                      onChange={(e) => {
                        setApiBase(e.target.value);
                        setConnected(false);
                      }}
                      placeholder="Blank = same origin, or http://localhost:8000"
                    />
                  </label>
                  <label className="field">
                    Operator or approver credential
                    <input
                      type="password"
                      autoComplete="off"
                      disabled={active}
                      value={token}
                      onChange={(e) => {
                        setToken(e.target.value);
                        setConnected(false);
                      }}
                      placeholder="From your local .env file"
                    />
                  </label>
                  <p className="muted-text">
                    Credentials are kept in memory for this tab. They are never
                    written to browser storage.
                  </p>
                  <button
                    className="primary"
                    disabled={busy || active || mode !== "live"}
                    onClick={connect}
                  >
                    <Link2 size={16} />
                    {connected ? "Reconnect" : "Connect gateway"}
                  </button>
                  {mode !== "live" && (
                    <p className="muted-text">
                      Select “Live gateway” at the top to connect.
                    </p>
                  )}
                </div>
              </section>
              <section className="panel readiness">
                <div className="panel-heading">
                  <h2>Prototype capabilities</h2>
                </div>
                {[
                  ["Scenario playback", "Included"],
                  ["Browser microphone / audio upload", "Backend required"],
                  [
                    "Independent transaction approvals",
                    "Implemented in backend",
                  ],
                  ["ONNX inference adapter", "Bring a compatible model"],
                  ["Trained SENTINEL-V0 checkpoint", "Not supplied"],
                  ["SIP / banking integration", "Future work"],
                  ["Detection accuracy / latency", "Not benchmarked"],
                ].map(([a, b]) => (
                  <div className="readiness-row" key={a}>
                    <span>{a}</span>
                    <span>{b}</span>
                  </div>
                ))}
                <div className="inline-note">
                  <CircleHelp size={18} />
                  This is a research prototype. No claim of detection accuracy,
                  production readiness, or regulatory compliance is made.
                </div>
              </section>
            </div>
          )}
          <footer className="footer">
            <span>
              <ShieldCheck size={14} /> SENTINEL · Trust the voice. Verify the
              action.
            </span>
            <span>Ocean Waves of innovation · SIH 2026</span>
          </footer>
        </div>
      </main>
      {modal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <section
            className="modal"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setModal(false);
            }}
          >
            <div className="panel-heading">
              <h2 id="transfer-title">Request sandbox transfer</h2>
              <button
                aria-label="Close transaction form"
                onClick={() => setModal(false)}
              >
                <X size={19} />
              </button>
            </div>
            <form onSubmit={requestTransfer}>
              <p>
                No money moves. The request will be held for independent
                approval.
              </p>
              <label className="field">
                Beneficiary
                <input
                  autoFocus
                  required
                  minLength={2}
                  maxLength={100}
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                />
              </label>
              <label className="field">
                Amount (INR)
                <input
                  required
                  type="number"
                  min="0.01"
                  max="100000000"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <div className="inline-note">
                <LockKeyhole size={18} />
                The amount and beneficiary cannot be changed after submission.
              </div>
              <button className="primary full" disabled={busy} type="submit">
                Create approval request
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
