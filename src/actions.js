import { post, getJson } from "./api.js";
import {
  sourceChoices,
  outputChoices,
  FORMAT_CHOICES,
  firstId,
} from "./choices.js";

// Every per-source verb carries a source selector whose default is "" — the
// primary. That is WebLinked's own convention for an omitted ?source=, and
// keeping it means a Companion config built against a single-pipeline install
// keeps working unchanged when a second pipeline is added.

const sourceOption = (self) => ({
  id: "source",
  type: "dropdown",
  label: "Source",
  choices: sourceChoices(self),
  default: "",
  allowCustom: true,
  tooltip:
    "Leave on Primary unless this WebLinked runs several pipelines. An unknown id is a 404, not a silent no-op.",
});

export default function UpdateActions(self) {
  const outputs = outputChoices(self);

  // Options declared `useVariables: true` arrive already expanded: Companion
  // resolves them before invoking the callback. `parseVariablesInString` does
  // not exist in @companion-module/base 2.x — not on the callback context, not
  // on InstanceBase — so calling it throws the moment the action fires, while
  // the module still loads cleanly and every other path keeps working.
  const text = (event, key) => String(event.options[key] ?? "").trim();

  const run = async (fn) => {
    try {
      await fn();
    } catch (e) {
      // Surfaced, never swallowed. A 409 in particular means a device refused
      // something that was otherwise valid — the one an operator must see.
      self.log("error", e.message);
    }
  };

  self.setActionDefinitions({
    // --- The page ----------------------------------------------------------
    navigate: {
      name: "Page: navigate to a URL",
      options: [
        {
          id: "url",
          type: "textinput",
          label: "URL",
          default: "https://example.com/graphic",
          useVariables: true,
          width: 12,
        },
        sourceOption(self),
      ],
      callback: async (event) =>
        run(async () => {
          const url = text(event, "url");
          if (!url) return;
          await post(self, "/api/url", { url }, event.options.source);
        }),
    },

    reload: {
      name: "Page: reload",
      description:
        "Bypassing the cache is what you want after a designer re-uploads a graphic to the same URL — a plain reload will happily serve the old one.",
      options: [
        {
          id: "ignore_cache",
          type: "checkbox",
          label: "Bypass the HTTP cache",
          default: true,
        },
        sourceOption(self),
      ],
      callback: async (event) =>
        run(() =>
          post(
            self,
            "/api/reload",
            { ignore_cache: !!event.options.ignore_cache },
            event.options.source,
          ),
        ),
    },

    script: {
      name: "Page: run JavaScript",
      description:
        "The highest-leverage action here. A graphic that already defines its own functions can be driven from a button with no integration work at all — lowerThird.show('Anna'), setScore('home', 3).",
      options: [
        {
          id: "script",
          type: "textinput",
          label: "JavaScript",
          default: "lowerThird.show('Name', 'Role')",
          useVariables: true,
          width: 12,
        },
        sourceOption(self),
      ],
      callback: async (event) =>
        run(async () => {
          const script = text(event, "script");
          if (!script) return;
          await post(self, "/api/script", { script }, event.options.source);
        }),
    },

    mute: {
      name: "Audio: mute / unmute",
      options: [
        {
          id: "mode",
          type: "dropdown",
          label: "Set",
          choices: [
            { id: "mute", label: "Mute" },
            { id: "unmute", label: "Unmute" },
            { id: "toggle", label: "Toggle" },
          ],
          default: "toggle",
        },
        sourceOption(self),
      ],
      callback: async (event) =>
        run(() => {
          let muted;
          if (event.options.mode === "toggle") {
            // Toggling has to read the current value, so it needs a poll to
            // have landed. Against an unreachable WebLinked the state is
            // unknown and the safe reading of "unknown" is "not muted" —
            // pressing toggle then mutes, which is the recoverable direction.
            muted = !self.stateFor(event.options.source)?.source?.audio_muted;
          } else {
            muted = event.options.mode === "mute";
          }
          return post(self, "/api/mute", { muted }, event.options.source);
        }),
    },

    format: {
      name: "Format: set the raster",
      description:
        "Restarts every output. A 409 means the format DID change but an output could not reopen at it — check outputs[].error.",
      options: [
        {
          id: "format",
          type: "dropdown",
          label: "Format",
          choices: FORMAT_CHOICES,
          default: "1080p50",
          allowCustom: true,
          tooltip:
            "Broadcast shorthand (1080p50) or an explicit raster (1920x1080p50, 3840x600p60). Odd widths are rejected — 4:2:2 needs pixel pairs.",
        },
        sourceOption(self),
      ],
      callback: async (event) =>
        run(async () => {
          const format = text(event, "format");
          if (!format) return;
          await post(self, "/api/format", { format }, event.options.source);
        }),
    },

    pacing: {
      name: "Pacing: internal / external",
      description: "Rebuilds the browser at the same URL.",
      options: [
        {
          id: "pacing",
          type: "dropdown",
          label: "Pacing",
          choices: [
            { id: "external", label: "External (our clock)" },
            { id: "internal", label: "Internal (the browser's)" },
          ],
          default: "external",
        },
        sourceOption(self),
      ],
      callback: async (event) =>
        run(() =>
          post(
            self,
            "/api/pacing",
            { pacing: event.options.pacing },
            event.options.source,
          ),
        ),
    },

    // --- Outputs -----------------------------------------------------------
    output: {
      name: "Output: enable / disable",
      description:
        "Disabling stops the device and frees it for another application — that is the point of it, and also why it is not a cosmetic toggle.",
      options: [
        {
          id: "name",
          type: "dropdown",
          label: "Output",
          choices: outputs,
          default: firstId(outputs),
          allowCustom: true,
        },
        {
          id: "mode",
          type: "dropdown",
          label: "Set",
          choices: [
            { id: "enable", label: "Enable" },
            { id: "disable", label: "Disable" },
            { id: "toggle", label: "Toggle" },
          ],
          default: "toggle",
        },
        sourceOption(self),
      ],
      callback: async (event) =>
        run(async () => {
          const name = text(event, "name");
          if (!name) return;
          let enabled;
          if (event.options.mode === "toggle") {
            enabled = !self.outputFor(event.options.source, name)?.enabled;
          } else {
            enabled = event.options.mode === "enable";
          }
          await post(
            self,
            "/api/output",
            { name, enabled },
            event.options.source,
          );
        }),
    },

    outputBackground: {
      name: "Output: set the background",
      description:
        "What this output composites the page over. 'Transparent' keeps the page's own alpha — a keyed SDI fill or an NDI feed with alpha. A colour is for a switcher that only has a chroma keyer. Applies on the next tick without restarting the output, so it will not drop frames on air.",
      options: [
        {
          id: "name",
          type: "dropdown",
          label: "Output",
          choices: outputs,
          default: firstId(outputs),
          allowCustom: true,
        },
        {
          id: "background",
          type: "dropdown",
          label: "Background",
          choices: [
            { id: "transparent", label: "Transparent (keep the page's alpha)" },
            { id: "colour", label: "Flat colour" },
          ],
          default: "transparent",
        },
        {
          id: "colour",
          type: "textinput",
          label: "Colour (#rrggbb)",
          default: "#00b140",
          useVariables: true,
          tooltip:
            "Reported even while the background is transparent, so switching back returns to this rather than a default. An unreadable colour is a 400, not a silent fallback.",
        },
        sourceOption(self),
      ],
      callback: async (event) =>
        run(async () => {
          const name = text(event, "name");
          if (!name) return;
          const body = { name, background: event.options.background };
          if (event.options.background === "colour") {
            body.colour = text(event, "colour");
          }
          await post(
            self,
            "/api/output/background",
            body,
            event.options.source,
          );
        }),
    },

    outputAdd: {
      name: "Output: add",
      options: [
        {
          id: "body",
          type: "textinput",
          label: "Output JSON",
          default: '{"kind":"ndi","name":"Second","options":{"alpha":true}}',
          useVariables: true,
          width: 12,
        },
        sourceOption(self),
      ],
      callback: async (event) =>
        run(async () => {
          const raw = text(event, "body");
          await post(
            self,
            "/api/output/add",
            JSON.parse(raw),
            event.options.source,
          );
        }),
    },

    outputRemove: {
      name: "Output: remove",
      options: [
        {
          id: "name",
          type: "dropdown",
          label: "Output",
          choices: outputs,
          default: firstId(outputs),
          allowCustom: true,
        },
        sourceOption(self),
      ],
      callback: async (event) =>
        run(async () => {
          const name = text(event, "name");
          if (!name) return;
          await post(
            self,
            "/api/output/remove",
            { name },
            event.options.source,
          );
        }),
    },

    // --- Settings ----------------------------------------------------------
    settingsSave: {
      name: "Settings: save the live configuration",
      options: [],
      callback: async () => run(() => post(self, "/api/settings/save", {})),
    },
    settingsReload: {
      name: "Settings: reload from the file",
      options: [],
      callback: async () => run(() => post(self, "/api/settings/reload", {})),
    },
    settingsApply: {
      name: "Settings: apply a whole source configuration",
      description:
        "Reconciles rather than replacing: an output whose settings have not changed keeps running, so saving a change to an NDI name does not interrupt the SDI feed beside it. The body is validated first — a bad format or a duplicate output name changes nothing.",
      options: [
        {
          id: "body",
          type: "textinput",
          label: "Source JSON",
          default: "{}",
          useVariables: true,
          width: 12,
        },
      ],
      callback: async (event) =>
        run(async () => {
          const raw = text(event, "body");
          await post(self, "/api/settings/apply", { source: JSON.parse(raw) });
        }),
    },

    // --- Whole pipelines ---------------------------------------------------
    sourceAdd: {
      name: "Sources: add a pipeline",
      description: "A preview output is added if the config has none.",
      options: [
        {
          id: "body",
          type: "textinput",
          label: "Source JSON",
          default:
            '{"id":"clock","url":"file:///tmp/clock.html","format":"1080p50","outputs":[{"kind":"ndi","name":"Clock"}]}',
          useVariables: true,
          width: 12,
        },
      ],
      callback: async (event) =>
        run(async () => {
          const raw = text(event, "body");
          await post(self, "/api/sources/add", { source: JSON.parse(raw) });
          await self.poll();
        }),
    },
    sourceRemove: {
      name: "Sources: remove a pipeline",
      description:
        "Refused if it is the only source — a process with no sources has no primary, and every later request would answer 503. Stopping WebLinked is what closing the window is for.",
      options: [
        {
          id: "id",
          type: "dropdown",
          label: "Source",
          choices: sourceChoices(self).filter((c) => c.id !== ""),
          default: "",
          allowCustom: true,
        },
      ],
      callback: async (event) =>
        run(async () => {
          const id = text(event, "id");
          if (!id) return;
          await post(self, "/api/sources/remove", { id });
          await self.poll();
        }),
    },

    // --- Diagnostics -------------------------------------------------------
    logLevel: {
      name: "Diagnostics: set the log level",
      options: [
        {
          id: "level",
          type: "dropdown",
          label: "Level",
          choices: ["error", "warn", "info", "debug", "trace"].map((id) => ({
            id,
            label: id,
          })),
          default: "info",
        },
      ],
      callback: async (event) =>
        run(() => post(self, "/api/log/level", { level: event.options.level })),
    },
    diagnostics: {
      name: "Diagnostics: write a report",
      description:
        "Writes a crash report without a crash, and logs where it landed. The one to hit while a fault is happening rather than after it.",
      options: [
        {
          id: "reason",
          type: "textinput",
          label: "Reason",
          default: "Operator report from Companion",
          useVariables: true,
        },
      ],
      callback: async (event) =>
        run(async () => {
          const reason = text(event, "reason");
          const body = await post(self, "/api/diagnostics/report", { reason });
          self.log(
            "info",
            `Diagnostics report written: ${JSON.stringify(body)}`,
          );
        }),
    },
    refresh: {
      name: "Refresh state now",
      options: [],
      callback: async () => self.poll(),
    },
    fetchState: {
      name: "Diagnostics: log the current state",
      description:
        "Dumps /api/state for the chosen source into Companion's log — for reading outputs[].error after a 409 without leaving the surface.",
      options: [sourceOption(self)],
      callback: async (event) =>
        run(async () => {
          const state = await getJson(self, "/api/state", event.options.source);
          self.log("info", JSON.stringify(state, null, 2));
        }),
    },
  });
}
