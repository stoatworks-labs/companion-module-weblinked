// Drives the WebLinked module's real source against a fake WebLinked on a real
// HTTP server. Covers the ?source= selector, token auth, the 409 path, the
// health feedbacks, and the generated per-output presets.
import http from "node:http";
import assert from "node:assert/strict";

const watchdog = setTimeout(() => {
  console.error("\nTIMED OUT — no completion within 30s.");
  process.exit(2);
}, 30000);
watchdog.unref?.();

const MOD = new URL("../src/", import.meta.url).pathname;
const UpdateActions = (await import(`${MOD}actions.js`)).default;
const UpdateFeedbacks = (await import(`${MOD}feedbacks.js`)).default;
const UpdateVariables = (await import(`${MOD}variables.js`)).default;
const UpdatePresets = (await import(`${MOD}presets.js`)).default;
const { fetchSources } = await import(`${MOD}api.js`);
const { safeId } = await import(`${MOD}main.js`);

const TOKEN = "s3cret";

function makeSource(id, overrides = {}) {
  return {
    version: "0.7.0",
    running: true,
    format: "1920x1080p50",
    source: {
      id,
      url: `https://example.com/${id}`,
      loaded_url: `https://example.com/${id}`,
      loading: false,
      audio_muted: false,
      console_errors: 0,
      popups: 0,
    },
    outputs: [
      {
        kind: "ndi",
        name: "Graphic",
        running: true,
        enabled: true,
        receivers: 2,
        frames: 100,
      },
      {
        kind: "decklink",
        name: "SDI 1",
        running: false,
        enabled: true,
        receivers: 0,
        frames: 0,
      },
    ],
    pacing: { dropped_ticks: 0, repeated_frames: 12, last_lateness_us: 300 },
    audio: { underruns: 0 },
    ...overrides,
  };
}

const world = {
  primary: "main",
  sources: [makeSource("main"), makeSource("lower-third")],
};
const calls = [];

const body = (req) =>
  new Promise((r) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => r(b));
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    return send(401, { error: "bad token" });
  }
  const selector = url.searchParams.get("source");
  const target =
    world.sources.find((s) => s.source.id === (selector || world.primary)) ??
    null;

  if (url.pathname === "/api/sources" && req.method === "GET")
    return send(200, world);
  if (url.pathname === "/api/state" && req.method === "GET") {
    if (!target) return send(404, { error: "no such source" });
    return send(200, target);
  }

  const payload =
    req.method === "POST" ? JSON.parse((await body(req)) || "{}") : {};
  calls.push({ path: url.pathname, selector, payload });

  if (selector && !target) return send(404, { error: "no such source" });

  switch (url.pathname) {
    case "/api/url":
      target.source.url = payload.url;
      target.source.loaded_url = payload.url;
      return send(200, { ok: true });
    case "/api/reload":
      return send(200, { ok: true });
    case "/api/script":
      return send(200, { ok: true });
    case "/api/mute":
      target.source.audio_muted = !!payload.muted;
      return send(200, { ok: true });
    case "/api/format":
      // The interesting failure: the format DID change, but an output could
      // not reopen at it.
      if (payload.format === "2160p60")
        return send(409, { error: "card will not open at 2160p60" });
      target.format = payload.format;
      return send(200, { ok: true });
    case "/api/output": {
      const o = target.outputs.find((x) => x.name === payload.name);
      if (!o) return send(404, { error: "no such output" });
      o.enabled = !!payload.enabled;
      o.running = o.enabled && o.kind === "ndi";
      return send(200, { ok: true });
    }
    case "/api/output/background":
      if (
        payload.background === "colour" &&
        !/^#[0-9a-f]{6}$/i.test(payload.colour ?? "")
      )
        return send(400, { error: "unreadable colour" });
      return send(200, { ok: true });
    case "/api/output/add":
      target.outputs.push({
        ...payload,
        running: true,
        enabled: true,
        receivers: 0,
      });
      return send(200, { ok: true });
    case "/api/output/remove":
      target.outputs = target.outputs.filter((x) => x.name !== payload.name);
      return send(200, { ok: true });
    case "/api/sources/add":
      world.sources.push(makeSource(payload.source.id));
      return send(200, { ok: true });
    case "/api/sources/remove":
      if (world.sources.length === 1)
        return send(409, { error: "cannot remove the only source" });
      world.sources = world.sources.filter((s) => s.source.id !== payload.id);
      return send(200, { ok: true });
    case "/api/pacing":
    case "/api/settings/save":
    case "/api/settings/reload":
    case "/api/settings/apply":
    case "/api/log/level":
      return send(200, { ok: true });
    case "/api/diagnostics/report":
      return send(200, { bundle: "/tmp/report.json" });
    default:
      return send(404, { error: "not found" });
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;

// --- the fake instance -----------------------------------------------------
let actions = {};
let feedbacks = {};
let variables = {};
let presetStructure = null;
let presetDefs = null;
const variableValues = {};
let lastError = "";
let lastInfo = "";

const self = {
  config: {
    host: "127.0.0.1",
    port: String(PORT),
    token: TOKEN,
    pollinterval: 1000,
  },
  primary: "",
  sources: [],
  connected: false,
  lastShape: "",
  log: (level, msg) => {
    if (level === "error") lastError = msg;
    if (level === "info") lastInfo = msg;
  },
  updateStatus: () => {},
  checkFeedbacks: () => {},
  checkAllFeedbacks: () => {},
  setActionDefinitions: (d) => (actions = d),
  setFeedbackDefinitions: (d) => (feedbacks = d),
  setVariableDefinitions: (d) => (variables = d),
  setPresetDefinitions: (s, p) => {
    presetStructure = s;
    presetDefs = p;
  },
  setVariableValues: (v) => Object.assign(variableValues, v),
  parseVariablesInString: async (s) => s,
  sourceId(state) {
    return state?.source?.id ?? state?.id ?? this.primary ?? "";
  },
  stateFor(sourceId) {
    const id = String(sourceId ?? "").trim();
    if (!id)
      return (
        this.sources.find((s) => this.sourceId(s) === this.primary) ??
        this.sources[0] ??
        null
      );
    return this.sources.find((s) => this.sourceId(s) === id) ?? null;
  },
  outputFor(sourceId, name) {
    return (
      (this.stateFor(sourceId)?.outputs ?? []).find((o) => o.name === name) ??
      null
    );
  },
  rebuild() {
    UpdateActions(this);
    UpdateFeedbacks(this);
    UpdateVariables(this);
    UpdatePresets(this);
    this.refreshVariableValues();
  },
  refreshVariableValues() {
    const values = {
      connection_status: this.connected ? "Connected" : "Disconnected",
      source_count: this.sources.length,
      primary_source: this.primary,
    };
    for (const state of this.sources) {
      const p = `${safeId(this.sourceId(state))}_`;
      values[`${p}url`] = state.source?.loaded_url ?? "";
      values[`${p}running`] = state.running ? "Running" : "Stopped";
      values[`${p}format`] = state.format ?? "";
      values[`${p}dropped_ticks`] = state.pacing?.dropped_ticks ?? 0;
      values[`${p}receivers`] = (state.outputs ?? []).reduce(
        (n, o) => n + (Number(o.receivers) || 0),
        0,
      );
      for (const o of state.outputs ?? []) {
        const op = `${p}out_${safeId(o.name)}_`;
        values[`${op}running`] = o.running ? "Running" : "Stopped";
        values[`${op}receivers`] = o.receivers ?? 0;
      }
    }
    this.setVariableValues(values);
  },
  async poll() {
    try {
      const b = await fetchSources(this);
      this.primary = b?.primary ?? "";
      this.sources = Array.isArray(b?.sources) ? b.sources : [];
      this.connected = true;
      this.rebuild();
    } catch (e) {
      this.connected = false;
      lastError = e.message;
    }
  },
};

await self.poll();

let failures = 0;
const check = async (label, fn) => {
  try {
    await fn();
    console.log(`  ok   ${label}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${label}\n       ${e.message}`);
  }
};
const fire = (id, options = {}) => actions[id].callback({ options });
const fb = (id, options = {}) =>
  feedbacks[id].callback(
    { options },
    { parseVariablesInString: async (s) => s },
  );

console.log("\n== connection ==");
await check("both pipelines arrived", () => {
  assert.equal(self.sources.length, 2);
  assert.equal(self.primary, "main");
});
await check(
  "a wrong token is reported as such, not as a generic failure",
  async () => {
    const saved = self.config.token;
    self.config.token = "wrong";
    await self.poll();
    assert.match(lastError, /--token/);
    self.config.token = saved;
    await self.poll();
  },
);

console.log("\n== definitions ==");
await check("19 actions registered", () =>
  assert.equal(Object.keys(actions).length, 19),
);
await check("13 feedbacks registered", () =>
  assert.equal(Object.keys(feedbacks).length, 13),
);
await check("per-source and per-output variables exist", () => {
  assert.ok(variables.main_url, "main_url");
  assert.ok(variables.lower_third_url, "lower_third_url (sanitised)");
  assert.ok(variables.main_out_Graphic_receivers, "main_out_Graphic_receivers");
  assert.ok(variables.main_out_SDI_1_running, "main_out_SDI_1_running");
});

console.log("\n== presets ==");
await check("every preset is 2.x 'simple' and cross-references resolve", () => {
  for (const [id, p] of Object.entries(presetDefs)) {
    assert.equal(p.type, "simple", `${id} type`);
    for (const st of p.steps)
      for (const a of st.down)
        assert.ok(actions[a.actionId], `${id} -> action ${a.actionId}`);
    for (const f of p.feedbacks)
      assert.ok(feedbacks[f.feedbackId], `${id} -> feedback ${f.feedbackId}`);
  }
});
await check(
  "every structure reference resolves, and nothing is orphaned",
  () => {
    const referenced = new Set(
      presetStructure.flatMap((s) => s.definitions.flatMap((g) => g.presets)),
    );
    for (const s of presetStructure)
      for (const g of s.definitions)
        for (const ref of g.presets)
          assert.ok(presetDefs[ref], `${s.id} -> ${ref}`);
    for (const id of Object.keys(presetDefs))
      assert.ok(referenced.has(id), `${id} defined but in no section`);
  },
);
await check("a preset per real output was generated", () => {
  assert.ok(presetDefs.out_main_Graphic, "out_main_Graphic");
  assert.ok(presetDefs.out_main_SDI_1, "out_main_SDI_1");
  assert.ok(presetDefs.rx_main_Graphic, "NDI gets a receiver preset");
  assert.ok(!presetDefs.rx_main_SDI_1, "SDI does not — it has no receivers");
});
await check("a non-primary source's presets carry its selector", () => {
  const p = presetDefs.out_lower_third_Graphic;
  assert.equal(p.steps[0].down[0].options.source, "lower-third");
  assert.equal(
    presetDefs.out_main_Graphic.steps[0].down[0].options.source,
    "",
    "the primary uses the empty selector",
  );
});

console.log("\n== feedbacks ==");
await check("running / outputRunning / outputEnabled", () => {
  assert.equal(fb("running", { source: "" }), true);
  assert.equal(fb("outputRunning", { name: "Graphic", source: "" }), true);
  assert.equal(
    fb("outputRunning", { name: "SDI 1", source: "" }),
    false,
    "enabled but not running is the state worth seeing",
  );
  assert.equal(fb("outputEnabled", { name: "SDI 1", source: "" }), true);
});
await check("outputHasReceivers counts receivers", () => {
  assert.equal(
    fb("outputHasReceivers", { name: "Graphic", count: 1, source: "" }),
    true,
  );
  assert.equal(
    fb("outputHasReceivers", { name: "Graphic", count: 3, source: "" }),
    false,
  );
});
await check("health thresholds", () => {
  assert.equal(fb("droppedTicks", { threshold: 0, source: "" }), false);
  assert.equal(fb("repeatedFrames", { threshold: 5, source: "" }), true);
  assert.equal(fb("repeatedFrames", { threshold: 100, source: "" }), false);
  assert.equal(fb("consoleErrors", { threshold: 0, source: "" }), false);
});
await check("formatIs compares against the FULL raster", async () => {
  assert.equal(
    await fb("formatIs", { format: "1920x1080p50", source: "" }),
    true,
  );
  assert.equal(
    await fb("formatIs", { format: "1080p50", source: "" }),
    false,
    "the shorthand you set it with is not what the state reports",
  );
});
await check("connected is true", () => assert.equal(fb("connected"), true));

console.log("\n== actions ==");
await check("navigate hits the primary with no selector", async () => {
  calls.length = 0;
  await fire("navigate", { url: "https://example.com/next", source: "" });
  assert.equal(calls[0].path, "/api/url");
  assert.equal(calls[0].selector, null, "no ?source= for the primary");
});
await check("navigate on a named source carries ?source=", async () => {
  calls.length = 0;
  await fire("navigate", {
    url: "https://example.com/lt",
    source: "lower-third",
  });
  assert.equal(calls[0].selector, "lower-third");
});
await check("mute toggle reads the current state", async () => {
  await fire("mute", { mode: "toggle", source: "" });
  await self.poll();
  assert.equal(self.stateFor("").source.audio_muted, true);
  await fire("mute", { mode: "toggle", source: "" });
  await self.poll();
  assert.equal(self.stateFor("").source.audio_muted, false);
});
await check("output toggle flips enabled", async () => {
  await fire("output", { name: "Graphic", mode: "toggle", source: "" });
  await self.poll();
  assert.equal(self.outputFor("", "Graphic").enabled, false);
  await fire("output", { name: "Graphic", mode: "enable", source: "" });
  await self.poll();
  assert.equal(self.outputFor("", "Graphic").enabled, true);
});
await check("a 409 is reported with the outputs[].error hint", async () => {
  lastError = "";
  await fire("format", { format: "2160p60", source: "" });
  assert.match(lastError, /409/);
  assert.match(lastError, /outputs\[\]\.error/);
});
await check("a good format lands", async () => {
  await fire("format", { format: "720p50", source: "" });
  await self.poll();
  assert.equal(self.stateFor("").format, "720p50");
});
await check("a bad background colour is a 400, surfaced", async () => {
  lastError = "";
  await fire("outputBackground", {
    name: "Graphic",
    background: "colour",
    colour: "green",
    source: "",
  });
  assert.match(lastError, /400/);
});
await check("a good background colour is accepted", async () => {
  lastError = "";
  await fire("outputBackground", {
    name: "Graphic",
    background: "colour",
    colour: "#00b140",
    source: "",
  });
  assert.equal(lastError, "");
});
await check("adding and removing an output rebuilds the presets", async () => {
  await fire("outputAdd", {
    body: '{"kind":"ndi","name":"Second"}',
    source: "",
  });
  await self.poll();
  assert.ok(presetDefs.out_main_Second, "the new output got a preset");
  await fire("outputRemove", { name: "Second", source: "" });
  await self.poll();
  assert.ok(!presetDefs.out_main_Second, "and lost it again");
});
await check("removing the only source is refused, and surfaced", async () => {
  await fire("sourceRemove", { id: "lower-third" });
  await self.poll();
  assert.equal(self.sources.length, 1);
  lastError = "";
  await fire("sourceRemove", { id: "main" });
  assert.match(lastError, /409/);
});
await check("diagnostics logs where the report landed", async () => {
  lastInfo = "";
  await fire("diagnostics", { reason: "test" });
  assert.match(lastInfo, /report\.json/);
});

console.log("\n== variables ==");
await check("values track the state", () => {
  self.refreshVariableValues();
  assert.equal(variableValues.connection_status, "Connected");
  assert.equal(variableValues.main_out_Graphic_receivers, 2);
  assert.equal(variableValues.main_running, "Running");
});

server.close();
console.log("\n== the checkFeedbacks trap ==");
// InstanceBase.checkFeedbacks(type, ...rest) requires AT LEAST ONE type: with no
// arguments it forwards [undefined] to the host, which checks a feedback type
// called "undefined" — i.e. nothing at all. Every feedback then sits frozen at
// whatever it last evaluated to, with no error anywhere. checkAllFeedbacks() is
// the correct call for "re-evaluate everything".
await check("no bare checkFeedbacks() survives in src/", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const dir = new URL("../src/", import.meta.url).pathname;
  const offenders = [];
  for (const f of readdirSync(dir)) {
    if (!/\.(js|ts)$/.test(f)) continue;
    const body = readFileSync(dir + f, "utf8");
    if (/[^A-Za-z]checkFeedbacks\(\s*\)/.test(body)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], "use checkAllFeedbacks() instead");
});

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} CHECK(S) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
