export const DT = 0.2;
export const THERMAL_H = 24;
export const THERMAL_W = 32;

export type Modality = "door" | "audio" | "thermal" | "wearable";
export type Zone = "bathroom" | "bedroom";
export type Posture = "empty" | "standing" | "sitting" | "chair" | "floor";
export type Verdict = "ALERT_FALL" | "CONFIRM_PENDING" | "NO_ALERT" | "insufficient_evidence";

export interface FusionConfig {
  weights: { audio: number; thermal: number; wearable: number };
  alertThreshold: number;
  confirmThreshold: number;
  minActive: number;
  floorCentroidThreshold: number;
  stillnessFrames: number;
  stillnessSpread: number;
  humanTempMin: number;
  humanTempMax: number;
  audioCenter: number;
  audioGain: number;
  impactThreshold: number;
  impactHoldSec: number;
  contextWindowSec: number;
}

export interface SensorEvent {
  modality: Modality;
  timestamp: number;
  confidence: number;
  payload: Record<string, number | string | boolean | null>;
}

export interface Contribution {
  weight: number;
  confidence: number;
  logodds: number;
}

export interface FusionResult {
  verdict: Verdict;
  fusedProbability: number | null;
  fusedLogOdds: number | null;
  activeModalities: Modality[];
  contributions: Partial<Record<Modality, Contribution>>;
}

export interface TracePoint {
  t: number;
  p: number | null;
  verdict: Verdict;
}

export interface Beat {
  t: number;
  clock: string;
  verdict: Verdict;
  p: number | null;
  note: string;
}

export interface Snapshot {
  t: number;
  clock: string;
  caption: string;
  zone: Zone;
  doorOpen: boolean;
  contextActive: boolean;
  contextLeft: number;
  posture: Posture;
  moving: boolean;
  frame: number[][] | null;
  audio: {
    rms: number;
    confidence: number;
    held: boolean;
    holdLeft: number;
    ignored: boolean;
  };
  thermal: {
    reporting: boolean;
    confidence: number;
    floor: boolean;
    still: boolean;
    pixels: number;
    centroidY: number | null;
    centroidX: number | null;
    reason: string | null;
    historyCount: number;
  };
  wearable: {
    paired: boolean;
    hr: number | null;
    baseline: number | null;
    delta: number | null;
    confidence: number | null;
    abstained: boolean;
  };
  fusion: FusionResult;
  unpairedProbability: number | null;
  trace: TracePoint[];
  beats: Beat[];
  rmsHistory: number[];
}

export interface StepInput {
  t: number;
  zone: Zone;
  armContext: boolean;
  doorOpen: boolean;
  rms: number;
  posture: Posture;
  moving: boolean;
  hr: number | null;
  caption: string;
  clockOrigin: number;
  disarm?: boolean;
}

export interface SimState {
  lastDoor: number;
  thermalHistory: number[];
  hold: { until: number; confidence: number; rms: number } | null;
  baselineHr: number | null;
  rmsHistory: number[];
  trace: TracePoint[];
  beats: Beat[];
  lastVerdict: Verdict | null;
  view: Snapshot;
}

export interface Segment {
  end: number;
  zone: Zone;
  doorOpen: boolean;
  armContext: boolean;
  rms: number;
  posture: Posture;
  moving: boolean;
  hr: number | null;
  caption: string;
}

export interface Scenario {
  id: string;
  kicker: string;
  title: string;
  summary: string;
  duration: number;
  showcaseAt: number;
  clockOrigin: number;
  segments: Segment[];
}

interface BodySpec {
  cy: number;
  cx: number;
  rx: number;
  ry: number;
  temp: number;
}

const BODIES: Record<Exclude<Posture, "empty">, BodySpec> = {
  standing: { cy: 0.16, cx: 0.5, rx: 3.0, ry: 3.6, temp: 33 },
  sitting: { cy: 0.2, cx: 0.46, rx: 4.2, ry: 2.4, temp: 33 },
  chair: { cy: 0.2, cx: 0.64, rx: 5.2, ry: 2.2, temp: 32.5 },
  floor: { cy: 0.84, cx: 0.48, rx: 7.2, ry: 2.0, temp: 33 },
};

export function defaultConfig(): FusionConfig {
  return {
    weights: { audio: 0.35, thermal: 0.45, wearable: 0.2 },
    alertThreshold: 0.85,
    confirmThreshold: 0.6,
    minActive: 2,
    floorCentroidThreshold: 0.35,
    stillnessFrames: 5,
    stillnessSpread: 0.08,
    humanTempMin: 28,
    humanTempMax: 38,
    audioCenter: 0.15,
    audioGain: 20,
    impactThreshold: 0.6,
    impactHoldSec: 12,
    contextWindowSec: 120,
  };
}

export function logit(p: number, eps = 1e-6): number {
  const c = Math.min(1 - eps, Math.max(eps, p));
  return Math.log(c / (1 - c));
}

export function sigmoid(x: number): number {
  if (x > 30) return 1;
  if (x < -30) return 0;
  return 1 / (1 + Math.exp(-x));
}

export function audioConfidence(rms: number, config: FusionConfig): number {
  const raw = 1 / (1 + Math.exp(-(rms - config.audioCenter) * config.audioGain));
  return Math.min(1, Math.max(0, raw));
}

export function clockFrom(origin: number, t: number): string {
  const total = Math.floor(origin + Math.max(0, t)) % 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function renderFrame(posture: Posture, t: number, moving: boolean): number[][] {
  const frame: number[][] = Array.from({ length: THERMAL_H }, () => Array(THERMAL_W).fill(22));
  if (posture === "empty") return frame;
  const spec = BODIES[posture];
  const jitter = moving ? Math.sin(t * 7) * 0.05 : 0;
  const cy = clamp(spec.cy + jitter, 0.04, 0.96);
  const cyPx = cy * THERMAL_H;
  const cxPx = spec.cx * THERMAL_W;
  for (let y = 0; y < THERMAL_H; y++) {
    for (let x = 0; x < THERMAL_W; x++) {
      const ny = (y + 0.5 - cyPx) / spec.ry;
      const nx = (x + 0.5 - cxPx) / spec.rx;
      if (nx * nx + ny * ny <= 1) frame[y]![x] = spec.temp;
    }
  }
  return frame;
}

interface ThermalReading {
  confidence: number;
  floor: boolean;
  still: boolean;
  pixels: number;
  centroidY: number | null;
  centroidX: number | null;
  reason: string | null;
  history: number[];
}

function readThermal(historyIn: number[], frame: number[][], config: FusionConfig): ThermalReading {
  const history = historyIn.slice();
  let pixels = 0;
  let sumY = 0;
  let sumX = 0;
  for (let y = 0; y < frame.length; y++) {
    const row = frame[y]!;
    for (let x = 0; x < row.length; x++) {
      const temp = row[x]!;
      if (temp >= config.humanTempMin && temp <= config.humanTempMax) {
        pixels += 1;
        sumY += y;
        sumX += x;
      }
    }
  }
  if (pixels < 6) {
    return {
      confidence: 0,
      floor: false,
      still: false,
      pixels,
      centroidY: null,
      centroidX: null,
      reason: "no_human_blob",
      history: [],
    };
  }
  const cy = sumY / pixels / frame.length;
  const cx = sumX / pixels / frame[0]!.length;
  history.push(cy);
  const maxKeep = Math.max(1, config.stillnessFrames);
  while (history.length > maxKeep) history.shift();
  const floor = cy >= config.floorCentroidThreshold;
  let still = false;
  if (history.length === config.stillnessFrames) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of history) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    still = hi - lo < config.stillnessSpread;
  }
  let confidence = 0.05;
  if (floor && still) confidence = 0.9;
  else if (floor) confidence = 0.5;
  else if (still && pixels > 20) confidence = 0.2;
  return {
    confidence,
    floor,
    still,
    pixels,
    centroidY: cy,
    centroidX: cx,
    reason: null,
    history,
  };
}

export function fuse(events: SensorEvent[], config: FusionConfig): FusionResult {
  const latest = new Map<Modality, SensorEvent>();
  for (const event of events) {
    const prev = latest.get(event.modality);
    if (!prev || event.timestamp >= prev.timestamp) latest.set(event.modality, event);
  }
  const order: Array<"audio" | "thermal" | "wearable"> = ["audio", "thermal", "wearable"];
  const evidence = order.filter((m) => config.weights[m] > 0 && latest.has(m));
  if (evidence.length < config.minActive) {
    return {
      verdict: "insufficient_evidence",
      fusedProbability: null,
      fusedLogOdds: null,
      activeModalities: evidence,
      contributions: {},
    };
  }
  const total = evidence.reduce((sum, m) => sum + config.weights[m], 0);
  let logOdds = 0;
  const contributions: FusionResult["contributions"] = {};
  for (const m of evidence) {
    const weight = config.weights[m] / total;
    const confidence = latest.get(m)!.confidence;
    const lo = logit(confidence);
    logOdds += weight * lo;
    contributions[m] = { weight, confidence, logodds: lo };
  }
  const probability = sigmoid(logOdds);
  const alert = config.alertThreshold;
  const confirm = Math.min(config.confirmThreshold, Math.max(0, alert - 0.01));
  let verdict: Verdict = "NO_ALERT";
  if (probability >= alert) verdict = "ALERT_FALL";
  else if (probability >= confirm) verdict = "CONFIRM_PENDING";
  return {
    verdict,
    fusedProbability: probability,
    fusedLogOdds: logOdds,
    activeModalities: evidence,
    contributions,
  };
}

function emptyThermal(): Snapshot["thermal"] {
  return {
    reporting: false,
    confidence: 0,
    floor: false,
    still: false,
    pixels: 0,
    centroidY: null,
    centroidX: null,
    reason: "asleep",
    historyCount: 0,
  };
}

function placeholderSnapshot(): Snapshot {
  const config = defaultConfig();
  return {
    t: 0,
    clock: "03:14:02",
    caption: "House is quiet.",
    zone: "bathroom",
    doorOpen: false,
    contextActive: false,
    contextLeft: 0,
    posture: "empty",
    moving: false,
    frame: null,
    audio: { rms: 0, confidence: 0, held: false, holdLeft: 0, ignored: true },
    thermal: emptyThermal(),
    wearable: {
      paired: false,
      hr: null,
      baseline: null,
      delta: null,
      confidence: null,
      abstained: false,
    },
    fusion: fuse([], config),
    unpairedProbability: null,
    trace: [],
    beats: [],
    rmsHistory: [],
  };
}

export function initialSimState(): SimState {
  return {
    lastDoor: -1,
    thermalHistory: [],
    hold: null,
    baselineHr: null,
    rmsHistory: [],
    trace: [],
    beats: [],
    lastVerdict: null,
    view: placeholderSnapshot(),
  };
}

function beatNote(verdict: Verdict, thermal: ThermalReading, audioHeld: boolean): string {
  if (verdict === "insufficient_evidence") return "Not enough evidence modalities to fuse.";
  if (verdict === "ALERT_FALL") return "Impact and a still floor-level blob agree.";
  if (verdict === "CONFIRM_PENDING" && thermal.floor && !thermal.still) {
    return "On the floor, stillness window still open.";
  }
  if (verdict === "CONFIRM_PENDING" && audioHeld && !thermal.floor) {
    return "Impact held. Posture is not on the floor.";
  }
  if (verdict === "CONFIRM_PENDING") return "Score is in the confirm band.";
  if (thermal.still && !thermal.floor) return "Still, and the centroid is off the floor.";
  if (thermal.floor && thermal.still) return "Floor-level and still, without a confirming impact.";
  return "Under the confirm line.";
}

export function stepSim(state: SimState, input: StepInput, config: FusionConfig): SimState {
  const lastDoor = input.disarm ? -1 : input.armContext ? input.t : state.lastDoor;
  const contextActive = lastDoor >= 0 && input.t - lastDoor <= config.contextWindowSec;
  const contextLeft = contextActive ? Math.max(0, config.contextWindowSec - (input.t - lastDoor)) : 0;

  const inst = audioConfidence(input.rms, config);
  let hold = state.hold;
  if (contextActive && inst >= config.impactThreshold && config.impactHoldSec > 0) {
    hold = { until: input.t + config.impactHoldSec, confidence: inst, rms: input.rms };
  }
  const held = Boolean(hold && input.t <= hold.until && config.impactHoldSec > 0);
  const audioConf = contextActive ? (held && hold ? hold.confidence : inst) : inst;
  const holdLeft = held && hold ? Math.max(0, hold.until - input.t) : 0;

  let thermalHistory = contextActive ? state.thermalHistory : [];
  let thermal = emptyThermal();
  let frame: number[][] | null = null;
  if (contextActive) {
    frame = renderFrame(input.posture, input.t, input.moving);
    const reading = readThermal(thermalHistory, frame, config);
    thermalHistory = reading.history;
    thermal = {
      reporting: true,
      confidence: reading.confidence,
      floor: reading.floor,
      still: reading.still,
      pixels: reading.pixels,
      centroidY: reading.centroidY,
      centroidX: reading.centroidX,
      reason: reading.reason,
      historyCount: thermalHistory.length,
    };
  }

  let baselineHr = state.baselineHr;
  let wearableEvent: SensorEvent | null = null;
  const paired = input.hr != null;
  let delta: number | null = null;
  let wearableConf: number | null = null;
  let abstained = false;
  if (input.hr != null) {
    if (baselineHr == null) baselineHr = input.hr;
    delta = input.hr - baselineHr;
    if (delta > 0) {
      wearableConf = Math.min(0.4, delta / 40);
      wearableEvent = {
        modality: "wearable",
        timestamp: input.t,
        confidence: wearableConf,
        payload: { hr: input.hr, delta },
      };
    } else {
      abstained = true;
    }
  }

  const events: SensorEvent[] = [];
  if (contextActive) {
    events.push({
      modality: "audio",
      timestamp: input.t,
      confidence: audioConf,
      payload: { rms: input.rms, held },
    });
    events.push({
      modality: "thermal",
      timestamp: input.t,
      confidence: thermal.confidence,
      payload: {
        floor: thermal.floor,
        still: thermal.still,
        pixels: thermal.pixels,
      },
    });
  }
  if (wearableEvent) events.push(wearableEvent);

  const fusion = fuse(events, config);
  const withoutWearable = fuse(
    events.filter((event) => event.modality !== "wearable"),
    config,
  );
  const unpairedProbability =
    wearableEvent && withoutWearable.fusedProbability != null
      ? withoutWearable.fusedProbability
      : null;

  const rmsHistory = state.rmsHistory.slice(-47);
  rmsHistory.push(input.rms);

  const trace = state.trace.slice(-159);
  trace.push({
    t: Math.round(input.t * 100) / 100,
    p: fusion.fusedProbability,
    verdict: fusion.verdict,
  });

  const readingForNote: ThermalReading = {
    confidence: thermal.confidence,
    floor: thermal.floor,
    still: thermal.still,
    pixels: thermal.pixels,
    centroidY: thermal.centroidY,
    centroidX: thermal.centroidX,
    reason: thermal.reason,
    history: thermalHistory,
  };
  const beats = state.beats.slice(-23);
  if (fusion.verdict !== state.lastVerdict) {
    beats.push({
      t: input.t,
      clock: clockFrom(input.clockOrigin, input.t),
      verdict: fusion.verdict,
      p: fusion.fusedProbability,
      note: beatNote(fusion.verdict, readingForNote, held),
    });
  }

  const view: Snapshot = {
    t: input.t,
    clock: clockFrom(input.clockOrigin, input.t),
    caption: input.caption,
    zone: input.zone,
    doorOpen: input.doorOpen,
    contextActive,
    contextLeft,
    posture: input.posture,
    moving: input.moving,
    frame,
    audio: {
      rms: input.rms,
      confidence: contextActive ? audioConf : 0,
      held: contextActive && held,
      holdLeft: contextActive ? holdLeft : 0,
      ignored: !contextActive,
    },
    thermal,
    wearable: {
      paired,
      hr: input.hr,
      baseline: baselineHr,
      delta,
      confidence: wearableConf,
      abstained,
    },
    fusion,
    unpairedProbability,
    trace,
    beats,
    rmsHistory,
  };

  return {
    lastDoor,
    thermalHistory,
    hold: contextActive ? hold : state.hold,
    baselineHr,
    rmsHistory,
    trace,
    beats,
    lastVerdict: fusion.verdict,
    view,
  };
}

export function segmentIndex(scenario: Scenario, t: number): number {
  const index = scenario.segments.findIndex((segment) => t < segment.end - 1e-9);
  if (index === -1) return scenario.segments.length - 1;
  return index;
}

export function simulate(scenario: Scenario, tEnd: number, config: FusionConfig): Snapshot {
  const end = clamp(tEnd, 0, scenario.duration);
  const steps = Math.round(end / DT);
  let state = initialSimState();
  let prevIndex = -1;
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(end, Math.round(i * DT * 1000) / 1000);
    const index = segmentIndex(scenario, t === scenario.duration ? t - 1e-6 : t);
    const segment = scenario.segments[index]!;
    const armContext = index !== prevIndex && segment.armContext;
    prevIndex = index;
    state = stepSim(
      state,
      {
        t,
        zone: segment.zone,
        armContext,
        doorOpen: segment.doorOpen,
        rms: segment.rms,
        posture: segment.posture,
        moving: segment.moving,
        hr: segment.hr,
        caption: segment.caption,
        clockOrigin: scenario.clockOrigin,
      },
      config,
    );
  }
  return state.view;
}

export function explain(snap: Snapshot, config: FusionConfig): string {
  const { fusion, thermal, audio, contextActive, wearable } = snap;
  if (!contextActive && fusion.verdict === "insufficient_evidence") {
    return "No watched door has opened. Audio and thermal stay asleep, so there is nothing to fuse. The door never votes — it only decides when to listen.";
  }
  if (fusion.verdict === "insufficient_evidence") {
    const count = fusion.activeModalities.length;
    return `${count} evidence ${count === 1 ? "modality is" : "modalities are"} reporting. The gate wants ${config.minActive}, so this cannot alert.`;
  }
  if (thermal.reporting && thermal.reason === "no_human_blob") {
    return "The array is awake and there is no human-sized heat blob. Noise in an empty room does not become an alert.";
  }
  if (fusion.verdict === "ALERT_FALL") {
    if (wearable.confidence != null && snap.unpairedProbability != null) {
      return "Impact is held and the blob is on the floor, still. The band is in the fuse but capped at 0.40, so its log-odds stay negative and the score eases down instead of climbing.";
    }
    return "A held impact and a floor-level, still heat blob agree. The door opened the window and then stayed out of the vote.";
  }
  if (fusion.verdict === "CONFIRM_PENDING" && thermal.floor && !thermal.still) {
    return "The centroid is already at floor level, but it has not been still for the full window. That keeps the score under the alert line.";
  }
  if (fusion.verdict === "CONFIRM_PENDING" && !thermal.floor) {
    return "Audio is carrying a held impact, and the array still reads an upright or seated blob. One cue is not allowed to finish the alert.";
  }
  if (fusion.verdict === "CONFIRM_PENDING") {
    return "The fused score sits between confirm and alert. The engine waits rather than paging anyone.";
  }
  if (thermal.reporting && thermal.still && !thermal.floor) {
    return "The blob is still, and it is not on the floor. Sitting on a bed or reclining in a chair stays in this bucket — the case radar tends to collapse.";
  }
  if (thermal.reporting && thermal.floor && thermal.still && !audio.held) {
    return "Floor-level and still, with no impact on the hold. Posture alone stays under the line. A silent collapse is the risk this prior accepts.";
  }
  return "The weighted log-odds stay under the confirm line. Nothing pages the caregiver.";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

const H3 = 3 * 3600;

function seg(partial: Segment): Segment {
  return partial;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "fall",
    kicker: "Canonical",
    title: "Bathroom, 03:14",
    summary:
      "The door wakes the room. A short impact is held, the centroid drops, and stillness is what finally crosses the alert line. No band is paired.",
    duration: 16,
    showcaseAt: 8,
    clockOrigin: H3 + 14 * 60 + 2,
    segments: [
      seg({
        end: 2,
        zone: "bathroom",
        doorOpen: false,
        armContext: false,
        rms: 0.03,
        posture: "empty",
        moving: false,
        hr: null,
        caption: "Night is quiet. Watched doors are shut, so the array and the microphone stay asleep.",
      }),
      seg({
        end: 4.2,
        zone: "bathroom",
        doorOpen: true,
        armContext: true,
        rms: 0.08,
        posture: "standing",
        moving: true,
        hr: null,
        caption: "Bathroom door. The context window opens. The blob is upright and moving — not evidence of a fall.",
      }),
      seg({
        end: 5,
        zone: "bathroom",
        doorOpen: true,
        armContext: false,
        rms: 0.32,
        posture: "floor",
        moving: true,
        hr: null,
        caption: "A short, sharp transient. Audio latches. The centroid is dropping and has not gone still.",
      }),
      seg({
        end: 16,
        zone: "bathroom",
        doorOpen: true,
        armContext: false,
        rms: 0.035,
        posture: "floor",
        moving: false,
        hr: null,
        caption: "The room is quiet again. The impact is still on hold, and the blob rests at floor level.",
      }),
    ],
  },
  {
    id: "bed",
    kicker: "Not a fall",
    title: "Sat on the bed",
    summary:
      "Bedroom door, then a still blob whose centroid stays above the floor line. This is the posture radar tends to merge with a fall.",
    duration: 14,
    showcaseAt: 7,
    clockOrigin: H3 + 22 * 60,
    segments: [
      seg({
        end: 1.6,
        zone: "bedroom",
        doorOpen: false,
        armContext: false,
        rms: 0.03,
        posture: "empty",
        moving: false,
        hr: null,
        caption: "Bedroom is idle. Modalities asleep.",
      }),
      seg({
        end: 3.4,
        zone: "bedroom",
        doorOpen: true,
        armContext: true,
        rms: 0.07,
        posture: "standing",
        moving: true,
        hr: null,
        caption: "Door opens. Someone is upright and crossing the room.",
      }),
      seg({
        end: 14,
        zone: "bedroom",
        doorOpen: true,
        armContext: false,
        rms: 0.04,
        posture: "sitting",
        moving: false,
        hr: null,
        caption: "They sit on the bed. The blob is still. Its centroid never reaches the floor band.",
      }),
    ],
  },
  {
    id: "chair",
    kicker: "Not a fall",
    title: "Reclined in the chair",
    summary:
      "A long stillness in the chair. Thermal keeps the centroid off the floor, so a stationary body does not become an alert.",
    duration: 14,
    showcaseAt: 7,
    clockOrigin: H3 + 40 * 60,
    segments: [
      seg({
        end: 1.6,
        zone: "bedroom",
        doorOpen: false,
        armContext: false,
        rms: 0.04,
        posture: "empty",
        moving: false,
        hr: null,
        caption: "Before the door, the array is off.",
      }),
      seg({
        end: 3.6,
        zone: "bedroom",
        doorOpen: true,
        armContext: true,
        rms: 0.09,
        posture: "standing",
        moving: true,
        hr: null,
        caption: "Bedroom door. Ordinary movement, ordinary room tone.",
      }),
      seg({
        end: 14,
        zone: "bedroom",
        doorOpen: true,
        armContext: false,
        rms: 0.07,
        posture: "chair",
        moving: false,
        hr: null,
        caption: "Reclined, still, centroid high in the frame. Radar would struggle to separate this from lying down.",
      }),
    ],
  },
  {
    id: "mug",
    kicker: "Impact only",
    title: "Mug on the tile",
    summary:
      "A real impact while the person stays upright. Audio holds. Thermal refuses the floor, so the score stops in confirm or below.",
    duration: 14,
    showcaseAt: 7,
    clockOrigin: H3 + 18 * 60 + 20,
    segments: [
      seg({
        end: 1.4,
        zone: "bathroom",
        doorOpen: false,
        armContext: false,
        rms: 0.03,
        posture: "empty",
        moving: false,
        hr: null,
        caption: "Bathroom shut. Nothing is listening yet.",
      }),
      seg({
        end: 3.2,
        zone: "bathroom",
        doorOpen: true,
        armContext: true,
        rms: 0.08,
        posture: "standing",
        moving: true,
        hr: null,
        caption: "Door, then an upright blob. Context is on. This is not a fall.",
      }),
      seg({
        end: 4,
        zone: "bathroom",
        doorOpen: true,
        armContext: false,
        rms: 0.32,
        posture: "standing",
        moving: false,
        hr: null,
        caption: "The mug hits tile. Audio latches the transient. The person is still standing.",
      }),
      seg({
        end: 14,
        zone: "bathroom",
        doorOpen: true,
        armContext: false,
        rms: 0.04,
        posture: "standing",
        moving: false,
        hr: null,
        caption: "Impact still on hold. The array keeps an upright, still blob — confidence 0.20, not a floor posture.",
      }),
    ],
  },
  {
    id: "silent",
    kicker: "Posture only",
    title: "On the floor, no impact",
    summary:
      "The array is sure: floor-level and still. There is no impact to hold. With these priors, posture alone does not page anyone.",
    duration: 14,
    showcaseAt: 7,
    clockOrigin: H3 + 51 * 60,
    segments: [
      seg({
        end: 1.6,
        zone: "bedroom",
        doorOpen: false,
        armContext: false,
        rms: 0.03,
        posture: "empty",
        moving: false,
        hr: null,
        caption: "Modalities asleep until a watched door moves.",
      }),
      seg({
        end: 3.2,
        zone: "bedroom",
        doorOpen: true,
        armContext: true,
        rms: 0.06,
        posture: "standing",
        moving: true,
        hr: null,
        caption: "Door opens. They are upright. Room tone stays under the impact gate.",
      }),
      seg({
        end: 14,
        zone: "bedroom",
        doorOpen: true,
        armContext: false,
        rms: 0.035,
        posture: "floor",
        moving: false,
        hr: null,
        caption: "They are on the floor and still. No transient ever crossed the audio gate.",
      }),
    ],
  },
  {
    id: "band",
    kicker: "Enrichment",
    title: "Same fall, band paired",
    summary:
      "Identical room evidence, plus a heart-rate rise on the standard Heart Rate service. The band is capped, so it cannot raise the alert — and the alert still stands without needing it.",
    duration: 16,
    showcaseAt: 8,
    clockOrigin: H3 + 14 * 60 + 2,
    segments: [
      seg({
        end: 2,
        zone: "bathroom",
        doorOpen: false,
        armContext: false,
        rms: 0.03,
        posture: "empty",
        moving: false,
        hr: 72,
        caption: "Band is paired at a resting rate. Until it rises, it abstains and its weight stays unused.",
      }),
      seg({
        end: 4.2,
        zone: "bathroom",
        doorOpen: true,
        armContext: true,
        rms: 0.08,
        posture: "standing",
        moving: true,
        hr: 74,
        caption: "Door opens. Rate is barely off baseline, so the band still contributes nothing.",
      }),
      seg({
        end: 5,
        zone: "bathroom",
        doorOpen: true,
        armContext: false,
        rms: 0.32,
        posture: "floor",
        moving: true,
        hr: 110,
        caption: "Impact, centroid dropping, rate up by more than 30 bpm. Wearable confidence hits the 0.40 cap.",
      }),
      seg({
        end: 16,
        zone: "bathroom",
        doorOpen: true,
        armContext: false,
        rms: 0.035,
        posture: "floor",
        moving: false,
        hr: 108,
        caption: "Same floor-level stillness as the unpaired fall. The band is in the vote and slightly dilutes it.",
      }),
    ],
  },
];

export function scenarioById(id: string): Scenario {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0]!;
}

export function verdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case "ALERT_FALL":
      return "Alert";
    case "CONFIRM_PENDING":
      return "Confirm";
    case "NO_ALERT":
      return "Quiet";
    case "insufficient_evidence":
      return "Asleep";
  }
}

export function formatProb(p: number | null, digits = 3): string {
  if (p == null || Number.isNaN(p)) return "—";
  return p.toFixed(digits);
}

export function formatSigned(n: number): string {
  const text = n.toFixed(2);
  return n > 0 ? `+${text}` : text;
}
