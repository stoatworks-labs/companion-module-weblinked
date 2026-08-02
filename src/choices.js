// Dropdown lists built from the last poll, shared between actions, feedbacks
// and presets.

/** The source selector. The blank entry is not padding — it is how WebLinked's
 *  own API works: omit ?source= and the request goes to the primary. Keeping
 *  that as the default means a single-source install never has to know the
 *  multi-source feature exists, and a Companion config built against one keeps
 *  working when a second pipeline is added. */
export function sourceChoices(self) {
  return [
    { id: "", label: "— Primary source —" },
    ...self.sources.map((s) => {
      const id = self.sourceId(s);
      return { id, label: id === self.primary ? `${id} (primary)` : id };
    }),
  ];
}

/** Output names across every source, de-duplicated. Outputs are addressed by
 *  NAME, not by index, and a name is only unique within one source — so the
 *  list is a convenience for the dropdown and the source selector is what
 *  actually disambiguates. */
export function outputChoices(self) {
  const seen = new Map();
  for (const state of self.sources) {
    const sourceId = self.sourceId(state);
    for (const output of state.outputs ?? []) {
      if (!seen.has(output.name)) {
        seen.set(output.name, {
          id: output.name,
          label: `${output.name} (${output.kind}${self.sources.length > 1 ? ` — ${sourceId}` : ""})`,
        });
      }
    }
  }
  return [...seen.values()];
}

/** Broadcast shorthand WebLinked accepts, plus an explicit-raster reminder. It
 *  also takes `1920x1080p50` and `3840x600p60`; odd widths are rejected because
 *  4:2:2 needs pixel pairs. */
export const FORMAT_CHOICES = [
  "1080p50",
  "1080p59.94",
  "1080p60",
  "1080p25",
  "1080p29.97",
  "1080p30",
  "1080p24",
  "1080p23.98",
  "1080i50",
  "1080i59.94",
  "720p50",
  "720p59.94",
  "720p60",
  "2160p25",
  "2160p29.97",
  "2160p30",
  "2160p50",
  "2160p60",
].map((id) => ({ id, label: id }));

export function firstId(choices) {
  return choices[0]?.id ?? "";
}
