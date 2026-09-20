# MCPDoc

A document about one MCP server, **assembled from what anybody observed** rather
than written by the server's publisher.

Every fact on an MCPDoc carries one of three marks:

| mark | means |
|---|---|
| `said` | the publisher's own claim, unchecked |
| `seen` | somebody connected and read it off the wire, on a date |
| `not published` | the publisher did not say |

That distinction is the whole point. A README is the publisher talking about
themselves, and it is right the day it is written. An MCPDoc says which parts
anybody has since confirmed, and when.

## Why

A published tool list drifts. The first server we checked proved it: a
directory listed `navigate` as taking `{ url: string }`, and the running
server said it takes `url` **and** `sessionId`. Every one of its six tools took
a `sessionId` the published table left out.

Asking the server takes two calls and, for that server, no credential.

## Generate one

```bash
npx mcpdoc https://mcp.example.com/mcp            # a hosted server
npx mcpdoc https://mcp.example.com/mcp --repo owner/name   # ...and its repository
```

It writes `mcpdoc.json` (the artifact) and `mcpdoc.html` (a rendering of it).

## What it reads, and what it never does

It opens an MCP session, asks `tools/list`, and reads the repository's public
metadata if you name one. That is all.

It never runs the server's code, never installs anything, never sends a tool
call, and never writes anything anywhere but your own directory.

## Versions are negotiated, so ask high

The protocol version a server reports is the one **you asked for**. Ask for an
old version and it will politely agree, and you will record a wrong answer. The
generator asks for the newest version it knows and records what came back, which
is the highest the server would agree to.

## Status

The format will change as more servers get checked. Everything in
`mcpdoc.json` is either a fact with a source and a date, or absent.
