import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Slider from "@radix-ui/react-slider";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import {
  Activity,
  DoorOpen,
  Pause,
  Play,
  RotateCcw,
  Thermometer,
  Watch,
} from "lucide-react";
import { ThermalCanvas, WaveCanvas } from "@/components/sensor-canvas";
import {
  DT,
  SCENARIOS,
  type FusionConfig,
  type Posture,
  type Scenario,
  type Snapshot,
  type StepInput,
  type Verdict,
  type Zone,
  defaultConfig,
  explain,
  formatProb,
  formatSigned,
  initialSimState,
  scenarioById,
  simulate,
  stepSim,
  verdictLabel,
} from "@/lib/fusion";

const POSTURES: { id: Posture; label: string }[] = [
  { id: "empty", label: "Empty" },
  { id: "standing", label: "Standing" },
  { id: "sitting", label: "Sitting" },
  { id: "chair", label: "Chair" },
  { id: "floor", label: "Floor" },
];

interface BenchControls {
  zone: Zone;
  posture: Posture;
  moving: boolean;
  ambient: number;
  wearable: boolean;
  hr: number;
  doorOpen: boolean;
}

const BENCH_START: BenchControls = {
  zone: "bathroom",
  posture: "standing",
  moving: false,
  ambient: 0.04,
  wearable: false,
  hr: 72,
  doorOpen: false,
};

export function FloorlineApp() {
  const [config, setConfig] = useState<FusionConfig>(defaultConfig);
  const [caseId, setCaseId] = useState(SCENARIOS[0]!.id);
  const [mode, setMode] = useState<"case" | "bench">("case");
  const [t, setT] = useState(SCENARIOS[0]!.showcaseAt);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [bench, setBench] = useState<BenchControls>(BENCH_START);
  const [benchSnap, setBenchSnap] = useState<Snapshot | null>(null);
  const [mounted, setMounted] = useState(false);

  const scenario = scenarioById(caseId);
  const configRef = useRef(config);
  const benchRef = useRef(bench);
  const simRef = useRef(initialSimState());
  const pendingRef = useRef<null | "arm" | "disarm">(null);
  const strikeAtRef = useRef(-1);
  configRef.current = config;
  benchRef.current = bench;

  const caseSnap = useMemo(
    () => (mode === "case" ? simulate(scenario, t, config) : null),
    [mode, scenario, t, config],
  );
  const snap = mode === "bench" ? benchSnap : caseSnap;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mode !== "case" || !playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const duration = scenario.duration;
    const loop = (now: number) => {
      const dt = Math.min(0.064, (now - last) / 1000);
      last = now;
      acc += dt * speed;
      if (acc >= 0.1) {
        const step = acc;
        acc = 0;
        setT((prev) => Math.min(duration, prev + step));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode, playing, speed, scenario.duration]);

  useEffect(() => {
    if (playing && t >= scenario.duration) setPlaying(false);
  }, [playing, t, scenario.duration]);

  useEffect(() => {
    if (mode !== "bench") return;
    const id = window.setInterval(() => {
      const controls = benchRef.current;
      const cfg = configRef.current;
      const stepped = simRef.current.trace.length > 0;
      const nextT = stepped
        ? Math.round((simRef.current.view.t + DT) * 1000) / 1000
        : 0;
      let rms = controls.ambient;
      if (strikeAtRef.current >= 0) {
        const age = nextT - strikeAtRef.current;
        if (age >= 0 && age < 0.45) {
          rms = 0.32;
        } else if (age >= 0.45 && age < 1.4) {
          rms = Math.max(controls.ambient, 0.32 * Math.exp(-6 * (age - 0.45)));
        }
      }
      const pending = pendingRef.current;
      pendingRef.current = null;
      const input: StepInput = {
        t: nextT,
        zone: controls.zone,
        armContext: pending === "arm",
        disarm: pending === "disarm",
        doorOpen: controls.doorOpen,
        rms,
        posture: controls.posture,
        moving: controls.moving,
        hr: controls.wearable ? controls.hr : null,
        caption: benchCaption(controls),
        clockOrigin: 3 * 3600 + 14 * 60,
      };
      simRef.current = stepSim(simRef.current, input, cfg);
      setBenchSnap(simRef.current.view);
    }, 200);
    return () => window.clearInterval(id);
  }, [mode]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.code !== "Space" || event.target !== document.body) return;
      event.preventDefault();
      if (mode !== "case") return;
      togglePlay();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    const atMark =
      Math.abs(t - scenario.showcaseAt) < 0.15 || t >= scenario.duration - 0.05;
    if (atMark) setT(0);
    setPlaying(true);
  }

  function chooseCase(id: string) {
    const next = scenarioById(id);
    setMode("case");
    setPlaying(false);
    setCaseId(id);
    setT(next.showcaseAt);
  }

  function openBench() {
    const seeded = seedBench(bench, config);
    simRef.current = seeded;
    pendingRef.current = null;
    strikeAtRef.current = -1;
    setBenchSnap(seeded.view);
    setPlaying(false);
    setMode("bench");
  }

  const atMark =
    mode === "case" &&
    (Math.abs(t - scenario.showcaseAt) < 0.15 || t >= scenario.duration - 0.05);

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 md:px-8 md:py-8">
        <header className="flex items-end justify-between gap-4 border-b border-border pb-4">
          <div className="min-w-0">
            <p className="text-sm text-muted">Pilot home 4B</p>
            <h1 className="text-xl font-medium tracking-tight md:text-2xl">Floorline</h1>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg tabular-nums md:text-xl">{snap?.clock ?? "—"}</p>
            <p className="text-sm text-faint">
              {mode === "bench" ? "Bench" : "Night watch"}
            </p>
          </div>
        </header>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {SCENARIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === "case" && item.id === caseId}
              onClick={() => chooseCase(item.id)}
              className={chipClass(mode === "case" && item.id === caseId)}
            >
              {item.title}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={mode === "bench"}
            onClick={openBench}
            className={chipClass(mode === "bench")}
          >
            Bench
          </button>
        </div>

        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          {mode === "bench"
            ? "Drive the room yourself. The door only wakes audio and thermal. Stillness needs a few frames. A strike is a transient, so it is held. The band can be unpaired."
            : `${scenario.kicker}. ${scenario.summary}`}
        </p>

        {snap ? (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              <VerdictBlock snap={snap} config={config} />
              {mode === "case" ? (
                <CaseTransport
                  scenario={scenario}
                  t={t}
                  playing={playing}
                  speed={speed}
                  atMark={atMark}
                  onPrimary={togglePlay}
                  onRestart={() => {
                    setT(0);
                    setPlaying(true);
                  }}
                  onDecision={() => {
                    setPlaying(false);
                    setT(scenario.showcaseAt);
                  }}
                  onSpeed={() => setSpeed((value) => (value === 1 ? 3 : 1))}
                  onScrub={(value) => {
                    setPlaying(false);
                    setT(value);
                  }}
                />
              ) : (
                <BenchPanel
                  controls={bench}
                  snap={snap}
                  onChange={(next) => setBench(next)}
                  onArm={() => {
                    pendingRef.current = "arm";
                    setBench((prev) => ({ ...prev, doorOpen: true }));
                  }}
                  onSleep={() => {
                    pendingRef.current = "disarm";
                    setBench((prev) => ({ ...prev, doorOpen: false }));
                  }}
                  onStrike={() => {
                    strikeAtRef.current = simRef.current.view.t;
                  }}
                  onReset={() => {
                    const next = BENCH_START;
                    pendingRef.current = null;
                    strikeAtRef.current = -1;
                    setBench(next);
                    simRef.current = seedBench(next, config);
                    setBenchSnap(simRef.current.view);
                  }}
                />
              )}
              <Plan snap={snap} />
              <ThermalCard snap={snap} floorY={config.floorCentroidThreshold} />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <Evidence snap={snap} config={config} />
              <ScoreTrace snap={snap} config={config} mounted={mounted} />
              <BeatLog snap={snap} />
            </div>
          </div>
        ) : null}

        <Calibration
          config={config}
          onChange={setConfig}
          onReset={() => setConfig(defaultConfig())}
        />
        <Contract />
      </div>
    </main>
  );
}

function chipClass(active: boolean): string {
  return active
    ? "h-11 shrink-0 rounded-full border border-foreground bg-foreground px-4 text-sm font-medium text-background"
    : "h-11 shrink-0 rounded-full border border-border bg-transparent px-4 text-sm text-foreground";
}

function VerdictBlock({ snap, config }: { snap: Snapshot; config: FusionConfig }) {
  const verdict = snap.fusion.verdict;
  const p = snap.fusion.fusedProbability;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Fused score</p>
          <p className="mt-1 font-mono text-4xl font-medium tabular-nums tracking-tight">
            {formatProb(p)}
          </p>
        </div>
        <p
          role="status"
          aria-live="polite"
          className={
            verdict === "ALERT_FALL"
              ? "inline-flex h-8 items-center gap-2 rounded-full border border-alert px-3 text-sm text-alert"
              : "inline-flex h-8 items-center gap-2 rounded-full border border-border px-3 text-sm text-foreground"
          }
        >
          <span
            className={
              verdict === "ALERT_FALL"
                ? "size-2 rounded-full bg-alert"
                : "size-2 rounded-full bg-faint"
            }
            aria-hidden="true"
          />
          {verdictLabel(verdict)}
        </p>
      </div>
      <Meter p={p} confirm={config.confirmThreshold} alert={config.alertThreshold} />
      <p className="mt-4 text-sm leading-relaxed text-muted">{explain(snap, config)}</p>
      <p className="mt-3 text-sm leading-relaxed text-faint">{snap.caption}</p>
      {snap.fusion.fusedLogOdds != null ? (
        <p className="mt-3 font-mono text-xs tabular-nums text-faint">
          σ({snap.fusion.fusedLogOdds.toFixed(2)})
          {snap.unpairedProbability != null
            ? ` · without band ${formatProb(snap.unpairedProbability)}`
            : ""}
        </p>
      ) : null}
    </section>
  );
}

function Meter({
  p,
  confirm,
  alert,
}: {
  p: number | null;
  confirm: number;
  alert: number;
}) {
  const pct = p == null ? 0 : Math.min(100, Math.max(0, p * 100));
  return (
    <div className="relative mt-5 h-12">
      <div className="absolute inset-x-0 top-3 h-px bg-border" />
      {p != null ? (
        <div
          className="absolute top-3 h-px bg-foreground"
          style={{ width: `${pct}%` }}
        />
      ) : null}
      {p != null ? (
        <span
          className="absolute top-3 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: `${pct}%` }}
        />
      ) : null}
      <Mark x={confirm} label="Confirm" />
      <Mark x={alert} label="Alert" />
    </div>
  );
}

function Mark({ x, label }: { x: number; label: string }) {
  return (
    <span
      className="absolute top-3 h-2 w-px bg-faint"
      style={{ left: `${x * 100}%` }}
    >
      <span className="absolute top-3 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap text-faint">
        {label}
      </span>
    </span>
  );
}

function CaseTransport({
  scenario,
  t,
  playing,
  speed,
  atMark,
  onPrimary,
  onRestart,
  onDecision,
  onSpeed,
  onScrub,
}: {
  scenario: Scenario;
  t: number;
  playing: boolean;
  speed: number;
  atMark: boolean;
  onPrimary: () => void;
  onRestart: () => void;
  onDecision: () => void;
  onSpeed: () => void;
  onScrub: (value: number) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrimary}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? "Pause" : atMark ? "Replay" : "Play"}
        </button>
        <button type="button" onClick={onRestart} className={ghostBtn}>
          <RotateCcw className="size-4" />
          From the door
        </button>
        <button type="button" onClick={onDecision} className={ghostBtn}>
          Decision
        </button>
        <button type="button" onClick={onSpeed} className={ghostBtn} aria-label="Playback speed">
          {speed === 1 ? "1×" : "3×"}
        </button>
        <span className="ml-auto font-mono text-xs tabular-nums text-faint">
          {t.toFixed(1)}s / {scenario.duration.toFixed(0)}s
        </span>
      </div>
      <div className="mt-3">
        <Range
          label="Case time"
          min={0}
          max={scenario.duration}
          step={0.2}
          value={Math.min(scenario.duration, t)}
          onChange={onScrub}
          format={(value) => `${value.toFixed(1)}s`}
          hideValue
        />
      </div>
    </section>
  );
}

const ghostBtn =
  "inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm text-foreground";

function BenchPanel({
  controls,
  snap,
  onChange,
  onArm,
  onSleep,
  onStrike,
  onReset,
}: {
  controls: BenchControls;
  snap: Snapshot;
  onChange: (next: BenchControls) => void;
  onArm: () => void;
  onSleep: () => void;
  onStrike: () => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        <TogglePair
          value={controls.zone}
          options={[
            { id: "bathroom", label: "Bathroom" },
            { id: "bedroom", label: "Bedroom" },
          ]}
          onChange={(zone) => onChange({ ...controls, zone })}
        />
        {snap.contextActive ? (
          <button type="button" onClick={onSleep} className={ghostBtn}>
            Sleep
          </button>
        ) : (
          <button
            type="button"
            onClick={onArm}
            className="inline-flex h-11 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground"
          >
            Open door
          </button>
        )}
        <button type="button" onClick={onStrike} className={ghostBtn}>
          Strike
        </button>
        <button type="button" onClick={onReset} className={ghostBtn}>
          Reset
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {POSTURES.map((posture) => (
          <button
            key={posture.id}
            type="button"
            aria-pressed={controls.posture === posture.id}
            onClick={() => onChange({ ...controls, posture: posture.id })}
            className={chipClass(controls.posture === posture.id)}
          >
            {posture.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={!controls.moving}
          onClick={() => onChange({ ...controls, moving: !controls.moving })}
          className={chipClass(!controls.moving)}
        >
          {controls.moving ? "Shifting" : "Held still"}
        </button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Range
          label="Room tone"
          min={0}
          max={0.2}
          step={0.005}
          value={controls.ambient}
          onChange={(ambient) => onChange({ ...controls, ambient })}
          format={(value) => value.toFixed(3)}
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Heart-rate band</span>
            <button
              type="button"
              aria-pressed={controls.wearable}
              onClick={() => onChange({ ...controls, wearable: !controls.wearable })}
              className={chipClass(controls.wearable)}
            >
              {controls.wearable ? "Paired" : "Unpaired"}
            </button>
          </div>
          <Range
            label="Heart rate"
            min={48}
            max={150}
            step={1}
            value={controls.hr}
            onChange={(hr) => onChange({ ...controls, hr })}
            format={(value) => `${Math.round(value)} bpm`}
            disabled={!controls.wearable}
          />
        </div>
      </div>
    </section>
  );
}

function TogglePair<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={chipClass(value === option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Plan({ snap }: { snap: Snapshot }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Watched rooms</h2>
        <p className="text-xs text-faint">
          {snap.contextActive
            ? `Listening ${Math.ceil(snap.contextLeft)}s`
            : "Asleep"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Room name="Bedroom" zone="bedroom" snap={snap} footnote="Bed · chair" />
        <Room name="Bathroom" zone="bathroom" snap={snap} footnote="Bath" />
      </div>
    </section>
  );
}

function Room({
  name,
  zone,
  snap,
  footnote,
}: {
  name: string;
  zone: Zone;
  snap: Snapshot;
  footnote: string;
}) {
  const here = snap.zone === zone;
  const open = here && snap.doorOpen;
  const showBody =
    here && snap.contextActive && snap.thermal.centroidY != null && snap.thermal.centroidX != null;
  return (
    <div
      className={
        here
          ? "relative h-40 overflow-hidden rounded-sm border border-foreground p-3 md:h-48"
          : "relative h-40 overflow-hidden rounded-sm border border-border p-3 md:h-48"
      }
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium">{name}</h3>
        <DoorOpen className={open ? "size-4 text-foreground" : "size-4 text-faint"} />
      </div>
      <p className="mt-1 text-xs text-faint">{open ? "Door open" : "Door shut"}</p>
      <p className="absolute bottom-3 left-3 text-xs text-faint">{footnote}</p>
      {showBody ? (
        <span
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{
            left: `${(snap.thermal.centroidX ?? 0.5) * 100}%`,
            top: `${(snap.thermal.centroidY ?? 0.5) * 100}%`,
          }}
        />
      ) : null}
    </div>
  );
}

function ThermalCard({ snap, floorY }: { snap: Snapshot; floorY: number }) {
  const thermal = snap.thermal;
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Thermometer className="size-4 text-muted" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-medium">Thermal array</h2>
            <p className="text-xs text-faint">32×24 · floor line is the tick</p>
          </div>
        </div>
        <p className="font-mono text-sm tabular-nums">
          {thermal.reporting ? formatProb(thermal.confidence, 2) : "—"}
        </p>
      </div>
      <ThermalCanvas frame={snap.frame} floorY={floorY} />
      <p className="px-4 py-3 text-xs leading-relaxed text-faint">
        {thermal.reporting
          ? `${thermal.reason === "no_human_blob" ? "No blob" : thermal.floor ? "Floor" : "Above floor"} · ${
              thermal.still ? "still" : "not still"
            } · ${thermal.pixels} px · window ${thermal.historyCount}`
          : "Array asleep until a watched door opens."}
        {thermal.centroidY != null ? ` · y ${thermal.centroidY.toFixed(2)}` : ""}
      </p>
    </section>
  );
}

function Evidence({ snap, config }: { snap: Snapshot; config: FusionConfig }) {
  const audio = snap.fusion.contributions.audio;
  const thermal = snap.fusion.contributions.thermal;
  const wearable = snap.fusion.contributions.wearable;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium">Modalities</h2>
      <p className="mt-1 text-xs leading-relaxed text-faint">{renormLine(snap)}</p>
      <div className="mt-4 flex flex-col gap-4">
        <ModalityRow
          icon={<DoorOpen className="size-4" />}
          title="Door"
          tier="Tier 1 · context"
          value="—"
          detail={
            snap.contextActive
              ? `${snap.zone} · ${Math.ceil(snap.contextLeft)}s window`
              : "No window · does not vote"
          }
          logodds={null}
        />
        <div>
          <ModalityRow
            icon={<Activity className="size-4" />}
            title="Audio"
            tier="Tier 2 · impact"
            value={snap.audio.ignored ? "—" : formatProb(snap.audio.confidence, 2)}
            detail={
              snap.audio.ignored
                ? "Asleep"
                : snap.audio.held
                  ? `Held ${Math.ceil(snap.audio.holdLeft)}s · rms ${snap.audio.rms.toFixed(2)}`
                  : `Live · rms ${snap.audio.rms.toFixed(2)}`
            }
            logodds={audio?.logodds ?? null}
            weight={audio?.weight ?? null}
            prior={config.weights.audio}
          />
          <div className="mt-2 overflow-hidden rounded-sm">
            <WaveCanvas samples={snap.rmsHistory} />
          </div>
        </div>
        <ModalityRow
          icon={<Thermometer className="size-4" />}
          title="Thermal"
          tier="Tier 2 · posture"
          value={snap.thermal.reporting ? formatProb(snap.thermal.confidence, 2) : "—"}
          detail={
            snap.thermal.reporting
              ? snap.thermal.floor && snap.thermal.still
                ? "Floor and still · 0.90"
                : snap.thermal.floor
                  ? "Floor, not still · 0.50"
                  : snap.thermal.still
                    ? "Still, off the floor · 0.20"
                    : "Blob present · 0.05"
              : "Asleep"
          }
          logodds={thermal?.logodds ?? null}
          weight={thermal?.weight ?? null}
          prior={config.weights.thermal}
        />
        <ModalityRow
          icon={<Watch className="size-4" />}
          title="Band"
          tier="Tier 3 · enrichment"
          value={
            snap.wearable.confidence == null ? "—" : formatProb(snap.wearable.confidence, 2)
          }
          detail={wearableDetail(snap)}
          logodds={wearable?.logodds ?? null}
          weight={wearable?.weight ?? null}
          prior={config.weights.wearable}
        />
      </div>
    </section>
  );
}

function wearableDetail(snap: Snapshot): string {
  if (!snap.wearable.paired) return "Unpaired · prior returns to the room";
  if (snap.wearable.abstained) {
    return `Baseline ${snap.wearable.hr} bpm · abstains`;
  }
  return `${snap.wearable.hr} bpm · Δ ${Math.round(snap.wearable.delta ?? 0)} · cap 0.40`;
}

function renormLine(snap: Snapshot): string {
  const parts = (["thermal", "audio", "wearable"] as const)
    .map((key) => {
      const row = snap.fusion.contributions[key];
      if (!row) return null;
      const label = key === "wearable" ? "Band" : key === "audio" ? "Audio" : "Thermal";
      return `${label} ${Math.round(row.weight * 100)}%`;
    })
    .filter((part): part is string => part != null);
  if (parts.length === 0) return "Nothing is in the fuse.";
  const extra = !snap.wearable.paired
    ? "Unpaired band is left out, then weights renormalize."
    : snap.wearable.abstained
      ? "Baseline heart rate is left out of this tick."
      : "Weights are renormalized over who is present.";
  return `${parts.join(" · ")}. ${extra}`;
}

function ModalityRow({
  icon,
  title,
  tier,
  value,
  detail,
  logodds,
  weight,
  prior,
}: {
  icon: ReactNode;
  title: string;
  tier: string;
  value: string;
  detail: string;
  logodds: number | null;
  weight?: number | null;
  prior?: number;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-3">
      <span className="mt-0.5 text-muted" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium">{title}</h3>
          <span className="text-xs text-faint">{tier}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
        {logodds != null ? (
          <LogOddsBar value={logodds} />
        ) : (
          <div className="mt-2 h-px bg-border" />
        )}
        {weight != null && prior != null ? (
          <p className="mt-1 font-mono text-xs tabular-nums text-faint">
            prior {prior.toFixed(2)} · vote {Math.round(weight * 100)}% · {formatSigned(logodds ?? 0)}
          </p>
        ) : null}
      </div>
      <p className="font-mono text-sm tabular-nums">{value}</p>
    </div>
  );
}

function LogOddsBar({ value }: { value: number }) {
  const clamped = Math.max(-4, Math.min(4, value));
  const width = (Math.abs(clamped) / 4) * 50;
  const left = clamped >= 0 ? 50 : 50 - width;
  return (
    <div className="relative mt-2 h-3">
      <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <div className="absolute top-1/2 left-1/2 h-2 w-px -translate-y-1/2 bg-faint" />
      <div
        className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-foreground"
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </div>
  );
}

function ScoreTrace({
  snap,
  config,
  mounted,
}: {
  snap: Snapshot;
  config: FusionConfig;
  mounted: boolean;
}) {
  const data = snap.trace.map((point) => ({
    t: point.t,
    p: point.p,
  }));
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Score</h2>
        <p className="text-xs text-faint">Confirm and alert are the dashed lines</p>
      </div>
      <div className="h-24 w-full">
        {mounted && data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <YAxis domain={[0, 1]} hide />
              <ReferenceLine
                y={config.confirmThreshold}
                stroke="var(--color-faint)"
                strokeDasharray="2 3"
              />
              <ReferenceLine
                y={config.alertThreshold}
                stroke="var(--color-alert)"
                strokeDasharray="2 3"
              />
              <Line
                type="stepAfter"
                dataKey="p"
                stroke="var(--color-foreground)"
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full border-b border-border" />
        )}
      </div>
    </section>
  );
}

function BeatLog({ snap }: { snap: Snapshot }) {
  const beats = snap.beats.slice(-5);
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium">What changed</h2>
      {beats.length === 0 ? (
        <p className="mt-2 text-sm text-faint">No decision yet.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {beats.map((beat, index) => (
            <li key={`${beat.t}-${beat.verdict}-${index}`} className="grid grid-cols-[5.5rem_4.5rem_1fr] gap-2">
              <span className="font-mono text-xs tabular-nums text-faint">{beat.clock}</span>
              <span
                className={
                  beat.verdict === "ALERT_FALL" ? "text-xs text-alert" : "text-xs text-foreground"
                }
              >
                {verdictLabel(beat.verdict)}
              </span>
              <span className="text-xs leading-relaxed text-muted">{beat.note}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Calibration({
  config,
  onChange,
  onReset,
}: {
  config: FusionConfig;
  onChange: (next: FusionConfig) => void;
  onReset: () => void;
}) {
  function patch(partial: Partial<FusionConfig>) {
    onChange({ ...config, ...partial });
  }
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Calibration</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-faint">
            These are priors. Thermal carries posture, audio carries impact, the band is optional.
            A missing modality drops out and the remaining weights renormalize.
          </p>
        </div>
        <button type="button" onClick={onReset} className={ghostBtn}>
          Restore
        </button>
      </div>
      <div className="mt-4 grid gap-x-8 gap-y-1 md:grid-cols-2">
        <Range
          label="Audio prior"
          min={0}
          max={1}
          step={0.05}
          value={config.weights.audio}
          onChange={(audio) => patch({ weights: { ...config.weights, audio } })}
          format={(value) => value.toFixed(2)}
        />
        <Range
          label="Thermal prior"
          min={0}
          max={1}
          step={0.05}
          value={config.weights.thermal}
          onChange={(thermal) => patch({ weights: { ...config.weights, thermal } })}
          format={(value) => value.toFixed(2)}
        />
        <Range
          label="Band prior"
          min={0}
          max={1}
          step={0.05}
          value={config.weights.wearable}
          onChange={(wearable) => patch({ weights: { ...config.weights, wearable } })}
          format={(value) => value.toFixed(2)}
        />
        <Range
          label="Alert line"
          min={0.5}
          max={0.95}
          step={0.01}
          value={config.alertThreshold}
          onChange={(alertThreshold) =>
            patch({
              alertThreshold,
              confirmThreshold: Math.min(config.confirmThreshold, alertThreshold - 0.01),
            })
          }
          format={(value) => value.toFixed(2)}
        />
        <Range
          label="Confirm line"
          min={0.3}
          max={Math.max(0.31, config.alertThreshold - 0.01)}
          step={0.01}
          value={config.confirmThreshold}
          onChange={(confirmThreshold) => patch({ confirmThreshold })}
          format={(value) => value.toFixed(2)}
        />
        <Range
          label="Floor if centroid y ≥"
          hint="0 is the top of the array, 1 is the bottom. 0.35 matches a 1 m mount."
          min={0.15}
          max={0.9}
          step={0.01}
          value={config.floorCentroidThreshold}
          onChange={(floorCentroidThreshold) => patch({ floorCentroidThreshold })}
          format={(value) => value.toFixed(2)}
        />
        <Range
          label="Still if spread <"
          min={0.02}
          max={0.25}
          step={0.01}
          value={config.stillnessSpread}
          onChange={(stillnessSpread) => patch({ stillnessSpread })}
          format={(value) => value.toFixed(2)}
        />
        <Range
          label="Hold an impact"
          hint="A thud is shorter than the stillness window, so the latest audio event is latched."
          min={0}
          max={20}
          step={1}
          value={config.impactHoldSec}
          onChange={(impactHoldSec) => patch({ impactHoldSec })}
          format={(value) => `${Math.round(value)}s`}
        />
        <Range
          label="Context window"
          min={5}
          max={180}
          step={5}
          value={config.contextWindowSec}
          onChange={(contextWindowSec) => patch({ contextWindowSec })}
          format={(value) => `${Math.round(value)}s`}
        />
      </div>
      <div className="mt-4">
        <p className="text-sm">Modalities required</p>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3].map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={config.minActive === count}
              onClick={() => patch({ minActive: count })}
              className={chipClass(config.minActive === count)}
            >
              {count}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-faint">
          Pilot default is 2. One lets a single stream reach the line. Three means the band must be present.
        </p>
      </div>
    </section>
  );
}

function Range({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
  format,
  hideValue,
  disabled,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  hideValue?: boolean;
  disabled?: boolean;
}) {
  const safe = Math.min(max, Math.max(min, value));
  return (
    <label className={disabled ? "flex flex-col gap-1 opacity-40" : "flex flex-col gap-1"}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{label}</span>
        {hideValue ? null : (
          <span className="font-mono text-xs tabular-nums text-muted">{format(safe)}</span>
        )}
      </span>
      {hint ? <span className="text-xs leading-relaxed text-faint">{hint}</span> : null}
      <Slider.Root
        className="relative flex h-11 w-full touch-none items-center select-none"
        min={min}
        max={max}
        step={step}
        value={[safe]}
        disabled={disabled}
        onValueChange={(next) => onChange(next[0] ?? safe)}
        aria-label={label}
      >
        <Slider.Track className="relative h-px w-full grow bg-border">
          <Slider.Range className="absolute h-px bg-foreground" />
        </Slider.Track>
        <Slider.Thumb className="block size-5 rounded-full border border-foreground bg-background" />
      </Slider.Root>
    </label>
  );
}

function Contract() {
  return (
    <details className="rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-medium">How a score is built</summary>
      <div className="mt-3 flex max-w-3xl flex-col gap-3 text-sm leading-relaxed text-muted">
        <p>
          Each awake sensor emits an independent confidence. The fuse is weighted log-odds:
          sigmoid of the renormalized priors times logit(confidence). The door’s weight is zero.
        </p>
        <p className="font-mono text-xs text-foreground">
          p = σ( Σ wᵢ · logit(cᵢ) )
        </p>
        <p>
          Audio confidence is a sigmoid on RMS, centered at 0.15. Above 0.60 it latches for the hold,
          because fuse() only sees the latest event and a thud would otherwise vanish before the
          thermal window fills. Set the hold to 0 to keep only the live sample.
        </p>
        <p>
          Thermal confidence is 0.90 only when the centroid is at or below the floor line and its
          vertical spread stays inside the stillness gate. Floor but moving is 0.50. Still and off
          the floor is 0.20. Anything else with a blob is 0.05. Fewer than six warm pixels clears
          the window.
        </p>
        <p>
          The band speaks Heart Rate Service 0x180D, measurement 0x2A37. A rise contributes
          min(0.40, Δ / 40). That cap sits below one half, so the log-odds are negative: the band
          cannot lift an alert. At baseline it abstains instead of voting near-zero, which would
          veto the room. Unpaired, it is simply absent.
        </p>
      </div>
    </details>
  );
}

function seedBench(controls: BenchControls, config: FusionConfig) {
  return stepSim(
    initialSimState(),
    {
      t: 0,
      zone: controls.zone,
      armContext: false,
      doorOpen: controls.doorOpen,
      rms: controls.ambient,
      posture: controls.posture,
      moving: controls.moving,
      hr: controls.wearable ? controls.hr : null,
      caption: benchCaption(controls),
      clockOrigin: 3 * 3600 + 14 * 60,
    },
    config,
  );
}

function benchCaption(controls: BenchControls): string {
  const where = controls.zone === "bathroom" ? "Bathroom" : "Bedroom";
  const pose =
    controls.posture === "empty"
      ? "no one in frame"
      : controls.posture === "chair"
        ? "reclined in the chair"
        : controls.posture === "floor"
          ? "on the floor"
          : controls.posture;
  const motion = controls.moving ? "shifting" : "held still";
  return controls.doorOpen
    ? `${where} door is open. ${pose}, ${motion}.`
    : `${where} door is shut. Sensors sleep until it opens.`;
}
