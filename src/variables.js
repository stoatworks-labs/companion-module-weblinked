import { safeId } from "./main.js";

// Definitions are rebuilt only when the SHAPE changes (main.js compares source
// ids and output names, not whole state) — WebLinked's state carries frame
// counters that tick every frame, and rebuilding definitions at frame rate
// would churn the variable list an operator is trying to read.
//
// Against a WebLinked that has never been reachable there are no per-source
// variables at all, rather than a set of empty ones. The module does not know
// what pipelines exist, and inventing names for them would put labels on
// buttons that address nothing.
export default function UpdateVariableDefinitions(self) {
  const defs = {
    connection_status: { name: "Connection status" },
    source_count: { name: "Number of sources (pipelines)" },
    primary_source: { name: "Primary source id" },
  };

  for (const state of self.sources) {
    const id = self.sourceId(state);
    const p = `${safeId(id)}_`;
    defs[`${p}url`] = { name: `${id}: loaded URL` };
    defs[`${p}running`] = { name: `${id}: running` };
    defs[`${p}format`] = { name: `${id}: format (full raster)` };
    defs[`${p}loading`] = { name: `${id}: loading` };
    defs[`${p}console_errors`] = { name: `${id}: console errors` };
    defs[`${p}popups`] = { name: `${id}: popup attempts` };
    defs[`${p}muted`] = { name: `${id}: audio muted` };
    defs[`${p}dropped_ticks`] = { name: `${id}: pacing — dropped ticks` };
    defs[`${p}repeated_frames`] = { name: `${id}: pacing — repeated frames` };
    defs[`${p}lateness_us`] = { name: `${id}: pacing — last lateness (us)` };
    defs[`${p}audio_underruns`] = { name: `${id}: audio underruns` };
    defs[`${p}output_count`] = { name: `${id}: number of outputs` };
    defs[`${p}receivers`] = { name: `${id}: receivers across all outputs` };

    for (const output of state.outputs ?? []) {
      const op = `${p}out_${safeId(output.name)}_`;
      defs[`${op}running`] = { name: `${id} / ${output.name}: running` };
      defs[`${op}enabled`] = { name: `${id} / ${output.name}: enabled` };
      defs[`${op}frames`] = { name: `${id} / ${output.name}: frames` };
      defs[`${op}receivers`] = { name: `${id} / ${output.name}: receivers` };
    }
  }

  self.setVariableDefinitions(defs);
}
