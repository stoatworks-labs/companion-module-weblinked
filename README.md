# companion-module-weblinked

> **AI-assisted project.** This module was built with the help of
> [Claude](https://claude.ai), Anthropic's AI assistant — including
> implementation and documentation. Review it accordingly before relying on
> it in production.

A [Bitfocus Companion](https://bitfocus.io/companion) connection module for
[WebLinked](https://github.com/stoatworks-labs/weblinked) — drive a browser page
that is going out over SDI, NDI or OMT from a Stream Deck, and watch whether it
is actually going out.

<!-- downloads:start -->

## Download

**[v1.1.0](https://github.com/stoatworks-labs/companion-module-weblinked/releases/tag/v1.1.0)**

This release contains:

- [`companion-module-weblinked-pkg.tgz`](https://github.com/stoatworks-labs/companion-module-weblinked/releases/latest/download/companion-module-weblinked-pkg.tgz) — npm package, 12 KB
- [`weblinked-1.1.0.tgz`](https://github.com/stoatworks-labs/companion-module-weblinked/releases/download/v1.1.0/weblinked-1.1.0.tgz) — npm package, 12 KB

All builds, checksums and release notes: [github.com/stoatworks-labs/companion-module-weblinked/releases](https://github.com/stoatworks-labs/companion-module-weblinked/releases).

<!-- downloads:end -->

## What it does

- **Actions** — navigate, reload (with cache bypass), **run JavaScript in the
  page**, mute/unmute/toggle audio, set the raster format, enable/disable/toggle
  any output, set a per-output background (transparent or a flat colour), add
  and remove outputs, add and remove whole pipelines, change pacing, save/reload
  /apply settings, set the log level, write a diagnostics report, and dump the
  current state into Companion's log.
- **Feedbacks** — source running, output enabled, **output running** (the device
  actually opened), output has receivers, audio muted, page loading, dropped
  ticks, repeated frames, console errors, popup attempts, audio underruns,
  format matches, and WebLinked is connected.
- **Variables** — per source: URL, running, format, loading, console errors,
  popups, muted, pacing counters, audio underruns, output count and total
  receivers. Per output: running, enabled, frames, receivers.
- **Presets** — The page, Outputs (**generated from the outputs this rig
  actually has**) and Health.

## Why HTTP and not OSC

WebLinked speaks both, with the same verbs — but **OSC has no feedback path**.
WebLinked never sends OSC back, so an OSC module could act and never light a
button. `/api/state` carries everything, including the pacing and receiver
numbers that are the reason to put this on a surface rather than keep the
control page open in a browser tab nobody is looking at mid-show.

If you only want to fire buttons and do not care about feedback, the generic OSC
module works fine and is documented in WebLinked's own `docs/03-control-api.md`.

## Setting it up

Default is `127.0.0.1:7654`. If WebLinked was started with `--bind 0.0.0.0` it
should also have been started with `--token`; put that token in the connection
config. There is no TLS, so keep it on a trusted show network or behind a proxy.

## Multi-source

WebLinked can run several independent pipelines in one process. Every per-source
action and feedback carries a **Source** selector whose default is _Primary_ —
which sends no `?source=` at all, exactly as WebLinked intends. A config built
against a single-pipeline install therefore keeps working unchanged when a
second pipeline is added.

An unknown source id is a 404 from WebLinked, not a silent no-op.

## Run JavaScript is the one that repays attention

A graphic that already defines its own functions can be driven from a button
with no integration work at all:

```
lowerThird.show('Anna Kowalski', 'Head of Sound')
setScore('home', 3)
document.querySelector('#lower-third').classList.add('in')
```

Two presets ship as in/out examples.

## Reading the health feedbacks

| Feedback             | Means                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dropped ticks        | The clock fell more than a frame behind. Should be **0**.                                                                                              |
| Repeated frames      | **High is normal for a static graphic.** Rising on an animated one means the page is too slow — so the threshold is per-button.                        |
| Output running       | The device opened and is putting frames out. An output can be _enabled_ and dead: a card claimed by another application, or a format it will not take. |
| Output has receivers | Someone is actually watching. NDI/OMT only — SDI and screen outputs have no notion of a receiver.                                                      |
| Popup attempts       | The page tried to open a window. A page doing this repeatedly is usually about to behave oddly on air.                                                 |

## Status codes worth knowing

**409 from Format is the sharp one**: the format _did_ change, but an output
could not reopen at it. The module says so and points at `outputs[].error` —
"Diagnostics: log the current state" dumps that into Companion's log without
leaving the surface.

400 is a body or format that could not be parsed; 404 an unknown output or
source id.

## Tests

```bash
npm test
```

Drives the module's real source against a fake WebLinked on a real HTTP server:
the `?source=` selector, token auth, the 409 and 400 paths, the health
feedbacks, and the generated per-output presets.

## Installing

Not in the official Companion module store. Install via
**Settings → Developer modules path**.

<!-- attributions:start -->
This project is built on other people's work — see [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
<!-- attributions:end -->

## Licence

MIT — see [LICENSE](LICENSE).
