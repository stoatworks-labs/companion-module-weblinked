import { InstanceBase, Regex, InstanceStatus } from "@companion-module/base";
import { UpgradeScripts } from "./upgrades.js";
import UpdateActions from "./actions.js";
import UpdateFeedbacks from "./feedbacks.js";
import UpdateVariableDefinitions from "./variables.js";
import UpdatePresets from "./presets.js";
import { fetchSources } from "./api.js";
import { aboutField } from './about-field.js'

/** Companion variable ids allow only [a-zA-Z0-9_]. Source ids and NDI output
 *  names are free text — "Lower Third" and "cam-1" are both normal — so both
 *  have to be sanitised before they can name a variable. */
export function safeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_]/g, "_");
}

export default class ModuleInstance extends InstanceBase {
  constructor(internal) {
    super(internal);
    this.primary = "";
    this.sources = []; // one full state object per pipeline
    this.pollTimer = null;
    this.lastShape = ""; // ids that drive the definition sets
  }

  async init(config) {
    this.config = config;
    this.updateStatus(InstanceStatus.Connecting);
    this.rebuild();
    this.startPolling();
  }

  async destroy() {
    this.stopPolling();
  }

  async configUpdated(config) {
    this.config = config;
    this.stopPolling();
    this.sources = [];
    this.lastShape = "";
    this.updateStatus(InstanceStatus.Connecting);
    this.startPolling();
  }

  getConfigFields() {
    return [
      {
        type: "static-text",
        id: "info",
        width: 12,
        label: "Connection",
        value:
          "WebLinked's HTTP control API — <code>127.0.0.1:7654</code> by default. Bound to an interface (<code>--bind 0.0.0.0</code>) it should be run with <code>--token</code>; put that token below. There is no TLS, so keep it on a trusted show network or behind a proxy.",
      },
      {
        type: "textinput",
        id: "host",
        label: "WebLinked host",
        width: 8,
        default: "127.0.0.1",
        regex: Regex.HOSTNAME,
      },
      {
        type: "textinput",
        id: "port",
        label: "Port",
        width: 4,
        default: "7654",
        regex: Regex.PORT,
      },
      {
        type: "textinput",
        id: "token",
        label: "Token (only if WebLinked was started with --token)",
        width: 12,
        default: "",
      },
      {
        type: "number",
        id: "pollinterval",
        label: "Poll interval (ms)",
        width: 6,
        min: 250,
        max: 30000,
        default: 1000,
      },
      {
        type: "static-text",
        id: "pollinfo",
        width: 12,
        label: "",
        value:
          "WebLinked has no push channel for state, so every feedback and variable lags reality by up to one interval. The pacing and receiver counters are the numbers worth watching in real time — 1000 ms suits a monitoring page; raise it if the machine is loaded.",
      },
    
    	// Vendored from stoatworks-backend/about. A Companion module has no
    	// UI of its own, so this config panel is the only surface it has.
    	aboutField(),
    ];
  }

  startPolling() {
    const ms = Math.max(250, Number(this.config.pollinterval) || 1000);
    this.pollTimer = setInterval(() => this.poll(), ms);
    this.poll();
  }

  stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  /**
   * One poll.
   *
   * Re-registration is driven by a SHAPE key — the set of source ids and their
   * output names — rather than by whole-state equality. WebLinked's state
   * carries frame counters that tick every frame, so whole-state comparison
   * would rebuild every definition on every poll, several times a second,
   * churning the dropdowns an operator is trying to use.
   *
   * On failure the sources list is deliberately NOT cleared: that keeps the
   * dropdowns populated through a blip, at the cost of feedbacks continuing to
   * evaluate against stale state. The "WebLinked is connected" feedback is the
   * honest signal, and the docs say to put it on any page with output buttons.
   */
  async poll() {
    try {
      const body = await fetchSources(this);
      this.primary = body?.primary ?? "";
      this.sources = Array.isArray(body?.sources) ? body.sources : [];
      this.updateStatus(InstanceStatus.Ok);
      this.connected = true;

      const shape = JSON.stringify(
        this.sources.map((s) => [
          this.sourceId(s),
          (s.outputs ?? []).map((o) => o.name),
        ]),
      );
      if (shape !== this.lastShape) {
        this.lastShape = shape;
        this.rebuild();
      } else {
        this.refreshVariableValues();
        this.checkAllFeedbacks();
      }
    } catch (err) {
      this.connected = false;
      this.updateStatus(InstanceStatus.ConnectionFailure, err.message);
      this.refreshVariableValues();
      this.checkAllFeedbacks();
    }
  }

  rebuild() {
    UpdateActions(this);
    UpdateFeedbacks(this);
    UpdateVariableDefinitions(this);
    UpdatePresets(this);
    this.refreshVariableValues();
    this.checkAllFeedbacks();
  }

  /** A state entry's own id. /api/sources entries carry the same shape
   *  /api/state returns, where the id lives under `source.id` — but a build
   *  serving a single command-line launch may not carry one at all, in which
   *  case the primary id is the only name it has. */
  sourceId(state) {
    return state?.source?.id ?? state?.id ?? this.primary ?? "";
  }

  /** Resolve a source selector to a state object. An empty selector means the
   *  primary, matching WebLinked's own rule for an omitted ?source=. */
  stateFor(sourceId) {
    const id = String(sourceId ?? "").trim();
    if (!id) {
      return (
        this.sources.find((s) => this.sourceId(s) === this.primary) ??
        this.sources[0] ??
        null
      );
    }
    return this.sources.find((s) => this.sourceId(s) === id) ?? null;
  }

  outputFor(sourceId, name) {
    const state = this.stateFor(sourceId);
    return (state?.outputs ?? []).find((o) => o.name === name) ?? null;
  }

  refreshVariableValues() {
    const values = {
      connection_status: this.connected ? "Connected" : "Disconnected",
      source_count: this.sources.length,
      primary_source: this.primary,
    };

    for (const state of this.sources) {
      const p = `${safeId(this.sourceId(state))}_`;
      const src = state.source ?? {};
      const pacing = state.pacing ?? {};
      const audio = state.audio ?? {};
      values[`${p}url`] = src.loaded_url || src.url || "";
      values[`${p}running`] = state.running ? "Running" : "Stopped";
      values[`${p}format`] = state.format ?? "";
      values[`${p}loading`] = src.loading ? "Loading" : "Idle";
      values[`${p}console_errors`] = src.console_errors ?? 0;
      values[`${p}popups`] = src.popups ?? 0;
      values[`${p}muted`] = src.audio_muted ? "Muted" : "Live";
      values[`${p}dropped_ticks`] = pacing.dropped_ticks ?? 0;
      values[`${p}repeated_frames`] = pacing.repeated_frames ?? 0;
      values[`${p}lateness_us`] = pacing.last_lateness_us ?? 0;
      values[`${p}audio_underruns`] = audio.underruns ?? 0;
      values[`${p}output_count`] = (state.outputs ?? []).length;
      values[`${p}receivers`] = (state.outputs ?? []).reduce(
        (n, o) => n + (Number(o.receivers) || 0),
        0,
      );
      for (const output of state.outputs ?? []) {
        const op = `${p}out_${safeId(output.name)}_`;
        values[`${op}running`] = output.running ? "Running" : "Stopped";
        values[`${op}enabled`] = output.enabled ? "Enabled" : "Disabled";
        values[`${op}frames`] = output.frames ?? 0;
        values[`${op}receivers`] = output.receivers ?? 0;
      }
    }
    this.setVariableValues(values);
  }
}

export { UpgradeScripts };
