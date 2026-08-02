// WebLinked speaks both HTTP and OSC, with the same verbs. This module uses
// HTTP exclusively, for one reason: **OSC has no feedback path.** WebLinked
// never sends OSC back, so an OSC-driven module could act but never light a
// button or fill a variable. /api/state carries everything — including the
// pacing and receiver numbers that are the whole point of putting WebLinked on
// a surface rather than in a browser tab.
//
// Authentication: the HTTP server binds 127.0.0.1 with none by default. Bound
// to an interface it wants --token, and then every request must carry it. The
// token goes in the Authorization header rather than the query string, because
// a URL with a secret in it ends up in logs.

/** Every per-source verb takes an optional `?source=<id>` selector. Leaving it
 *  off addresses the PRIMARY source, which is what keeps a single-source
 *  install working with no configuration at all — so an empty selector here
 *  must produce no query parameter rather than `?source=`. An unknown id is a
 *  404 from WebLinked, deliberately: naming the wrong feed and being told is
 *  cheaper than naming the wrong feed and changing it. */
function withSource(path, source) {
  const id = String(source ?? "").trim();
  if (!id) return path;
  return `${path}${path.includes("?") ? "&" : "?"}source=${encodeURIComponent(id)}`;
}

function headers(self, json) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  const token = String(self.config?.token ?? "").trim();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function base(self) {
  return `http://${self.config.host}:${self.config.port}`;
}

export async function getJson(self, path, source) {
  const res = await fetch(`${base(self)}${withSource(path, source)}`, {
    headers: headers(self, false),
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401
        ? "HTTP 401 — WebLinked is running with --token; set it in the connection config."
        : `GET ${path} failed: HTTP ${res.status}`,
    );
  }
  return res.json();
}

/**
 * POST a command.
 *
 * WebLinked's status codes carry real meaning and are worth preserving in the
 * message: 400 is a body or a format it could not parse, 404 an unknown output
 * or source id, and **409 means the request was valid but the device refused**
 * — a card that will not open at that format, most often. A 409 from
 * /api/format is the sharp one: the format DID change, but an output could not
 * reopen at it, so the operator needs to go and look at outputs[].error rather
 * than assume nothing happened.
 */
export async function post(self, path, body = {}, source) {
  const res = await fetch(`${base(self)}${withSource(path, source)}`, {
    method: "POST",
    headers: headers(self, true),
    body: JSON.stringify(body),
  });
  const parsed = await res.json().catch(() => ({}));
  if (!res.ok || parsed.error) {
    const detail = parsed.error ? `: ${parsed.error}` : "";
    if (res.status === 409) {
      throw new Error(
        `HTTP 409 — the request was valid but a device refused it${detail}. Check outputs[].error in the state.`,
      );
    }
    throw new Error(`POST ${path} failed: HTTP ${res.status}${detail}`);
  }
  return parsed;
}

/** The whole multi-source picture: `{primary, sources:[ ...state... ]}` where
 *  each entry is the same shape /api/state returns for one. Reading this rather
 *  than /api/state means a single request covers however many pipelines the
 *  process is running, and a single-source install just yields one entry. */
export async function fetchSources(self) {
  return getJson(self, "/api/sources");
}
