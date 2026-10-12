# companion-module-weblinked

> **AI-assisted project.** This module was created with [Claude](https://claude.com/claude-code)
> (Anthropic), directed and reviewed by a human author. Check it over before you rely on it for
> a show.

A [Bitfocus Companion](https://bitfocus.io/companion) module for
[WebLinked](https://github.com/stoatworks-labs/weblinked). It drives a browser page
that's going out over SDI, NDI or OMT from a Stream Deck, and tells you whether
it's actually going out.

<!-- downloads:start -->

## Download

**[v1.1.3](https://github.com/stoatworks-labs/companion-module-weblinked/releases/tag/v1.1.3)**

This release contains:

- [`companion-module-weblinked-pkg.tgz`](https://github.com/stoatworks-labs/companion-module-weblinked/releases/latest/download/companion-module-weblinked-pkg.tgz) — npm package, 13 KB
- [`weblinked-1.1.3.tgz`](https://github.com/stoatworks-labs/companion-module-weblinked/releases/download/v1.1.3/weblinked-1.1.3.tgz) — npm package, 13 KB

All builds, checksums and release notes: [github.com/stoatworks-labs/companion-module-weblinked/releases](https://github.com/stoatworks-labs/companion-module-weblinked/releases).

<!-- downloads:end -->

## What it does

- **Actions:** navigate, reload (with cache bypass), run JavaScript in the
  page, mute/unmute/toggle audio, set the raster format, enable/disable/toggle
  any output, set a per-output background (transparent or a flat colour), add
  and remove outputs, add and remove whole pipelines, change pacing, save/reload
  /apply settings, set the log level, write a diagnostics report, and dump the
  current state into Companion's log.
- **Feedbacks:** source running, output enabled, output running (the device
  actually opened), output has receivers, audio muted, page loading, dropped
  ticks, repeated frames, console errors, popup attempts, audio underruns,
  format matches, and WebLinked is connected.
- **Variables:** per source, the URL, running, format, loading, console errors,
  popups, muted, pacing counters, audio underruns, output count and total
  receivers. Per output, running, enabled, frames and receivers.
- **Presets:** The page, Outputs (built from the outputs your rig actually
  has) and Health.

## Why HTTP and not OSC

WebLinked speaks both, with the same verbs, but OSC has no way back. WebLinked
never sends OSC back, so an OSC module could fire things all day and never
light a button. `/api/state` carries everything, including the pacing and
receiver numbers, and those are why you'd put this on a surface rather than leave
the control page open in a browser tab that nobody's looking at mid-show.

If you only want to fire buttons and don't care about feedback, the generic OSC
module works fine, and WebLinked's own `docs/03-control-api.md` covers it.

## Setting it up

It defaults to `127.0.0.1:7654`. If WebLinked was started with `--bind 0.0.0.0`
it should have been started with `--token` as well; put that token in the
connection config. There's no TLS, so keep it on a show network you trust, or
behind a proxy.

## Multi-source

WebLinked can run several independent pipelines in one process. Every per-source
action and feedback has a **Source** selector that defaults to _Primary_, which
sends no `?source=` at all, the way WebLinked expects. So a config built against
a single-pipeline install keeps working as it is when someone adds a second
pipeline.

An unknown source id gets a 404 from WebLinked rather than silently doing nothing.

## Run JavaScript is the one that repays attention

If a graphic already defines its own functions, you can drive it from a button
without any integration work at all:

```
lowerThird.show('Anna Kowalski', 'Head of Sound')
setScore('home', 3)
document.querySelector('#lower-third').classList.add('in')
```

Two presets come with it as in/out examples.

## Reading the health feedbacks

| Feedback             | Means                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dropped ticks        | The clock fell more than a frame behind. Should be **0**.                                                                                              |
| Repeated frames      | **High is normal for a static graphic.** Rising on an animated one means the page is too slow — so the threshold is per-button.                        |
| Output running       | The device opened and is putting frames out. An output can be _enabled_ and dead: a card claimed by another application, or a format it will not take. |
| Output has receivers | Someone is actually watching. NDI/OMT only — SDI and screen outputs have no notion of a receiver.                                                      |
| Popup attempts       | The page tried to open a window. A page doing this repeatedly is usually about to behave oddly on air.                                                 |

## Status codes worth knowing

The one to watch is a 409 from Format: the format _did_ change, but an output
couldn't reopen at it. The module tells you so and points you at
`outputs[].error`, and "Diagnostics: log the current state" dumps that into
Companion's log without you having to leave the surface.

400 means a body or format that couldn't be parsed, and 404 means an unknown
output or source id.

## Tests

```bash
npm test
```

This runs the module's actual code against a pretend WebLinked on a real HTTP
server. It covers the `?source=` selector, token auth, the 409 and 400 paths, the
health feedbacks, and the generated per-output presets.

## Installing

It's not in the official Companion module store, so install it as a developer
module through **Settings → Developer modules path**.

<!-- attributions:start -->
This project is built on other people's work — see [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
<!-- attributions:end -->

## Licence

MIT, see [LICENSE](LICENSE).
