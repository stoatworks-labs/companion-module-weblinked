# Companion — WebLinked user guide

This module drives [WebLinked](https://github.com/stoatworks-labs/weblinked) over its HTTP control
API from a Stream Deck or any other Bitfocus Companion surface: graphics, outputs, formats, and
the health numbers that tell you whether a page is keeping up.

The [README](../README.md) covers installing the module. This guide is about building a surface
with it.

> **Before you rely on this:** **this module polls.** WebLinked has no push channel for state, so
> every feedback and variable can be up to one poll interval behind what's really happening.
> Don't treat any of it as instant.
>
> This module was built with AI assistance, directed and reviewed by a human author.

---

## Connecting

`127.0.0.1:7654` by default. If WebLinked was started with `--bind 0.0.0.0` it should have been
started with `--token` as well, so put that token in the config. **There's no TLS**, so keep it on
a show network you trust.

### Finding an instance

WebLinked 0.8.0 and later advertise themselves over mDNS, so the config panel gives you a **list
to pick from** instead of an address to type. Pick one and the host and port fields disappear,
because they're ignored from then on.

**"Manual" is always there**, and it's the answer whenever discovery comes up empty. That happens
for four reasons, roughly in order of how often each one's to blame:

- **The instance is on the default loopback bind.** It won't advertise on purpose (nothing off its
  machine could reach the address it would publish) and says so in its log. Start it with
  `--bind 0.0.0.0`.
- **Companion is on another subnet.** mDNS doesn't cross a router.
- **Multicast is filtered**, which is common on managed venue networks.
- **The instance is older than 0.8.0**, or was started with `--no-mdns`.

None of these stop the module working. They only stop it filling the address in for you.

---

## Run JavaScript is the high-leverage action

If a graphic defines its own functions, you can drive it with no integration work at all:

```
lowerThird.show('Anna Kowalski', 'Head of Sound')
setScore('home', 3)
```

That's the action to build a show around. Anything the page can do, a button can do, and nobody
has to write a protocol for it first.

---

## Enabled is not running

- **Enabled** is what you've asked for.
- **Running** means the device actually opened and is putting frames out.

**An output can be enabled and not running**: a DeckLink claimed by another application, say, or
a format the card won't take. That's why the generated output presets light on **running**, and
you should keep them that way.

**Disabling an output stops the device and frees it for another application.** It's how you hand
a card to something else without quitting WebLinked.

---

## The health numbers, and how to read each one

| Feedback | Read it as |
| --- | --- |
| **Dropped ticks** | Should be **0**. Anything else means the clock fell behind. |
| **Repeated frames** | High is **normal** for a static graphic. Rising on an animated one means the page is too slow — set the threshold for what *this* graphic should be doing. |
| **Console errors** | The page is throwing. The graphic is probably wrong. |
| **Popup attempts** | The page tried to open a window; it is usually about to misbehave. |
| **Audio underruns** | A few at start-up are normal. A **rising** count is not. |

Repeated frames is the one that catches people out. The same number means "fine" on a static
lower third and "this page can't keep up" on an animation, so the threshold is per graphic.

---

## Background is per output

Each output puts the page over either **its own transparency** (a keyed SDI fill, or NDI with
alpha) or **a flat colour**, for a switcher that's only got a chroma keyer.

**One browser paint serves both**, so the same graphic can go out as a key down one path and over
green down another, without rendering it twice.

A change takes effect on the next tick **without restarting the output**, so it won't drop frames
on air.

---

## The source selector

WebLinked can run several pipelines in one process. Every per-source action and feedback has a
**Source** dropdown that defaults to *Primary*, which sends no source parameter at all, the way
WebLinked expects.

Leave it alone unless the rig runs more than one pipeline.

---

## When Format returns 409

**A 409 means the format did change, but an output couldn't reopen at it.**

Fire **Diagnostics: log the current state** and read `outputs[].error`. That's the only place the
actual reason shows up.

---

## Building a surface that fails safe

1. **WebLinked is connected** on any page that shows output colour. While WebLinked can't be
   reached, every other feedback keeps working from the *last known* state, so a brief blip
   doesn't blank the page, but it also means a stale green looks the same as a live one.
2. **Output tiles that light on running**, not enabled.
3. **Dropped ticks somewhere you can see it.** It should be zero, so any colour at all is worth
   noticing.
4. **Repeated-frames thresholds set per graphic**, not globally.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| **Discovery list is empty** | One of the four reasons above. Use Manual; the module still works. |
| **Output shows enabled but nothing is on air** | Enabled is intent; check running. The device may be claimed elsewhere. |
| **Format action returned 409** | The format changed but an output could not reopen. Log the state and read `outputs[].error`. |
| **Repeated frames alarming on a static graphic** | Normal. Set the threshold for what this graphic does. |
| **Everything on the page is stale** | The module polls. Also check *WebLinked is connected*. |
| **Run JavaScript does nothing** | The function does not exist on the page, or the page is throwing — check the console-errors feedback. |

---

## See also

- [README](../README.md): installing, and the full list of actions, feedbacks and variables
- [`companion/HELP.md`](../companion/HELP.md): the same material, in Companion's help panel
