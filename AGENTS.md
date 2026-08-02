# AGENTS.md — bringing an LLM up to speed on this Companion module

Orientation for an AI assistant (or a new human) picking this project up cold. There is no
`CLAUDE.md` here; this is the entry point.

---

## 1. What this is

A **Bitfocus Companion connection module** for **WebLinked**, which renders a URL to SDI,
NDI and OMT. It drives the page (navigate, reload, run JavaScript, mute), the raster format,
the outputs, and the settings — and surfaces the pacing and receiver telemetry that says
whether the graphic is actually going out.

JavaScript, Node 22 runtime, `@companion-module/base` 2.x. No runtime dependencies beyond
`base` — Node's global `fetch` is the whole transport.

## 2. HTTP, not OSC, and that is not a preference

WebLinked speaks both with the same verbs. **OSC has no feedback path** — WebLinked never
sends OSC back — so an OSC-driven module could act but never light a button or fill a
variable. `/api/state` carries everything.

Do not "simplify" this to OSC. The health feedbacks are the module's reason to exist.

## 3. It reads `/api/sources`, not `/api/state`

`/api/sources` returns `{primary, sources:[ ...state... ]}` where every entry is the same
shape `/api/state` gives for one pipeline. One request therefore covers however many
pipelines the process runs, and a single-source install just yields one entry.

**The empty source selector is load-bearing.** WebLinked's rule is that an omitted
`?source=` addresses the primary. `withSource()` in `api.js` must produce _no query
parameter_ for an empty selector rather than `?source=` — and generated presets use the
empty selector for the primary, so a config keeps working if the rig is later reduced to one
pipeline.

## 4. Re-registration is driven by a SHAPE key

`main.js::poll` compares a key built from source ids and output names, **not** whole-state
equality. WebLinked's state carries frame counters that tick every frame; whole-state
comparison would re-register every action, feedback, variable and preset several times a
second, churning the dropdowns an operator is trying to use.

If you add something to the definitions that depends on another part of the state, extend
the shape key — otherwise it will silently never update.

## 5. Status codes carry meaning; preserve it

- **409** — the request was valid but a device refused it. From `/api/format` this is the
  sharp one: the format **did** change, an output could not reopen at it, and the operator
  must go and read `outputs[].error`. `api.js` says so in the message; the "log the current
  state" action exists so they can do that without leaving the surface.
- **400** — unparseable body, or an unreadable colour (deliberately not a silent fallback).
- **404** — unknown output or source id.

## 6. Traps already paid for

- **`format` in the state is the FULL raster** (`1920x1080p50`), not the shorthand you set
  it with (`1080p50`). A "format is" feedback comparing against the shorthand never lights.
  The tooltip and the test both say so.
- **`enabled` and `running` are different things.** Enabled is configured intent; running
  means the device opened. An output can be enabled and dead — a card claimed by another
  application. Generated presets light on `running`.
- **`receivers` is meaningless for SDI and screen outputs.** The receiver preset is only
  generated for `ndi` and `omt`.
- **Repeated frames being high is normal** for a static graphic. Its threshold is a per-
  button option, not a constant, because "acceptable" differs per graphic.
- **`@companion-module/base` 2.x presets are `setPresetDefinitions(structure, definitions)`**
  with `type: 'simple'`. A 1.x `category` field loads fine and then never appears in the UI.
- **The token goes in the `Authorization` header**, not the query string — a URL with a
  secret in it ends up in logs. WebLinked accepts both.

## 7. Deliberate omissions — do not "fix" these

- **No preview.** `/api/preview` returns raw BGRA with dimensions in headers; Companion has
  no way to show it on a button.
- **No `/api/input`.** Pointer and keyboard injection into the page is a control-page
  feature; a Stream Deck has no cursor, and normalised coordinates from a button are
  meaningless.
- **State is not cleared on a failed poll.** Dropdowns stay populated through a blip, at the
  cost of feedbacks evaluating stale state. The `connected` feedback is the honest signal
  and the docs say to put it on any page with output colour.

## 8. Context that matters

This is a graphic that is on air. Enabling and disabling outputs takes real devices up and
down, and a format change restarts every one of them. Prefer failing safe and surfacing
refusals loudly.

## 9. Conventions

- Not in the official Companion module store — installs via **Settings → Developer modules
  path**.
- `npm test` drives the real source against a fake WebLinked on a real HTTP server. Extend it
  rather than testing by hand against a rig that is about to go on air.
- Ships a user-facing AI-assisted disclaimer.
- "Commit" means commit **and** push.
