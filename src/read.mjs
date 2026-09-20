/**
 * Reading an MCP server, and nothing more.
 *
 * Two calls: `initialize`, then `tools/list`. No tool is ever called, nothing
 * is installed, and nothing is run. Asking a server what it offers is the
 * question the protocol exists to answer, and every client asks it on connect.
 */

/**
 * The protocol versions this knows about, newest first.
 *
 * ASK HIGH. The version in an `initialize` result is the one the CLIENT asked
 * for: a server will politely agree to an old version, so a generator that asks
 * for 2024-11-05 records 2024-11-05 for a server that speaks far newer. We
 * learned that by getting it wrong: the first MCPDoc said a server spoke
 * 2024-11-05 when it would happily agree to 2025-06-18, and the only reason was
 * the number in our own request.
 *
 * So the first entry is tried first, and the answer recorded is the highest the
 * server would agree to.
 */
export const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

/** Both shapes a streamable-HTTP server answers in: a bare JSON body, or an
 *  SSE frame with the JSON on a `data:` line. */
export function parseBody(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  for (const line of trimmed.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      return JSON.parse(line.slice(5).trim());
    } catch {
      /* a data line that is not the payload; keep looking */
    }
  }
  return null;
}

const HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

async function rpc(url, body, session, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: session ? { ...HEADERS, "mcp-session-id": session } : HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  return {
    status: res.status,
    session: res.headers.get("mcp-session-id") ?? null,
    payload: parseBody(await res.text()),
  };
}

/**
 * Open a session, highest version the server will agree to.
 *
 * Returns what the server said about itself, or a refusal in words. A refusal
 * is a fact worth recording, not a failure: "it answered and wants a
 * credential" tells a reader more than silence does.
 */
export async function open(url, fetchImpl = fetch) {
  let last = null;
  for (const version of VERSIONS) {
    const r = await rpc(url, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: version,
        capabilities: {},
        clientInfo: { name: "mcpdoc", version: "0.1.0" },
      },
    }, null, fetchImpl);
    last = r;
    const result = r.payload?.result;
    if (r.status === 200 && result) {
      return {
        ok: true,
        session: r.session,
        // What it AGREED to, which may be lower than what we asked for.
        speaks: result.protocolVersion ?? version,
        asked: version,
        // Which parts of the protocol it implements at all.
        implements: Object.keys(result.capabilities ?? {}).sort(),
        server: result.serverInfo ?? null,
      };
    }
    // A version it will not speak is worth one more try at an older one; any
    // other refusal is the answer.
    if (r.status !== 400 && r.status !== 406) break;
  }
  return {
    ok: false,
    status: last?.status ?? 0,
    why: last?.payload?.error?.message ?? `the server answered ${last?.status ?? "nothing"}`,
  };
}

/** What it offers, asked of the server itself. */
export async function tools(url, session, fetchImpl = fetch) {
  const r = await rpc(url, { jsonrpc: "2.0", id: 2, method: "tools/list" }, session, fetchImpl);
  const list = r.payload?.result?.tools;
  if (!Array.isArray(list)) {
    return { ok: false, why: r.payload?.error?.message ?? `the server answered ${r.status}` };
  }
  return {
    ok: true,
    tools: list.map((t) => ({
      name: t.name,
      description: t.description ?? null,
      // The argument NAMES, not the whole schema. A reader wants to know what
      // it takes; the schema itself belongs in the JSON artifact, not on a page.
      takes: Object.keys(t.inputSchema?.properties ?? {}),
      required: t.inputSchema?.required ?? [],
    })),
  };
}

/** The repository's public facts, when one is named. Nothing here is the
 *  publisher's claim about the server: it is GitHub's record of the repo. */
export async function repo(nameWithOwner, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${nameWithOwner}`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "mcpdoc/0.1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status !== 200) return { ok: false, why: `GitHub answered ${res.status}` };
    const d = await res.json();
    return {
      ok: true,
      description: d.description ?? null,
      archived: d.archived === true,
      licence: d.license?.spdx_id ?? null,
      stars: typeof d.stargazers_count === "number" ? d.stargazers_count : null,
      pushedAt: d.pushed_at ?? null,
      url: d.html_url ?? null,
    };
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : String(e) };
  }
}
