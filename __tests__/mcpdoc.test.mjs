// What the format must never get wrong.
//
// The whole value of an MCPDoc is one distinction: a claim the publisher made
// and a fact somebody read off the wire do not look the same. Everything here
// exists to keep that true.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBody, VERSIONS, open, tools } from "../src/read.mjs";
import { assemble, tally, MARKS } from "../src/doc.mjs";
import { render } from "../src/render.mjs";

const fake = (routes) => async (url, init) => {
  const body = JSON.parse(init.body);
  const r = routes[body.method];
  const out = typeof r === "function" ? r(body, init) : r;
  return {
    status: out.status ?? 200,
    headers: { get: (h) => (h === "mcp-session-id" ? out.session ?? null : null) },
    text: async () => JSON.stringify(out.body),
    json: async () => out.body,
  };
};

test("it asks for the newest version first", () => {
  assert.equal(VERSIONS[0], "2025-06-18");
  assert.ok(VERSIONS.indexOf("2024-11-05") > 0, "the oldest must not be tried first");
});

test("a server that agrees to an old version is recorded as agreeing, not as capped", async () => {
  // The bug this format was born from: a server said 2024-11-05 because that is
  // what we asked for, and we wrote it down as a fact about the server.
  const f = fake({
    initialize: (b) => ({
      session: "s1",
      body: { result: { protocolVersion: b.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "x" } } },
    }),
  });
  const s = await open("https://x.test/mcp", f);
  assert.equal(s.speaks, "2025-06-18", "it must report the highest it agreed to");
  assert.equal(s.asked, "2025-06-18");
});

test("it falls back when a server refuses a version", async () => {
  const f = fake({
    initialize: (b) =>
      b.params.protocolVersion === "2024-11-05"
        ? { session: "s", body: { result: { protocolVersion: "2024-11-05", capabilities: {} } } }
        : { status: 400, body: { error: { message: "unsupported" } } },
  });
  const s = await open("https://x.test/mcp", f);
  assert.equal(s.speaks, "2024-11-05");
});

test("both answer shapes parse: plain JSON and an SSE frame", () => {
  assert.equal(parseBody('{"a":1}').a, 1);
  assert.equal(parseBody('event: message\ndata: {"a":2}\n\n').a, 2);
  assert.equal(parseBody(""), null);
  assert.equal(parseBody("not json"), null);
});

test("a refusal is recorded as a fact, not dropped", async () => {
  const f = fake({ initialize: { status: 401, body: { error: { message: "needs a key" } } } });
  const s = await open("https://x.test/mcp", f);
  assert.equal(s.ok, false);
  const doc = assemble({ url: "https://x.test/mcp", session: s, by: "a test" });
  assert.equal(doc.facts.answers.mark, "seen");
  assert.equal(doc.facts.answers.value, false);
  assert.match(doc.facts.answers.note, /needs a key/);
});

test("every fact carries one of exactly three marks", () => {
  const doc = assemble({
    url: "https://x.test/mcp",
    session: { ok: true, speaks: "2025-06-18", implements: ["tools"], server: { name: "x" } },
    tools: { ok: true, tools: [{ name: "a", description: "d", takes: ["p"], required: [] }] },
    repository: { ok: true, description: "does a thing", archived: false, licence: "MIT", stars: 1, pushedAt: "2026-01-01T00:00:00Z" },
    repoName: "o/n",
    by: "a test",
  });
  for (const [k, f] of Object.entries(doc.facts)) {
    assert.ok(MARKS.includes(f.mark), `${k} has mark ${f.mark}`);
    assert.ok(f.from, `${k} does not say where it came from`);
  }
});

test("the publisher's description is said, never seen", () => {
  const doc = assemble({
    url: "https://x.test/mcp",
    repository: { ok: true, description: "their words", archived: false, licence: "MIT", stars: 0 },
    repoName: "o/n",
    by: "a test",
  });
  assert.equal(doc.facts.does.mark, "said");
  // and the things GitHub records about the repo are seen, because we read them
  assert.equal(doc.facts.archived.mark, "seen");
  assert.equal(doc.facts.licence.mark, "seen");
});

test("a document always says who produced it and when", () => {
  const doc = assemble({ url: "https://x.test/mcp", by: "somebody" });
  assert.equal(doc.produced.by, "somebody");
  assert.match(doc.produced.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(render(doc), /Who looked/);
  assert.match(render(doc), /somebody/);
});

test("the page shows nothing the artifact does not hold", () => {
  const doc = assemble({
    url: "https://x.test/mcp",
    session: { ok: true, speaks: "2025-06-18", implements: ["tools"], server: { name: "srv" } },
    tools: { ok: true, tools: [{ name: "only-tool", description: "d", takes: ["p"], required: [] }] },
    by: "a test",
  });
  const html = render(doc);
  assert.match(html, /only-tool/);
  assert.match(html, /2025-06-18/);
  assert.doesNotMatch(html, /undefined|\[object Object\]/);
});

test("what nobody said is listed, never left blank", () => {
  const doc = assemble({ url: "https://x.test/mcp", by: "a test" });
  assert.ok(doc.open.length >= 3);
  assert.match(render(doc), /Not stated/);
});

test("the tally counts what was checked against what was merely claimed", () => {
  const doc = assemble({
    url: "https://x.test/mcp",
    session: { ok: true, speaks: "2025-06-18", implements: [], server: null },
    repository: { ok: true, description: "d", archived: false, licence: null, stars: 2 },
    repoName: "o/n",
    by: "a test",
  });
  const t = tally(doc);
  assert.ok(t.seen > 0 && t.said > 0);
  assert.equal(t.said + t.seen + t.none, Object.keys(doc.facts).length);
});

test("html is escaped, so a server cannot write the page", () => {
  const doc = assemble({
    url: "https://x.test/mcp",
    session: { ok: true, speaks: "1", implements: [], server: { name: '<img src=x onerror="alert(1)">' } },
    by: "a test",
  });
  const html = render(doc);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});
