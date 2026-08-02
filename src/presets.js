// Variable references in preset text use `self.label`, the CONNECTION's label,
// not the module id. Companion resolves $(label:variable) against whatever the
// operator named this connection — hardcoding the module id produces buttons
// that render the raw $(...) text on any connection that has been renamed, and
// on a second instance of the same module.
import { safeId } from "./main.js";

// Two kinds of preset here, and the split matters:
//
//  * Fixed presets (reload, mute, diagnostics, health) exist before the module
//    has ever connected, because they address the primary source and every
//    WebLinked has one.
//  * Per-output presets are GENERATED from the live state, because an output is
//    addressed by NAME and the names are whatever this rig was configured with.
//
// The health section is the reason to put WebLinked on a surface at all: the
// numbers that say whether a graphic is actually going out are otherwise only
// visible on the control page, which nobody has open mid-show.

const WHITE = 0xffffff;
const BLACK = 0x000000;
const GREY = 0x333333;
const RED = 0xcc0000;
const AMBER = 0xcc7a00;
const DARKGREEN = 0x003300;
const BRIGHTGREEN = 0x00ff00;

function preset({
  name,
  text,
  size = "14",
  color = WHITE,
  bgcolor = GREY,
  actions = [],
  feedbacks = [],
}) {
  return {
    type: "simple",
    name,
    style: { text, size, color, bgcolor, show_topbar: false },
    steps: [{ down: actions, up: [] }],
    feedbacks,
  };
}

export default function UpdatePresets(self) {
  const presets = {};
  const structure = [];

  // --- The page (primary source) ------------------------------------------
  presets.reload = preset({
    name: "Reload the page, bypassing the cache",
    text: "RELOAD",
    actions: [
      { actionId: "reload", options: { ignore_cache: true, source: "" } },
    ],
    feedbacks: [
      {
        feedbackId: "loading",
        options: { source: "" },
        style: { bgcolor: AMBER, color: BLACK },
      },
    ],
  });

  presets.navigate = preset({
    name: "Navigate to a URL (edit it)",
    text: "GO TO\nURL",
    actions: [
      {
        actionId: "navigate",
        options: { url: "https://example.com/graphic", source: "" },
      },
    ],
  });

  presets.script_show = preset({
    name: "Run JavaScript: show a lower third (edit it)",
    text: "LOWER 3rd\nIN",
    actions: [
      {
        actionId: "script",
        options: { script: "lowerThird.show('Name', 'Role')", source: "" },
      },
    ],
  });

  presets.script_hide = preset({
    name: "Run JavaScript: hide a lower third (edit it)",
    text: "LOWER 3rd\nOUT",
    actions: [
      {
        actionId: "script",
        options: { script: "lowerThird.hide()", source: "" },
      },
    ],
  });

  presets.mute = preset({
    name: "Mute / unmute audio",
    text: `AUDIO\n$(${self.label}:connection_status)`,
    bgcolor: BLACK,
    actions: [{ actionId: "mute", options: { mode: "toggle", source: "" } }],
    feedbacks: [
      {
        feedbackId: "muted",
        options: { source: "" },
        style: { bgcolor: RED, color: WHITE },
      },
    ],
  });

  presets.url_display = preset({
    name: "Loaded URL (no action)",
    text: `$(${self.label}:primary_source)`,
    bgcolor: BLACK,
  });

  structure.push({
    id: "page",
    name: "The page",
    description:
      "Addresses the primary source. Run JavaScript is the high-leverage one — a graphic that defines its own functions needs no integration work at all.",
    definitions: [
      {
        id: "page-main",
        type: "simple",
        name: "Page",
        presets: [
          "reload",
          "navigate",
          "script_show",
          "script_hide",
          "mute",
          "url_display",
        ],
      },
    ],
    keywords: ["url", "reload", "script", "graphic"],
  });

  // --- Outputs, generated -------------------------------------------------
  const outputRefs = [];
  for (const state of self.sources) {
    const source = self.sourceId(state);
    const isPrimary = source === self.primary;
    // The selector is left empty for the primary so the generated preset keeps
    // working if the rig is later reduced to a single pipeline.
    const selector = isPrimary ? "" : source;
    for (const output of state.outputs ?? []) {
      const id = `out_${safeId(source)}_${safeId(output.name)}`;
      presets[id] = preset({
        name: `${output.name} (${output.kind}) — enable/disable`,
        text: `${output.name}\n$(${self.label}:${safeId(source)}_out_${safeId(output.name)}_receivers) rx`,
        bgcolor: BLACK,
        actions: [
          {
            actionId: "output",
            options: { name: output.name, mode: "toggle", source: selector },
          },
        ],
        feedbacks: [
          // Running (the device actually opened) rather than enabled (the
          // configured intent) — an output can be enabled and dead because a
          // card is claimed elsewhere, and that is the state worth seeing.
          {
            feedbackId: "outputRunning",
            options: { name: output.name, source: selector },
            style: { bgcolor: DARKGREEN, color: BRIGHTGREEN },
          },
        ],
      });
      outputRefs.push(id);

      if (output.kind === "ndi" || output.kind === "omt") {
        const rxId = `rx_${safeId(source)}_${safeId(output.name)}`;
        presets[rxId] = preset({
          name: `${output.name} — someone is receiving`,
          text: `${output.name}\nRX`,
          bgcolor: BLACK,
          feedbacks: [
            {
              feedbackId: "outputHasReceivers",
              options: { name: output.name, count: 1, source: selector },
              style: { bgcolor: DARKGREEN, color: BRIGHTGREEN },
            },
          ],
        });
        outputRefs.push(rxId);
      }
    }
  }

  if (outputRefs.length > 0) {
    structure.push({
      id: "outputs",
      name: "Outputs",
      description:
        "Generated from the outputs this WebLinked actually has. Green means the device opened and is putting frames out — not merely that it is enabled.",
      definitions: [
        {
          id: "outputs-main",
          type: "simple",
          name: "Outputs",
          presets: outputRefs,
        },
      ],
      keywords: ["ndi", "decklink", "sdi", "output", "screen"],
    });
  }

  // --- Health --------------------------------------------------------------
  presets.health_pacing = preset({
    name: "Pacing health (no action)",
    text: `DROP\n$(${self.label}:$(${self.label}:primary_source)_dropped_ticks)`,
    bgcolor: BLACK,
    feedbacks: [
      {
        feedbackId: "droppedTicks",
        options: { threshold: 0, source: "" },
        style: { bgcolor: RED, color: WHITE },
      },
    ],
  });

  presets.health_errors = preset({
    name: "Page console errors (no action)",
    text: "PAGE\nERRORS",
    bgcolor: BLACK,
    feedbacks: [
      {
        feedbackId: "consoleErrors",
        options: { threshold: 0, source: "" },
        style: { bgcolor: RED, color: WHITE },
      },
    ],
  });

  presets.health_popups = preset({
    name: "Page popup attempts (no action)",
    text: "POPUPS",
    bgcolor: BLACK,
    feedbacks: [
      {
        feedbackId: "popups",
        options: { source: "" },
        style: { bgcolor: AMBER, color: BLACK },
      },
    ],
  });

  presets.health_running = preset({
    name: "Source is running (no action)",
    text: "ENGINE",
    bgcolor: RED,
    feedbacks: [
      {
        feedbackId: "running",
        options: { source: "" },
        style: { bgcolor: DARKGREEN, color: BRIGHTGREEN },
      },
    ],
  });

  presets.connected = preset({
    name: "WebLinked is connected",
    text: `WEBLINKED\n$(${self.label}:connection_status)`,
    bgcolor: RED,
    actions: [{ actionId: "refresh", options: {} }],
    feedbacks: [
      {
        feedbackId: "connected",
        options: {},
        style: { bgcolor: DARKGREEN, color: BRIGHTGREEN },
      },
    ],
  });

  presets.diagnostics = preset({
    name: "Write a diagnostics report",
    text: "DIAG\nREPORT",
    actions: [
      {
        actionId: "diagnostics",
        options: { reason: "Operator report from Companion" },
      },
    ],
  });

  presets.dump_state = preset({
    name: "Log the current state",
    text: "LOG\nSTATE",
    actions: [{ actionId: "fetchState", options: { source: "" } }],
  });

  structure.push({
    id: "health",
    name: "Health",
    description:
      "The numbers that say whether the graphic is actually going out. Dropped ticks should be 0. Repeated frames being high is normal for a static graphic and a fault on an animated one, which is why its threshold is per-button.",
    definitions: [
      {
        id: "health-main",
        type: "simple",
        name: "Health",
        presets: [
          "health_running",
          "health_pacing",
          "health_errors",
          "health_popups",
          "connected",
          "diagnostics",
          "dump_state",
        ],
      },
    ],
    keywords: ["pacing", "dropped", "errors", "diagnostics"],
  });

  self.setPresetDefinitions(structure, presets);
}
