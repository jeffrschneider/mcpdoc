/**
 * The artifact: one JSON document about one MCP server.
 *
 * Every entry is a value, a mark saying whose claim it is, and where it came
 * from. The page is a rendering of this; this is the thing that travels.
 *
 * THREE MARKS, AND ONLY THREE.
 *   said  - the publisher's own claim, nobody checked it
 *   seen  - somebody connected and read it off the wire, on a date
 *   none  - the publisher did not say
 *
 * A model must never produce `seen`. Anything inferred from prose is a claim
 * about a claim, and if that is ever allowed to wear the same word, the one
 * distinction this format exists to carry is gone.
 */

export const MARKS = ["said", "seen", "none"];

/** One fact. `from` is where it came from, in words a reader can check. */
export const fact = (value, mark, from, note) => ({
  value: value ?? null,
  mark,
  from,
  ...(note ? { note } : {}),
});

/**
 * Assemble the document.
 *
 * `by` is who did the looking, and it is not optional. Anyone can generate one
 * of these, which is the point, and that is exactly why a document that does
 * not say who produced it is worthless: a publisher's own MCPDoc and an
 * independent one would be indistinguishable.
 */
export function assemble({ url, session, tools, repository, repoName, by, at }) {
  const when = at ?? new Date().toISOString();
  const doc = {
    mcpdoc: "0.1.0",
    subject: { endpoint: url ?? null, ...(repoName ? { repository: repoName } : {}) },
    produced: { by, at: when },
    facts: {},
    tools: null,
    open: [],
  };
  const F = doc.facts;
  const seen = `read from the server on ${when.slice(0, 10)}`;

  if (session?.ok) {
    F.answers = fact(true, "seen", seen);
    F.speaks = fact(session.speaks, "seen", seen,
      "the highest version it would agree to; a version is whatever the client asked for");
    F.implements = fact(session.implements, "seen", seen, "the parts of the protocol it declares");
    if (session.server?.name) {
      F.identifiesAs = fact(session.server.name, "seen", seen, "the name the server gives for itself");
    }
    if (session.server?.version) F.serverVersion = fact(session.server.version, "seen", seen);
  } else if (session) {
    // A refusal is a fact. It answered, and it wants something.
    F.answers = fact(false, "seen", seen, session.why);
  }

  if (tools?.ok) {
    doc.tools = tools.tools;
    F.toolCount = fact(tools.tools.length, "seen", seen, "asked the server, not read from a document");
  } else if (tools) {
    doc.open.push("what tools it offers");
    F.toolCount = fact(null, "none", seen, tools.why);
  }

  if (repository?.ok) {
    const rseen = `read from GitHub on ${when.slice(0, 10)}`;
    if (repository.description) F.does = fact(repository.description, "said", "the repository's own description");
    F.archived = fact(repository.archived, "seen", rseen,
      repository.archived ? "its owner marked it no longer maintained" : undefined);
    F.licence = repository.licence
      ? fact(repository.licence, "seen", rseen)
      : fact(null, "none", rseen, "nothing says what you may do with it");
    F.stars = fact(repository.stars, "seen", rseen, "a measure of attention, not of whether it works");
    if (repository.pushedAt) F.lastPushed = fact(repository.pushedAt.slice(0, 10), "seen", rseen);
  }

  // What nobody has said. Listed rather than left blank, because a gap a
  // reader cannot see is a gap they will assume is filled.
  if (!F.does) doc.open.push("what it is for, in the publisher's own words");
  if (!F.licence || F.licence.mark === "none") doc.open.push("under what licence");
  doc.open.push("whether its tools do what they say");
  doc.open.push("what credential it needs to be useful");
  doc.open.push("how to ask it things, in a person's own words");

  return doc;
}

/** Every mark used, for a reader deciding how much of this was checked. */
export const tally = (doc) => {
  const out = { said: 0, seen: 0, none: 0 };
  for (const f of Object.values(doc.facts ?? {})) {
    if (f && MARKS.includes(f.mark)) out[f.mark]++;
  }
  return out;
};
