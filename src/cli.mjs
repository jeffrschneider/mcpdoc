#!/usr/bin/env node
/**
 * mcpdoc — assemble a document about an MCP server from what anyone observed.
 *
 *   mcpdoc https://mcp.example.com/mcp
 *   mcpdoc https://mcp.example.com/mcp --repo owner/name --by "Your Name"
 *
 * Writes mcpdoc.json, and mcpdoc.html unless --json-only.
 *
 * It opens a session, asks what tools there are, and reads a repository's
 * public metadata if you name one. It never calls a tool, never installs
 * anything, and never writes outside the directory you run it in.
 */

import { writeFileSync } from "node:fs";
import { open, tools as readTools, repo as readRepo } from "./read.mjs";
import { assemble } from "./doc.mjs";
import { render } from "./render.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const url = args.find((a) => a.startsWith("http"));
if (!url || has("help")) {
  console.log(`mcpdoc — a document about an MCP server, assembled from what anyone observed

  mcpdoc <url> [--repo owner/name] [--by "who looked"] [--out name] [--json-only]

  <url>        the server's endpoint, e.g. https://mcp.example.com/mcp
  --repo       a GitHub repository, for its licence, upkeep and description
  --by         who is doing the looking. Put your name on it: anyone can
               generate one of these, so a document that does not say who
               produced it says nothing about whether to believe it.
  --out        base filename (default: mcpdoc)
  --json-only  skip the page

It opens a session and asks what tools there are. It never calls a tool.`);
  process.exit(url ? 0 : 1);
}

const by = flag("by", "an unnamed reader");
const repoName = flag("repo");
const out = flag("out", "mcpdoc");

console.log(`opening a session with ${url}`);
const session = await open(url);
if (session.ok) {
  console.log(`  it speaks MCP ${session.speaks}, implements ${session.implements.join(", ") || "nothing it declares"}`);
} else {
  console.log(`  it did not open a session: ${session.why}`);
}

let tools = null;
if (session.ok) {
  tools = await readTools(url, session.session);
  console.log(tools.ok ? `  ${tools.tools.length} tools` : `  no tool list: ${tools.why}`);
}

let repository = null;
if (repoName) {
  repository = await readRepo(repoName);
  console.log(repository.ok
    ? `  repository: ${repository.archived ? "archived, " : ""}${repository.licence ?? "no licence stated"}`
    : `  repository not read: ${repository.why}`);
}

const doc = assemble({ url, session, tools, repository, repoName, by });
writeFileSync(`${out}.json`, JSON.stringify(doc, null, 2));
console.log(`wrote ${out}.json`);

if (!has("json-only")) {
  writeFileSync(`${out}.html`, render(doc));
  console.log(`wrote ${out}.html`);
}
