# WebLinked

Controls [WebLinked](https://github.com/stoatworks-labs/weblinked) over its HTTP
control API.

## Connection

`127.0.0.1:7654` by default. If WebLinked was started with `--bind 0.0.0.0` it
should also have `--token` — put that token in the config. No TLS: keep it on a
trusted show network.

This module polls; WebLinked has no push channel for state. Every feedback and
variable therefore lags reality by up to one poll interval.

### Finding an instance

WebLinked 0.8.0 and later advertise themselves over mDNS, so the config panel
offers a list to pick from instead of an address to type. Choosing one hides
the host and port fields, because they are then ignored.

"Manual" is always available, and is the answer whenever discovery comes up
empty. It comes up empty for four reasons worth knowing, in rough order of how
often they are the cause:

- **The instance is on the default loopback bind.** It refuses to advertise on
  purpose — nothing off its machine could reach the address it would publish —
  and says so in its log. Start it with `--bind 0.0.0.0`.
- **Companion is on another subnet.** mDNS does not cross a router.
- **Multicast is filtered**, which is common on managed venue networks.
- **The instance is older than 0.8.0**, or was started with `--no-mdns`.

None of these stop the module working; they only stop it filling the address
in for you.

## Source selector

WebLinked can run several pipelines in one process. Every per-source action and
feedback has a **Source** dropdown defaulting to _Primary_, which sends no
`?source=` at all — WebLinked's own convention. Leave it alone unless this rig
runs more than one pipeline.

## Run JavaScript

The highest-leverage action. A graphic that defines its own functions needs no
integration work:

```
lowerThird.show('Anna Kowalski', 'Head of Sound')
setScore('home', 3)
```

## Enabled vs running

- **Enabled** is the configured intent.
- **Running** means the device actually opened and is putting frames out.

An output can be enabled and not running — a DeckLink claimed by another
application, or a format the card will not take. The generated output presets
light on **running** for exactly that reason.

Disabling an output stops the device and **frees it for another application**.
That is the point of it, not a cosmetic toggle.

## Health

| Feedback        | Read it as                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dropped ticks   | Should be 0. Anything else means the clock fell behind.                                                                                          |
| Repeated frames | High is _normal_ for a static graphic. Rising on an animated one means the page is too slow — set the threshold for what this graphic should do. |
| Console errors  | The page is throwing. The graphic is probably wrong.                                                                                             |
| Popup attempts  | The page tried to open a window; it is usually about to misbehave.                                                                               |
| Audio underruns | A few at start-up are normal. A rising count is not.                                                                                             |

## 409 from Format

A 409 means the format **did** change but an output could not reopen at it. Hit
**Diagnostics: log the current state** and read `outputs[].error`.

## Background per output

Each output composites the page over either its own transparency (a keyed SDI
fill, or NDI with alpha) or a flat colour (for a switcher that only has a chroma
keyer). One browser paint serves both, so the same graphic can leave as a key
down one path and over green down another.

Changing it applies on the next tick **without restarting the output** — it will
not drop frames on air.

## Connection feedback

Every other feedback keeps evaluating against the last known state while
WebLinked is unreachable, so a brief blip does not blank an output page. Put
**WebLinked is connected** on any page carrying output colour.
