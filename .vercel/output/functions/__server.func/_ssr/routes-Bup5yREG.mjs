import { i as __toESM } from "../_runtime.mjs";
import { a as require_jsx_runtime, o as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { a as Play, c as Activity, i as RotateCcw, o as Pause, r as Thermometer, s as DoorOpen, t as Watch } from "../_libs/lucide-react.mjs";
import { i as SliderTrack, n as SliderRange, r as SliderThumb, t as Slider } from "../_libs/@radix-ui/react-slider+[...].mjs";
import { a as ReferenceLine, i as CartesianGrid, n as YAxis, o as ResponsiveContainer, r as Line, t as LineChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Bup5yREG.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function heat(temp) {
	const u = Math.min(1, Math.max(0, (temp - 21) / 13));
	const channel = Math.round(42 + u * 194);
	return `rgb(${channel} ${Math.round(channel * (1 - .04 * u))} ${Math.round(channel * (1 - .1 * u))})`;
}
function ThermalCanvas({ frame, floorY }) {
	const rows = frame ?? Array.from({ length: 24 }, () => Array.from({ length: 32 }, () => 22));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative w-full",
		style: { aspectRatio: "32 / 24" },
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid h-full w-full",
			style: {
				gridTemplateColumns: "repeat(32, minmax(0, 1fr))",
				gridTemplateRows: "repeat(24, minmax(0, 1fr))"
			},
			"aria-hidden": "true",
			children: rows.map((row, y) => row.map((temp, x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { backgroundColor: heat(temp) } }, `${y}-${x}`)))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "pointer-events-none absolute inset-x-0 border-t border-dashed border-faint",
			style: { top: `${Math.min(100, Math.max(0, floorY * 100))}%` }
		})]
	});
}
function WaveCanvas({ samples }) {
	const data = samples.length > 0 ? samples : [0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid h-12 w-full overflow-hidden bg-card-2",
		style: {
			gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
			gridTemplateRows: "1fr",
			alignItems: "end",
			columnGap: "1px"
		},
		"aria-hidden": "true",
		children: data.map((rms, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block w-full bg-foreground",
			style: { height: `${Math.max(8, Math.min(100, rms / .4 * 100))}%` }
		}, index))
	});
}
var DT = .2;
var BODIES = {
	standing: {
		cy: .16,
		cx: .5,
		rx: 3,
		ry: 3.6,
		temp: 33
	},
	sitting: {
		cy: .2,
		cx: .46,
		rx: 4.2,
		ry: 2.4,
		temp: 33
	},
	chair: {
		cy: .2,
		cx: .64,
		rx: 5.2,
		ry: 2.2,
		temp: 32.5
	},
	floor: {
		cy: .84,
		cx: .48,
		rx: 7.2,
		ry: 2,
		temp: 33
	}
};
function defaultConfig() {
	return {
		weights: {
			audio: .35,
			thermal: .45,
			wearable: .2
		},
		alertThreshold: .85,
		confirmThreshold: .6,
		minActive: 2,
		floorCentroidThreshold: .35,
		stillnessFrames: 5,
		stillnessSpread: .08,
		humanTempMin: 28,
		humanTempMax: 38,
		audioCenter: .15,
		audioGain: 20,
		impactThreshold: .6,
		impactHoldSec: 12,
		contextWindowSec: 120
	};
}
function logit(p, eps = 1e-6) {
	const c = Math.min(1 - eps, Math.max(eps, p));
	return Math.log(c / (1 - c));
}
function sigmoid(x) {
	if (x > 30) return 1;
	if (x < -30) return 0;
	return 1 / (1 + Math.exp(-x));
}
function audioConfidence(rms, config) {
	const raw = 1 / (1 + Math.exp(-(rms - config.audioCenter) * config.audioGain));
	return Math.min(1, Math.max(0, raw));
}
function clockFrom(origin, t) {
	const total = Math.floor(origin + Math.max(0, t)) % 86400;
	const h = Math.floor(total / 3600);
	const m = Math.floor(total % 3600 / 60);
	const s = total % 60;
	const pad = (n) => String(n).padStart(2, "0");
	return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function renderFrame(posture, t, moving) {
	const frame = Array.from({ length: 24 }, () => Array(32).fill(22));
	if (posture === "empty") return frame;
	const spec = BODIES[posture];
	const jitter = moving ? Math.sin(t * 7) * .05 : 0;
	const cyPx = clamp(spec.cy + jitter, .04, .96) * 24;
	const cxPx = spec.cx * 32;
	for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) {
		const ny = (y + .5 - cyPx) / spec.ry;
		const nx = (x + .5 - cxPx) / spec.rx;
		if (nx * nx + ny * ny <= 1) frame[y][x] = spec.temp;
	}
	return frame;
}
function readThermal(historyIn, frame, config) {
	const history = historyIn.slice();
	let pixels = 0;
	let sumY = 0;
	let sumX = 0;
	for (let y = 0; y < frame.length; y++) {
		const row = frame[y];
		for (let x = 0; x < row.length; x++) {
			const temp = row[x];
			if (temp >= config.humanTempMin && temp <= config.humanTempMax) {
				pixels += 1;
				sumY += y;
				sumX += x;
			}
		}
	}
	if (pixels < 6) return {
		confidence: 0,
		floor: false,
		still: false,
		pixels,
		centroidY: null,
		centroidX: null,
		reason: "no_human_blob",
		history: []
	};
	const cy = sumY / pixels / frame.length;
	const cx = sumX / pixels / frame[0].length;
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
	let confidence = .05;
	if (floor && still) confidence = .9;
	else if (floor) confidence = .5;
	else if (still && pixels > 20) confidence = .2;
	return {
		confidence,
		floor,
		still,
		pixels,
		centroidY: cy,
		centroidX: cx,
		reason: null,
		history
	};
}
function fuse(events, config) {
	const latest = /* @__PURE__ */ new Map();
	for (const event of events) {
		const prev = latest.get(event.modality);
		if (!prev || event.timestamp >= prev.timestamp) latest.set(event.modality, event);
	}
	const evidence = [
		"audio",
		"thermal",
		"wearable"
	].filter((m) => config.weights[m] > 0 && latest.has(m));
	if (evidence.length < config.minActive) return {
		verdict: "insufficient_evidence",
		fusedProbability: null,
		fusedLogOdds: null,
		activeModalities: evidence,
		contributions: {}
	};
	const total = evidence.reduce((sum, m) => sum + config.weights[m], 0);
	let logOdds = 0;
	const contributions = {};
	for (const m of evidence) {
		const weight = config.weights[m] / total;
		const confidence = latest.get(m).confidence;
		const lo = logit(confidence);
		logOdds += weight * lo;
		contributions[m] = {
			weight,
			confidence,
			logodds: lo
		};
	}
	const probability = sigmoid(logOdds);
	const alert = config.alertThreshold;
	const confirm = Math.min(config.confirmThreshold, Math.max(0, alert - .01));
	let verdict = "NO_ALERT";
	if (probability >= alert) verdict = "ALERT_FALL";
	else if (probability >= confirm) verdict = "CONFIRM_PENDING";
	return {
		verdict,
		fusedProbability: probability,
		fusedLogOdds: logOdds,
		activeModalities: evidence,
		contributions
	};
}
function emptyThermal() {
	return {
		reporting: false,
		confidence: 0,
		floor: false,
		still: false,
		pixels: 0,
		centroidY: null,
		centroidX: null,
		reason: "asleep",
		historyCount: 0
	};
}
function placeholderSnapshot() {
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
		audio: {
			rms: 0,
			confidence: 0,
			held: false,
			holdLeft: 0,
			ignored: true
		},
		thermal: emptyThermal(),
		wearable: {
			paired: false,
			hr: null,
			baseline: null,
			delta: null,
			confidence: null,
			abstained: false
		},
		fusion: fuse([], config),
		unpairedProbability: null,
		trace: [],
		beats: [],
		rmsHistory: []
	};
}
function initialSimState() {
	return {
		lastDoor: -1,
		thermalHistory: [],
		hold: null,
		baselineHr: null,
		rmsHistory: [],
		trace: [],
		beats: [],
		lastVerdict: null,
		view: placeholderSnapshot()
	};
}
function beatNote(verdict, thermal, audioHeld) {
	if (verdict === "insufficient_evidence") return "Not enough evidence modalities to fuse.";
	if (verdict === "ALERT_FALL") return "Impact and a still floor-level blob agree.";
	if (verdict === "CONFIRM_PENDING" && thermal.floor && !thermal.still) return "On the floor, stillness window still open.";
	if (verdict === "CONFIRM_PENDING" && audioHeld && !thermal.floor) return "Impact held. Posture is not on the floor.";
	if (verdict === "CONFIRM_PENDING") return "Score is in the confirm band.";
	if (thermal.still && !thermal.floor) return "Still, and the centroid is off the floor.";
	if (thermal.floor && thermal.still) return "Floor-level and still, without a confirming impact.";
	return "Under the confirm line.";
}
function stepSim(state, input, config) {
	const lastDoor = input.disarm ? -1 : input.armContext ? input.t : state.lastDoor;
	const contextActive = lastDoor >= 0 && input.t - lastDoor <= config.contextWindowSec;
	const contextLeft = contextActive ? Math.max(0, config.contextWindowSec - (input.t - lastDoor)) : 0;
	const inst = audioConfidence(input.rms, config);
	let hold = state.hold;
	if (contextActive && inst >= config.impactThreshold && config.impactHoldSec > 0) hold = {
		until: input.t + config.impactHoldSec,
		confidence: inst,
		rms: input.rms
	};
	const held = Boolean(hold && input.t <= hold.until && config.impactHoldSec > 0);
	const audioConf = contextActive ? held && hold ? hold.confidence : inst : inst;
	const holdLeft = held && hold ? Math.max(0, hold.until - input.t) : 0;
	let thermalHistory = contextActive ? state.thermalHistory : [];
	let thermal = emptyThermal();
	let frame = null;
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
			historyCount: thermalHistory.length
		};
	}
	let baselineHr = state.baselineHr;
	let wearableEvent = null;
	const paired = input.hr != null;
	let delta = null;
	let wearableConf = null;
	let abstained = false;
	if (input.hr != null) {
		if (baselineHr == null) baselineHr = input.hr;
		delta = input.hr - baselineHr;
		if (delta > 0) {
			wearableConf = Math.min(.4, delta / 40);
			wearableEvent = {
				modality: "wearable",
				timestamp: input.t,
				confidence: wearableConf,
				payload: {
					hr: input.hr,
					delta
				}
			};
		} else abstained = true;
	}
	const events = [];
	if (contextActive) {
		events.push({
			modality: "audio",
			timestamp: input.t,
			confidence: audioConf,
			payload: {
				rms: input.rms,
				held
			}
		});
		events.push({
			modality: "thermal",
			timestamp: input.t,
			confidence: thermal.confidence,
			payload: {
				floor: thermal.floor,
				still: thermal.still,
				pixels: thermal.pixels
			}
		});
	}
	if (wearableEvent) events.push(wearableEvent);
	const fusion = fuse(events, config);
	const withoutWearable = fuse(events.filter((event) => event.modality !== "wearable"), config);
	const unpairedProbability = wearableEvent && withoutWearable.fusedProbability != null ? withoutWearable.fusedProbability : null;
	const rmsHistory = state.rmsHistory.slice(-47);
	rmsHistory.push(input.rms);
	const trace = state.trace.slice(-159);
	trace.push({
		t: Math.round(input.t * 100) / 100,
		p: fusion.fusedProbability,
		verdict: fusion.verdict
	});
	const readingForNote = {
		confidence: thermal.confidence,
		floor: thermal.floor,
		still: thermal.still,
		pixels: thermal.pixels,
		centroidY: thermal.centroidY,
		centroidX: thermal.centroidX,
		reason: thermal.reason,
		history: thermalHistory
	};
	const beats = state.beats.slice(-23);
	if (fusion.verdict !== state.lastVerdict) beats.push({
		t: input.t,
		clock: clockFrom(input.clockOrigin, input.t),
		verdict: fusion.verdict,
		p: fusion.fusedProbability,
		note: beatNote(fusion.verdict, readingForNote, held)
	});
	const view = {
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
			ignored: !contextActive
		},
		thermal,
		wearable: {
			paired,
			hr: input.hr,
			baseline: baselineHr,
			delta,
			confidence: wearableConf,
			abstained
		},
		fusion,
		unpairedProbability,
		trace,
		beats,
		rmsHistory
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
		view
	};
}
function segmentIndex(scenario, t) {
	const index = scenario.segments.findIndex((segment) => t < segment.end - 1e-9);
	if (index === -1) return scenario.segments.length - 1;
	return index;
}
function simulate(scenario, tEnd, config) {
	const end = clamp(tEnd, 0, scenario.duration);
	const steps = Math.round(end / DT);
	let state = initialSimState();
	let prevIndex = -1;
	for (let i = 0; i <= steps; i++) {
		const t = Math.min(end, Math.round(i * DT * 1e3) / 1e3);
		const index = segmentIndex(scenario, t === scenario.duration ? t - 1e-6 : t);
		const segment = scenario.segments[index];
		const armContext = index !== prevIndex && segment.armContext;
		prevIndex = index;
		state = stepSim(state, {
			t,
			zone: segment.zone,
			armContext,
			doorOpen: segment.doorOpen,
			rms: segment.rms,
			posture: segment.posture,
			moving: segment.moving,
			hr: segment.hr,
			caption: segment.caption,
			clockOrigin: scenario.clockOrigin
		}, config);
	}
	return state.view;
}
function explain(snap, config) {
	const { fusion, thermal, audio, contextActive, wearable } = snap;
	if (!contextActive && fusion.verdict === "insufficient_evidence") return "No watched door has opened. Audio and thermal stay asleep, so there is nothing to fuse. The door never votes — it only decides when to listen.";
	if (fusion.verdict === "insufficient_evidence") {
		const count = fusion.activeModalities.length;
		return `${count} evidence ${count === 1 ? "modality is" : "modalities are"} reporting. The gate wants ${config.minActive}, so this cannot alert.`;
	}
	if (thermal.reporting && thermal.reason === "no_human_blob") return "The array is awake and there is no human-sized heat blob. Noise in an empty room does not become an alert.";
	if (fusion.verdict === "ALERT_FALL") {
		if (wearable.confidence != null && snap.unpairedProbability != null) return "Impact is held and the blob is on the floor, still. The band is in the fuse but capped at 0.40, so its log-odds stay negative and the score eases down instead of climbing.";
		return "A held impact and a floor-level, still heat blob agree. The door opened the window and then stayed out of the vote.";
	}
	if (fusion.verdict === "CONFIRM_PENDING" && thermal.floor && !thermal.still) return "The centroid is already at floor level, but it has not been still for the full window. That keeps the score under the alert line.";
	if (fusion.verdict === "CONFIRM_PENDING" && !thermal.floor) return "Audio is carrying a held impact, and the array still reads an upright or seated blob. One cue is not allowed to finish the alert.";
	if (fusion.verdict === "CONFIRM_PENDING") return "The fused score sits between confirm and alert. The engine waits rather than paging anyone.";
	if (thermal.reporting && thermal.still && !thermal.floor) return "The blob is still, and it is not on the floor. Sitting on a bed or reclining in a chair stays in this bucket — the case radar tends to collapse.";
	if (thermal.reporting && thermal.floor && thermal.still && !audio.held) return "Floor-level and still, with no impact on the hold. Posture alone stays under the line. A silent collapse is the risk this prior accepts.";
	return "The weighted log-odds stay under the confirm line. Nothing pages the caregiver.";
}
function clamp(n, lo, hi) {
	return Math.min(hi, Math.max(lo, n));
}
function seg(partial) {
	return partial;
}
var SCENARIOS = [
	{
		id: "fall",
		kicker: "Canonical",
		title: "Bathroom, 03:14",
		summary: "The door wakes the room. A short impact is held, the centroid drops, and stillness is what finally crosses the alert line. No band is paired.",
		duration: 16,
		showcaseAt: 8,
		clockOrigin: 11642,
		segments: [
			seg({
				end: 2,
				zone: "bathroom",
				doorOpen: false,
				armContext: false,
				rms: .03,
				posture: "empty",
				moving: false,
				hr: null,
				caption: "Night is quiet. Watched doors are shut, so the array and the microphone stay asleep."
			}),
			seg({
				end: 4.2,
				zone: "bathroom",
				doorOpen: true,
				armContext: true,
				rms: .08,
				posture: "standing",
				moving: true,
				hr: null,
				caption: "Bathroom door. The context window opens. The blob is upright and moving — not evidence of a fall."
			}),
			seg({
				end: 5,
				zone: "bathroom",
				doorOpen: true,
				armContext: false,
				rms: .32,
				posture: "floor",
				moving: true,
				hr: null,
				caption: "A short, sharp transient. Audio latches. The centroid is dropping and has not gone still."
			}),
			seg({
				end: 16,
				zone: "bathroom",
				doorOpen: true,
				armContext: false,
				rms: .035,
				posture: "floor",
				moving: false,
				hr: null,
				caption: "The room is quiet again. The impact is still on hold, and the blob rests at floor level."
			})
		]
	},
	{
		id: "bed",
		kicker: "Not a fall",
		title: "Sat on the bed",
		summary: "Bedroom door, then a still blob whose centroid stays above the floor line. This is the posture radar tends to merge with a fall.",
		duration: 14,
		showcaseAt: 7,
		clockOrigin: 12120,
		segments: [
			seg({
				end: 1.6,
				zone: "bedroom",
				doorOpen: false,
				armContext: false,
				rms: .03,
				posture: "empty",
				moving: false,
				hr: null,
				caption: "Bedroom is idle. Modalities asleep."
			}),
			seg({
				end: 3.4,
				zone: "bedroom",
				doorOpen: true,
				armContext: true,
				rms: .07,
				posture: "standing",
				moving: true,
				hr: null,
				caption: "Door opens. Someone is upright and crossing the room."
			}),
			seg({
				end: 14,
				zone: "bedroom",
				doorOpen: true,
				armContext: false,
				rms: .04,
				posture: "sitting",
				moving: false,
				hr: null,
				caption: "They sit on the bed. The blob is still. Its centroid never reaches the floor band."
			})
		]
	},
	{
		id: "chair",
		kicker: "Not a fall",
		title: "Reclined in the chair",
		summary: "A long stillness in the chair. Thermal keeps the centroid off the floor, so a stationary body does not become an alert.",
		duration: 14,
		showcaseAt: 7,
		clockOrigin: 13200,
		segments: [
			seg({
				end: 1.6,
				zone: "bedroom",
				doorOpen: false,
				armContext: false,
				rms: .04,
				posture: "empty",
				moving: false,
				hr: null,
				caption: "Before the door, the array is off."
			}),
			seg({
				end: 3.6,
				zone: "bedroom",
				doorOpen: true,
				armContext: true,
				rms: .09,
				posture: "standing",
				moving: true,
				hr: null,
				caption: "Bedroom door. Ordinary movement, ordinary room tone."
			}),
			seg({
				end: 14,
				zone: "bedroom",
				doorOpen: true,
				armContext: false,
				rms: .07,
				posture: "chair",
				moving: false,
				hr: null,
				caption: "Reclined, still, centroid high in the frame. Radar would struggle to separate this from lying down."
			})
		]
	},
	{
		id: "mug",
		kicker: "Impact only",
		title: "Mug on the tile",
		summary: "A real impact while the person stays upright. Audio holds. Thermal refuses the floor, so the score stops in confirm or below.",
		duration: 14,
		showcaseAt: 7,
		clockOrigin: 11900,
		segments: [
			seg({
				end: 1.4,
				zone: "bathroom",
				doorOpen: false,
				armContext: false,
				rms: .03,
				posture: "empty",
				moving: false,
				hr: null,
				caption: "Bathroom shut. Nothing is listening yet."
			}),
			seg({
				end: 3.2,
				zone: "bathroom",
				doorOpen: true,
				armContext: true,
				rms: .08,
				posture: "standing",
				moving: true,
				hr: null,
				caption: "Door, then an upright blob. Context is on. This is not a fall."
			}),
			seg({
				end: 4,
				zone: "bathroom",
				doorOpen: true,
				armContext: false,
				rms: .32,
				posture: "standing",
				moving: false,
				hr: null,
				caption: "The mug hits tile. Audio latches the transient. The person is still standing."
			}),
			seg({
				end: 14,
				zone: "bathroom",
				doorOpen: true,
				armContext: false,
				rms: .04,
				posture: "standing",
				moving: false,
				hr: null,
				caption: "Impact still on hold. The array keeps an upright, still blob — confidence 0.20, not a floor posture."
			})
		]
	},
	{
		id: "silent",
		kicker: "Posture only",
		title: "On the floor, no impact",
		summary: "The array is sure: floor-level and still. There is no impact to hold. With these priors, posture alone does not page anyone.",
		duration: 14,
		showcaseAt: 7,
		clockOrigin: 13860,
		segments: [
			seg({
				end: 1.6,
				zone: "bedroom",
				doorOpen: false,
				armContext: false,
				rms: .03,
				posture: "empty",
				moving: false,
				hr: null,
				caption: "Modalities asleep until a watched door moves."
			}),
			seg({
				end: 3.2,
				zone: "bedroom",
				doorOpen: true,
				armContext: true,
				rms: .06,
				posture: "standing",
				moving: true,
				hr: null,
				caption: "Door opens. They are upright. Room tone stays under the impact gate."
			}),
			seg({
				end: 14,
				zone: "bedroom",
				doorOpen: true,
				armContext: false,
				rms: .035,
				posture: "floor",
				moving: false,
				hr: null,
				caption: "They are on the floor and still. No transient ever crossed the audio gate."
			})
		]
	},
	{
		id: "band",
		kicker: "Enrichment",
		title: "Same fall, band paired",
		summary: "Identical room evidence, plus a heart-rate rise on the standard Heart Rate service. The band is capped, so it cannot raise the alert — and the alert still stands without needing it.",
		duration: 16,
		showcaseAt: 8,
		clockOrigin: 11642,
		segments: [
			seg({
				end: 2,
				zone: "bathroom",
				doorOpen: false,
				armContext: false,
				rms: .03,
				posture: "empty",
				moving: false,
				hr: 72,
				caption: "Band is paired at a resting rate. Until it rises, it abstains and its weight stays unused."
			}),
			seg({
				end: 4.2,
				zone: "bathroom",
				doorOpen: true,
				armContext: true,
				rms: .08,
				posture: "standing",
				moving: true,
				hr: 74,
				caption: "Door opens. Rate is barely off baseline, so the band still contributes nothing."
			}),
			seg({
				end: 5,
				zone: "bathroom",
				doorOpen: true,
				armContext: false,
				rms: .32,
				posture: "floor",
				moving: true,
				hr: 110,
				caption: "Impact, centroid dropping, rate up by more than 30 bpm. Wearable confidence hits the 0.40 cap."
			}),
			seg({
				end: 16,
				zone: "bathroom",
				doorOpen: true,
				armContext: false,
				rms: .035,
				posture: "floor",
				moving: false,
				hr: 108,
				caption: "Same floor-level stillness as the unpaired fall. The band is in the vote and slightly dilutes it."
			})
		]
	}
];
function scenarioById(id) {
	return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}
function verdictLabel(verdict) {
	switch (verdict) {
		case "ALERT_FALL": return "Alert";
		case "CONFIRM_PENDING": return "Confirm";
		case "NO_ALERT": return "Quiet";
		case "insufficient_evidence": return "Asleep";
	}
}
function formatProb(p, digits = 3) {
	if (p == null || Number.isNaN(p)) return "—";
	return p.toFixed(digits);
}
function formatSigned(n) {
	const text = n.toFixed(2);
	return n > 0 ? `+${text}` : text;
}
var POSTURES = [
	{
		id: "empty",
		label: "Empty"
	},
	{
		id: "standing",
		label: "Standing"
	},
	{
		id: "sitting",
		label: "Sitting"
	},
	{
		id: "chair",
		label: "Chair"
	},
	{
		id: "floor",
		label: "Floor"
	}
];
var BENCH_START = {
	zone: "bathroom",
	posture: "standing",
	moving: false,
	ambient: .04,
	wearable: false,
	hr: 72,
	doorOpen: false
};
function FloorlineApp() {
	const [config, setConfig] = (0, import_react.useState)(defaultConfig);
	const [caseId, setCaseId] = (0, import_react.useState)(SCENARIOS[0].id);
	const [mode, setMode] = (0, import_react.useState)("case");
	const [t, setT] = (0, import_react.useState)(SCENARIOS[0].showcaseAt);
	const [playing, setPlaying] = (0, import_react.useState)(false);
	const [speed, setSpeed] = (0, import_react.useState)(1);
	const [bench, setBench] = (0, import_react.useState)(BENCH_START);
	const [benchSnap, setBenchSnap] = (0, import_react.useState)(null);
	const [mounted, setMounted] = (0, import_react.useState)(false);
	const scenario = scenarioById(caseId);
	const configRef = (0, import_react.useRef)(config);
	const benchRef = (0, import_react.useRef)(bench);
	const simRef = (0, import_react.useRef)(initialSimState());
	const pendingRef = (0, import_react.useRef)(null);
	const strikeAtRef = (0, import_react.useRef)(-1);
	configRef.current = config;
	benchRef.current = bench;
	const caseSnap = (0, import_react.useMemo)(() => mode === "case" ? simulate(scenario, t, config) : null, [
		mode,
		scenario,
		t,
		config
	]);
	const snap = mode === "bench" ? benchSnap : caseSnap;
	(0, import_react.useEffect)(() => {
		setMounted(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (mode !== "case" || !playing) return;
		let raf = 0;
		let last = performance.now();
		let acc = 0;
		const duration = scenario.duration;
		const loop = (now) => {
			const dt = Math.min(.064, (now - last) / 1e3);
			last = now;
			acc += dt * speed;
			if (acc >= .1) {
				const step = acc;
				acc = 0;
				setT((prev) => Math.min(duration, prev + step));
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, [
		mode,
		playing,
		speed,
		scenario.duration
	]);
	(0, import_react.useEffect)(() => {
		if (playing && t >= scenario.duration) setPlaying(false);
	}, [
		playing,
		t,
		scenario.duration
	]);
	(0, import_react.useEffect)(() => {
		if (mode !== "bench") return;
		const id = window.setInterval(() => {
			const controls = benchRef.current;
			const cfg = configRef.current;
			const nextT = simRef.current.trace.length > 0 ? Math.round((simRef.current.view.t + DT) * 1e3) / 1e3 : 0;
			let rms = controls.ambient;
			if (strikeAtRef.current >= 0) {
				const age = nextT - strikeAtRef.current;
				if (age >= 0 && age < .45) rms = .32;
				else if (age >= .45 && age < 1.4) rms = Math.max(controls.ambient, .32 * Math.exp(-6 * (age - .45)));
			}
			const pending = pendingRef.current;
			pendingRef.current = null;
			const input = {
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
				clockOrigin: 11640
			};
			simRef.current = stepSim(simRef.current, input, cfg);
			setBenchSnap(simRef.current.view);
		}, 200);
		return () => window.clearInterval(id);
	}, [mode]);
	(0, import_react.useEffect)(() => {
		function onKey(event) {
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
		if (Math.abs(t - scenario.showcaseAt) < .15 || t >= scenario.duration - .05) setT(0);
		setPlaying(true);
	}
	function chooseCase(id) {
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
	const atMark = mode === "case" && (Math.abs(t - scenario.showcaseAt) < .15 || t >= scenario.duration - .05);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "min-h-screen overflow-x-hidden bg-background text-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 md:px-8 md:py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-end justify-between gap-4 border-b border-border pb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "Pilot home 4B"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-xl font-medium tracking-tight md:text-2xl",
							children: "Floorline"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-lg tabular-nums md:text-xl",
							children: snap?.clock ?? "—"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-faint",
							children: mode === "bench" ? "Bench" : "Night watch"
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2 overflow-x-auto pb-1",
					children: [SCENARIOS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-pressed": mode === "case" && item.id === caseId,
						onClick: () => chooseCase(item.id),
						className: chipClass(mode === "case" && item.id === caseId),
						children: item.title
					}, item.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-pressed": mode === "bench",
						onClick: openBench,
						className: chipClass(mode === "bench"),
						children: "Bench"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "max-w-3xl text-sm leading-relaxed text-muted",
					children: mode === "bench" ? "Drive the room yourself. The door only wakes audio and thermal. Stillness needs a few frames. A strike is a transient, so it is held. The band can be unpaired." : `${scenario.kicker}. ${scenario.summary}`
				}),
				snap ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid items-start gap-4 lg:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-w-0 flex-col gap-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VerdictBlock, {
								snap,
								config
							}),
							mode === "case" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CaseTransport, {
								scenario,
								t,
								playing,
								speed,
								atMark,
								onPrimary: togglePlay,
								onRestart: () => {
									setT(0);
									setPlaying(true);
								},
								onDecision: () => {
									setPlaying(false);
									setT(scenario.showcaseAt);
								},
								onSpeed: () => setSpeed((value) => value === 1 ? 3 : 1),
								onScrub: (value) => {
									setPlaying(false);
									setT(value);
								}
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BenchPanel, {
								controls: bench,
								snap,
								onChange: (next) => setBench(next),
								onArm: () => {
									pendingRef.current = "arm";
									setBench((prev) => ({
										...prev,
										doorOpen: true
									}));
								},
								onSleep: () => {
									pendingRef.current = "disarm";
									setBench((prev) => ({
										...prev,
										doorOpen: false
									}));
								},
								onStrike: () => {
									strikeAtRef.current = simRef.current.view.t;
								},
								onReset: () => {
									const next = BENCH_START;
									pendingRef.current = null;
									strikeAtRef.current = -1;
									setBench(next);
									simRef.current = seedBench(next, config);
									setBenchSnap(simRef.current.view);
								}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plan, { snap }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThermalCard, {
								snap,
								floorY: config.floorCentroidThreshold
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-w-0 flex-col gap-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Evidence, {
								snap,
								config
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScoreTrace, {
								snap,
								config,
								mounted
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BeatLog, { snap })
						]
					})]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calibration, {
					config,
					onChange: setConfig,
					onReset: () => setConfig(defaultConfig())
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Contract, {})
			]
		})
	});
}
function chipClass(active) {
	return active ? "h-11 shrink-0 rounded-full border border-foreground bg-foreground px-4 text-sm font-medium text-background" : "h-11 shrink-0 rounded-full border border-border bg-transparent px-4 text-sm text-foreground";
}
function VerdictBlock({ snap, config }) {
	const verdict = snap.fusion.verdict;
	const p = snap.fusion.fusedProbability;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Fused score"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 font-mono text-4xl font-medium tabular-nums tracking-tight",
					children: formatProb(p)
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					role: "status",
					"aria-live": "polite",
					className: verdict === "ALERT_FALL" ? "inline-flex h-8 items-center gap-2 rounded-full border border-alert px-3 text-sm text-alert" : "inline-flex h-8 items-center gap-2 rounded-full border border-border px-3 text-sm text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: verdict === "ALERT_FALL" ? "size-2 rounded-full bg-alert" : "size-2 rounded-full bg-faint",
						"aria-hidden": "true"
					}), verdictLabel(verdict)]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Meter, {
				p,
				confirm: config.confirmThreshold,
				alert: config.alertThreshold
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm leading-relaxed text-muted",
				children: explain(snap, config)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm leading-relaxed text-faint",
				children: snap.caption
			}),
			snap.fusion.fusedLogOdds != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 font-mono text-xs tabular-nums text-faint",
				children: [
					"σ(",
					snap.fusion.fusedLogOdds.toFixed(2),
					")",
					snap.unpairedProbability != null ? ` · without band ${formatProb(snap.unpairedProbability)}` : ""
				]
			}) : null
		]
	});
}
function Meter({ p, confirm, alert }) {
	const pct = p == null ? 0 : Math.min(100, Math.max(0, p * 100));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative mt-5 h-12",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-x-0 top-3 h-px bg-border" }),
			p != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute top-3 h-px bg-foreground",
				style: { width: `${pct}%` }
			}) : null,
			p != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "absolute top-3 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground",
				style: { left: `${pct}%` }
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, {
				x: confirm,
				label: "Confirm"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, {
				x: alert,
				label: "Alert"
			})
		]
	});
}
function Mark({ x, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "absolute top-3 h-2 w-px bg-faint",
		style: { left: `${x * 100}%` },
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "absolute top-3 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap text-faint",
			children: label
		})
	});
}
function CaseTransport({ scenario, t, playing, speed, atMark, onPrimary, onRestart, onDecision, onSpeed, onScrub }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: onPrimary,
					className: "inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground",
					children: [playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4" }), playing ? "Pause" : atMark ? "Replay" : "Play"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: onRestart,
					className: ghostBtn,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" }), "From the door"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onDecision,
					className: ghostBtn,
					children: "Decision"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onSpeed,
					className: ghostBtn,
					"aria-label": "Playback speed",
					children: speed === 1 ? "1×" : "3×"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "ml-auto font-mono text-xs tabular-nums text-faint",
					children: [
						t.toFixed(1),
						"s / ",
						scenario.duration.toFixed(0),
						"s"
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Range, {
				label: "Case time",
				min: 0,
				max: scenario.duration,
				step: .2,
				value: Math.min(scenario.duration, t),
				onChange: onScrub,
				format: (value) => `${value.toFixed(1)}s`,
				hideValue: true
			})
		})]
	});
}
var ghostBtn = "inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm text-foreground";
function BenchPanel({ controls, snap, onChange, onArm, onSleep, onStrike, onReset }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TogglePair, {
						value: controls.zone,
						options: [{
							id: "bathroom",
							label: "Bathroom"
						}, {
							id: "bedroom",
							label: "Bedroom"
						}],
						onChange: (zone) => onChange({
							...controls,
							zone
						})
					}),
					snap.contextActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onSleep,
						className: ghostBtn,
						children: "Sleep"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onArm,
						className: "inline-flex h-11 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground",
						children: "Open door"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onStrike,
						className: ghostBtn,
						children: "Strike"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onReset,
						className: ghostBtn,
						children: "Reset"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [POSTURES.map((posture) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-pressed": controls.posture === posture.id,
					onClick: () => onChange({
						...controls,
						posture: posture.id
					}),
					className: chipClass(controls.posture === posture.id),
					children: posture.label
				}, posture.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-pressed": !controls.moving,
					onClick: () => onChange({
						...controls,
						moving: !controls.moving
					}),
					className: chipClass(!controls.moving),
					children: controls.moving ? "Shifting" : "Held still"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid gap-4 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Range, {
					label: "Room tone",
					min: 0,
					max: .2,
					step: .005,
					value: controls.ambient,
					onChange: (ambient) => onChange({
						...controls,
						ambient
					}),
					format: (value) => value.toFixed(3)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm",
							children: "Heart-rate band"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-pressed": controls.wearable,
							onClick: () => onChange({
								...controls,
								wearable: !controls.wearable
							}),
							className: chipClass(controls.wearable),
							children: controls.wearable ? "Paired" : "Unpaired"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Range, {
						label: "Heart rate",
						min: 48,
						max: 150,
						step: 1,
						value: controls.hr,
						onChange: (hr) => onChange({
							...controls,
							hr
						}),
						format: (value) => `${Math.round(value)} bpm`,
						disabled: !controls.wearable
					})]
				})]
			})
		]
	});
}
function TogglePair({ value, options, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex gap-2",
		children: options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-pressed": value === option.id,
			onClick: () => onChange(option.id),
			className: chipClass(value === option.id),
			children: option.label
		}, option.id))
	});
}
function Plan({ snap }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-3 flex items-baseline justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-sm font-medium",
				children: "Watched rooms"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-faint",
				children: snap.contextActive ? `Listening ${Math.ceil(snap.contextLeft)}s` : "Asleep"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Room, {
				name: "Bedroom",
				zone: "bedroom",
				snap,
				footnote: "Bed · chair"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Room, {
				name: "Bathroom",
				zone: "bathroom",
				snap,
				footnote: "Bath"
			})]
		})]
	});
}
function Room({ name, zone, snap, footnote }) {
	const here = snap.zone === zone;
	const open = here && snap.doorOpen;
	const showBody = here && snap.contextActive && snap.thermal.centroidY != null && snap.thermal.centroidX != null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: here ? "relative h-40 overflow-hidden rounded-sm border border-foreground p-3 md:h-48" : "relative h-40 overflow-hidden rounded-sm border border-border p-3 md:h-48",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-medium",
					children: name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DoorOpen, { className: open ? "size-4 text-foreground" : "size-4 text-faint" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-faint",
				children: open ? "Door open" : "Door shut"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "absolute bottom-3 left-3 text-xs text-faint",
				children: footnote
			}),
			showBody ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground",
				style: {
					left: `${(snap.thermal.centroidX ?? .5) * 100}%`,
					top: `${(snap.thermal.centroidY ?? .5) * 100}%`
				}
			}) : null
		]
	});
}
function ThermalCard({ snap, floorY }) {
	const thermal = snap.thermal;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "overflow-hidden rounded-xl border border-border bg-card",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3 p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thermometer, {
						className: "size-4 text-muted",
						"aria-hidden": "true"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-medium",
						children: "Thermal array"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-faint",
						children: "32×24 · floor line is the tick"
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-sm tabular-nums",
					children: thermal.reporting ? formatProb(thermal.confidence, 2) : "—"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThermalCanvas, {
				frame: snap.frame,
				floorY
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "px-4 py-3 text-xs leading-relaxed text-faint",
				children: [thermal.reporting ? `${thermal.reason === "no_human_blob" ? "No blob" : thermal.floor ? "Floor" : "Above floor"} · ${thermal.still ? "still" : "not still"} · ${thermal.pixels} px · window ${thermal.historyCount}` : "Array asleep until a watched door opens.", thermal.centroidY != null ? ` · y ${thermal.centroidY.toFixed(2)}` : ""]
			})
		]
	});
}
function Evidence({ snap, config }) {
	const audio = snap.fusion.contributions.audio;
	const thermal = snap.fusion.contributions.thermal;
	const wearable = snap.fusion.contributions.wearable;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-sm font-medium",
				children: "Modalities"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs leading-relaxed text-faint",
				children: renormLine(snap)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-col gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModalityRow, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DoorOpen, { className: "size-4" }),
						title: "Door",
						tier: "Tier 1 · context",
						value: "—",
						detail: snap.contextActive ? `${snap.zone} · ${Math.ceil(snap.contextLeft)}s window` : "No window · does not vote",
						logodds: null
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModalityRow, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "size-4" }),
						title: "Audio",
						tier: "Tier 2 · impact",
						value: snap.audio.ignored ? "—" : formatProb(snap.audio.confidence, 2),
						detail: snap.audio.ignored ? "Asleep" : snap.audio.held ? `Held ${Math.ceil(snap.audio.holdLeft)}s · rms ${snap.audio.rms.toFixed(2)}` : `Live · rms ${snap.audio.rms.toFixed(2)}`,
						logodds: audio?.logodds ?? null,
						weight: audio?.weight ?? null,
						prior: config.weights.audio
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 overflow-hidden rounded-sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveCanvas, { samples: snap.rmsHistory })
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModalityRow, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thermometer, { className: "size-4" }),
						title: "Thermal",
						tier: "Tier 2 · posture",
						value: snap.thermal.reporting ? formatProb(snap.thermal.confidence, 2) : "—",
						detail: snap.thermal.reporting ? snap.thermal.floor && snap.thermal.still ? "Floor and still · 0.90" : snap.thermal.floor ? "Floor, not still · 0.50" : snap.thermal.still ? "Still, off the floor · 0.20" : "Blob present · 0.05" : "Asleep",
						logodds: thermal?.logodds ?? null,
						weight: thermal?.weight ?? null,
						prior: config.weights.thermal
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModalityRow, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Watch, { className: "size-4" }),
						title: "Band",
						tier: "Tier 3 · enrichment",
						value: snap.wearable.confidence == null ? "—" : formatProb(snap.wearable.confidence, 2),
						detail: wearableDetail(snap),
						logodds: wearable?.logodds ?? null,
						weight: wearable?.weight ?? null,
						prior: config.weights.wearable
					})
				]
			})
		]
	});
}
function wearableDetail(snap) {
	if (!snap.wearable.paired) return "Unpaired · prior returns to the room";
	if (snap.wearable.abstained) return `Baseline ${snap.wearable.hr} bpm · abstains`;
	return `${snap.wearable.hr} bpm · Δ ${Math.round(snap.wearable.delta ?? 0)} · cap 0.40`;
}
function renormLine(snap) {
	const parts = [
		"thermal",
		"audio",
		"wearable"
	].map((key) => {
		const row = snap.fusion.contributions[key];
		if (!row) return null;
		return `${key === "wearable" ? "Band" : key === "audio" ? "Audio" : "Thermal"} ${Math.round(row.weight * 100)}%`;
	}).filter((part) => part != null);
	if (parts.length === 0) return "Nothing is in the fuse.";
	const extra = !snap.wearable.paired ? "Unpaired band is left out, then weights renormalize." : snap.wearable.abstained ? "Baseline heart rate is left out of this tick." : "Weights are renormalized over who is present.";
	return `${parts.join(" · ")}. ${extra}`;
}
function ModalityRow({ icon, title, tier, value, detail, logodds, weight, prior }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid grid-cols-[1.25rem_1fr_auto] items-start gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-0.5 text-muted",
				"aria-hidden": "true",
				children: icon
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-medium",
							children: title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-faint",
							children: tier
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs leading-relaxed text-muted",
						children: detail
					}),
					logodds != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOddsBar, { value: logodds }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-2 h-px bg-border" }),
					weight != null && prior != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 font-mono text-xs tabular-nums text-faint",
						children: [
							"prior ",
							prior.toFixed(2),
							" · vote ",
							Math.round(weight * 100),
							"% · ",
							formatSigned(logodds ?? 0)
						]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-sm tabular-nums",
				children: value
			})
		]
	});
}
function LogOddsBar({ value }) {
	const clamped = Math.max(-4, Math.min(4, value));
	const width = Math.abs(clamped) / 4 * 50;
	const left = clamped >= 0 ? 50 : 50 - width;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative mt-2 h-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-x-0 top-1/2 h-px bg-border" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-1/2 left-1/2 h-2 w-px -translate-y-1/2 bg-faint" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute top-1/2 h-0.5 -translate-y-1/2 bg-foreground",
				style: {
					left: `${left}%`,
					width: `${width}%`
				}
			})
		]
	});
}
function ScoreTrace({ snap, config, mounted }) {
	const data = snap.trace.map((point) => ({
		t: point.t,
		p: point.p
	}));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-3 flex items-baseline justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-sm font-medium",
				children: "Score"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-faint",
				children: "Confirm and alert are the dashed lines"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "h-24 w-full",
			children: mounted && data.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
				width: "100%",
				height: "100%",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(LineChart, {
					data,
					margin: {
						top: 8,
						right: 0,
						left: 0,
						bottom: 0
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
							stroke: "var(--color-border)",
							vertical: false
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
							domain: [0, 1],
							hide: true
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferenceLine, {
							y: config.confirmThreshold,
							stroke: "var(--color-faint)",
							strokeDasharray: "2 3"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferenceLine, {
							y: config.alertThreshold,
							stroke: "var(--color-alert)",
							strokeDasharray: "2 3"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
							type: "stepAfter",
							dataKey: "p",
							stroke: "var(--color-foreground)",
							strokeWidth: 1.5,
							dot: false,
							connectNulls: false,
							isAnimationActive: false
						})
					]
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-full border-b border-border" })
		})]
	});
}
function BeatLog({ snap }) {
	const beats = snap.beats.slice(-5);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "text-sm font-medium",
			children: "What changed"
		}), beats.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm text-faint",
			children: "No decision yet."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
			className: "mt-3 flex flex-col gap-3",
			children: beats.map((beat, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "grid grid-cols-[5.5rem_4.5rem_1fr] gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-xs tabular-nums text-faint",
						children: beat.clock
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: beat.verdict === "ALERT_FALL" ? "text-xs text-alert" : "text-xs text-foreground",
						children: verdictLabel(beat.verdict)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs leading-relaxed text-muted",
						children: beat.note
					})
				]
			}, `${beat.t}-${beat.verdict}-${index}`))
		})]
	});
}
function Calibration({ config, onChange, onReset }) {
	function patch(partial) {
		onChange({
			...config,
			...partial
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-medium",
					children: "Calibration"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-2xl text-xs leading-relaxed text-faint",
					children: "These are priors. Thermal carries posture, audio carries impact, the band is optional. A missing modality drops out and the remaining weights renormalize."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onReset,
					className: ghostBtn,
					children: "Restore"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid gap-x-8 gap-y-1 md:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Range, {
						label: "Audio prior",
						min: 0,
						max: 1,
						step: .05,
						value: config.weights.audio,
						onChange: (audio) => patch({ weights: {
							...config.weights,
							audio
						} }),
						format: (value) => value.toFixed(2)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Range, {
						label: "Thermal prior",
						min: 0,
						max: 1,
						step: .05,
						value: config.weights.thermal,
						onChange: (thermal) => patch({ weights: {
							...config.weights,
							thermal
						} }),
						format: (value) => value.toFixed(2)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Range, {
						label: "Band prior",
						min: 0,
						max: 1,
						step: .05,
						value: config.weights.wearable,
						onChange: (wearable) => patch({ weights: {
							...config.weights,
							wearable
						} }),
						format: (value) => value.toFixed(2)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Range, {
						label: "Alert line",
						min: .5,
						max: .95,
						step: .01,
						value: config.alertThreshold,
						onChange: (alertThreshold) => patch({
							alertThreshold,
							confirmThreshold: Math.min(config.confirmThreshold, alertThreshold - .01)
						}),
						format: (value) => value.toFixed(2)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Range, {
						label: "Confirm line",
						min: .3,
						max: Math.max(.31, config.alertThreshold - .01),
						step: .01,
						value: config.confirmThreshold,
						onChange: (confirmThreshold) => patch({ confirmThreshold }),
						format: (value) => value.toFixed(2)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Range, {
						label: "Floor if centroid y ≥",
						hint: "0 is the top of the array, 1 is the bottom. 0.35 matches a 1 m mount.",
						min: .15,
						max: .9,
						step: .01,
						value: config.floorCentroidThreshold,
						onChange: (floorCentroidThreshold) => patch({ floorCentroidThreshold }),
						format: (value) => value.toFixed(2)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Range, {
						label: "Still if spread <",
						min: .02,
						max: .25,
						step: .01,
						value: config.stillnessSpread,
						onChange: (stillnessSpread) => patch({ stillnessSpread }),
						format: (value) => value.toFixed(2)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Range, {
						label: "Hold an impact",
						hint: "A thud is shorter than the stillness window, so the latest audio event is latched.",
						min: 0,
						max: 20,
						step: 1,
						value: config.impactHoldSec,
						onChange: (impactHoldSec) => patch({ impactHoldSec }),
						format: (value) => `${Math.round(value)}s`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Range, {
						label: "Context window",
						min: 5,
						max: 180,
						step: 5,
						value: config.contextWindowSec,
						onChange: (contextWindowSec) => patch({ contextWindowSec }),
						format: (value) => `${Math.round(value)}s`
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: "Modalities required"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 flex gap-2",
						children: [
							1,
							2,
							3
						].map((count) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-pressed": config.minActive === count,
							onClick: () => patch({ minActive: count }),
							className: chipClass(config.minActive === count),
							children: count
						}, count))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs leading-relaxed text-faint",
						children: "Pilot default is 2. One lets a single stream reach the line. Three means the band must be present."
					})
				]
			})
		]
	});
}
function Range({ label, hint, min, max, step, value, onChange, format, hideValue, disabled }) {
	const safe = Math.min(max, Math.max(min, value));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: disabled ? "flex flex-col gap-1 opacity-40" : "flex flex-col gap-1",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex items-baseline justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm",
					children: label
				}), hideValue ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs tabular-nums text-muted",
					children: format(safe)
				})]
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs leading-relaxed text-faint",
				children: hint
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Slider, {
				className: "relative flex h-11 w-full touch-none items-center select-none",
				min,
				max,
				step,
				value: [safe],
				disabled,
				onValueChange: (next) => onChange(next[0] ?? safe),
				"aria-label": label,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderTrack, {
					className: "relative h-px w-full grow bg-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRange, { className: "absolute h-px bg-foreground" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderThumb, { className: "block size-5 rounded-full border border-foreground bg-background" })]
			})
		]
	});
}
function Contract() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
			className: "cursor-pointer text-sm font-medium",
			children: "How a score is built"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 flex max-w-3xl flex-col gap-3 text-sm leading-relaxed text-muted",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Each awake sensor emits an independent confidence. The fuse is weighted log-odds: sigmoid of the renormalized priors times logit(confidence). The door’s weight is zero." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-xs text-foreground",
					children: "p = σ( Σ wᵢ · logit(cᵢ) )"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Audio confidence is a sigmoid on RMS, centered at 0.15. Above 0.60 it latches for the hold, because fuse() only sees the latest event and a thud would otherwise vanish before the thermal window fills. Set the hold to 0 to keep only the live sample." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Thermal confidence is 0.90 only when the centroid is at or below the floor line and its vertical spread stays inside the stillness gate. Floor but moving is 0.50. Still and off the floor is 0.20. Anything else with a blob is 0.05. Fewer than six warm pixels clears the window." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The band speaks Heart Rate Service 0x180D, measurement 0x2A37. A rise contributes min(0.40, Δ / 40). That cap sits below one half, so the log-odds are negative: the band cannot lift an alert. At baseline it abstains instead of voting near-zero, which would veto the room. Unpaired, it is simply absent." })
			]
		})]
	});
}
function seedBench(controls, config) {
	return stepSim(initialSimState(), {
		t: 0,
		zone: controls.zone,
		armContext: false,
		doorOpen: controls.doorOpen,
		rms: controls.ambient,
		posture: controls.posture,
		moving: controls.moving,
		hr: controls.wearable ? controls.hr : null,
		caption: benchCaption(controls),
		clockOrigin: 11640
	}, config);
}
function benchCaption(controls) {
	const where = controls.zone === "bathroom" ? "Bathroom" : "Bedroom";
	const pose = controls.posture === "empty" ? "no one in frame" : controls.posture === "chair" ? "reclined in the chair" : controls.posture === "floor" ? "on the floor" : controls.posture;
	const motion = controls.moving ? "shifting" : "held still";
	return controls.doorOpen ? `${where} door is open. ${pose}, ${motion}.` : `${where} door is shut. Sensors sleep until it opens.`;
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloorlineApp, {});
}
//#endregion
export { Home as component };
