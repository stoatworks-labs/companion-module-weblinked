import { sourceChoices, outputChoices, firstId } from "./choices.js";

// The health feedbacks are the reason to put WebLinked on a surface rather than
// keep a browser tab open on the control page. Each maps to a specific failure
// an operator can act on:
//
//   dropped ticks      the clock fell more than a frame behind — should be 0
//   repeated frames    normal and high for a static graphic; rising on an
//                      animated one means the page is too slow
//   no receivers       nobody is watching this NDI/OMT feed
//   console errors     the page is throwing; the graphic is probably wrong
//   popups             the page tried to open a window, which almost always
//                      precedes it behaving oddly on air
//
// Thresholds are options rather than constants because "acceptable" differs per
// rig: a repeated-frames count that is fine for a static lower third is a fault
// on a clock.

const sourceOption = (self) => ({
  id: "source",
  type: "dropdown",
  label: "Source",
  choices: sourceChoices(self),
  default: "",
  allowCustom: true,
});

export default function UpdateFeedbacks(self) {
  const outputs = outputChoices(self);
  const outputOption = {
    id: "name",
    type: "dropdown",
    label: "Output",
    choices: outputs,
    default: firstId(outputs),
    allowCustom: true,
  };

  const src = (feedback) => self.stateFor(feedback.options.source);
  const out = (feedback) =>
    self.outputFor(
      feedback.options.source,
      String(feedback.options.name ?? ""),
    );

  self.setFeedbackDefinitions({
    running: {
      type: "boolean",
      name: "Source is running",
      defaultStyle: { bgcolor: 0x003300, color: 0x00ff00 },
      options: [sourceOption(self)],
      callback: (f) => !!src(f)?.running,
    },

    outputEnabled: {
      type: "boolean",
      name: "Output is enabled",
      description:
        "Enabled is the configured intent. Use 'Output is running' for whether the device actually opened.",
      defaultStyle: { bgcolor: 0x003300, color: 0x00ff00 },
      options: [outputOption, sourceOption(self)],
      callback: (f) => !!out(f)?.enabled,
    },

    outputRunning: {
      type: "boolean",
      name: "Output is running",
      description:
        "The device opened and is putting frames out. An output can be enabled but not running — a card claimed by another application, or a format it will not take.",
      defaultStyle: { bgcolor: 0x003300, color: 0x00ff00 },
      options: [outputOption, sourceOption(self)],
      callback: (f) => !!out(f)?.running,
    },

    outputHasReceivers: {
      type: "boolean",
      name: "Output has receivers (NDI / OMT)",
      description:
        "Someone is actually watching this feed. Meaningless for SDI and screen outputs, which have no notion of a receiver.",
      defaultStyle: { bgcolor: 0x003300, color: 0x00ff00 },
      options: [
        outputOption,
        {
          id: "count",
          type: "number",
          label: "At least",
          min: 1,
          max: 100,
          default: 1,
        },
        sourceOption(self),
      ],
      callback: (f) =>
        (Number(out(f)?.receivers) || 0) >= Number(f.options.count ?? 1),
    },

    muted: {
      type: "boolean",
      name: "Audio is muted",
      defaultStyle: { bgcolor: 0xcc0000, color: 0xffffff },
      options: [sourceOption(self)],
      callback: (f) => !!src(f)?.source?.audio_muted,
    },

    loading: {
      type: "boolean",
      name: "Page is loading",
      defaultStyle: { bgcolor: 0xcc7a00, color: 0x000000 },
      options: [sourceOption(self)],
      callback: (f) => !!src(f)?.source?.loading,
    },

    droppedTicks: {
      type: "boolean",
      name: "Pacing: dropped ticks above a threshold",
      description:
        "The clock fell more than a frame behind. Should be 0 on a healthy rig — any rise is worth investigating.",
      defaultStyle: { bgcolor: 0xcc0000, color: 0xffffff },
      options: [
        {
          id: "threshold",
          type: "number",
          label: "Above",
          min: 0,
          max: 100000,
          default: 0,
        },
        sourceOption(self),
      ],
      callback: (f) =>
        (Number(src(f)?.pacing?.dropped_ticks) || 0) >
        Number(f.options.threshold ?? 0),
    },

    repeatedFrames: {
      type: "boolean",
      name: "Pacing: repeated frames above a threshold",
      description:
        "High is NORMAL for a static graphic — the page simply is not repainting. Rising on an animated one means the page cannot keep up. Set the threshold for what this particular graphic should do.",
      defaultStyle: { bgcolor: 0xcc7a00, color: 0x000000 },
      options: [
        {
          id: "threshold",
          type: "number",
          label: "Above",
          min: 0,
          max: 1000000,
          default: 100,
        },
        sourceOption(self),
      ],
      callback: (f) =>
        (Number(src(f)?.pacing?.repeated_frames) || 0) >
        Number(f.options.threshold ?? 0),
    },

    consoleErrors: {
      type: "boolean",
      name: "Page has thrown console errors",
      defaultStyle: { bgcolor: 0xcc0000, color: 0xffffff },
      options: [
        {
          id: "threshold",
          type: "number",
          label: "Above",
          min: 0,
          max: 100000,
          default: 0,
        },
        sourceOption(self),
      ],
      callback: (f) =>
        (Number(src(f)?.source?.console_errors) || 0) >
        Number(f.options.threshold ?? 0),
    },

    popups: {
      type: "boolean",
      name: "Page has tried to open a popup",
      description:
        "A page doing this repeatedly is usually about to behave oddly on air.",
      defaultStyle: { bgcolor: 0xcc7a00, color: 0x000000 },
      options: [sourceOption(self)],
      callback: (f) => (Number(src(f)?.source?.popups) || 0) > 0,
    },

    audioUnderruns: {
      type: "boolean",
      name: "Audio underruns above a threshold",
      description: "A few at start-up are normal; a rising count is not.",
      defaultStyle: { bgcolor: 0xcc7a00, color: 0x000000 },
      options: [
        {
          id: "threshold",
          type: "number",
          label: "Above",
          min: 0,
          max: 100000,
          default: 5,
        },
        sourceOption(self),
      ],
      callback: (f) =>
        (Number(src(f)?.audio?.underruns) || 0) >
        Number(f.options.threshold ?? 0),
    },

    formatIs: {
      type: "boolean",
      name: "Source is at a specific format",
      defaultStyle: { bgcolor: 0x003300, color: 0x00ff00 },
      options: [
        {
          id: "format",
          type: "textinput",
          label: "Format",
          default: "1920x1080p50",
          useVariables: true,
          tooltip:
            "Compared against the state's own `format`, which is the FULL raster (1920x1080p50) — not the shorthand you set it with.",
        },
        sourceOption(self),
      ],
      // `useVariables` options are expanded by Companion before the callback
      // runs; the 2.x feedback context has no parseVariablesInString, so asking
      // for one threw and the feedback never evaluated.
      callback: (f) => {
        const wanted = String(f.options.format ?? "").trim();
        return !!wanted && src(f)?.format === wanted;
      },
    },

    connected: {
      type: "boolean",
      name: "WebLinked is connected",
      description:
        "The last poll succeeded. Every other feedback keeps evaluating against the last known state while this is dark, so put it on any page carrying output colour.",
      defaultStyle: { bgcolor: 0x003300, color: 0x00ff00 },
      options: [],
      callback: () => !!self.connected,
    },
  });
}
