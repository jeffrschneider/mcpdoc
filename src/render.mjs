/**
 * The page: a rendering of mcpdoc.json, and nothing that is not in it.
 *
 * If a fact is on the page it is in the artifact, with the same mark and the
 * same source. The page is allowed to arrange and to name things in plainer
 * words; it is not allowed to know anything the JSON does not.
 */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const MK = {
  said: '<span class="mk mk-said">said</span>',
  seen: '<span class="mk mk-seen">seen</span>',
  none: '<span class="mk mk-none">not published</span>',
};

const CSS = `
:root{--ink:#0b1116;--panel:#121b21;--raised:#16222a;--sunk:#0a1015;--line:#1e2d36;--edge:#2a3d48;
--paper:#e9f0ee;--dim:#9db0ab;--faint:#6f8a84;--seen:#4fd6a9;--said:#8aa3b8;--gap:#c9973f;--warn:#f2a93b;
--mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
--sans:"IBM Plex Sans",system-ui,-apple-system,Segoe UI,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--ink);color:var(--paper);font-family:var(--sans);font-size:16px;line-height:1.6;
-webkit-font-smoothing:antialiased}
.frame{max-width:860px;margin:0 auto;padding:38px 28px 96px}
.kind{font:600 .64rem/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--seen);margin:0 0 14px}
h1{font-size:2.05rem;font-weight:600;letter-spacing:-.022em;margin:0 0 8px;text-wrap:balance}
.src{font:.8rem/1.5 var(--mono);color:var(--faint);margin:0 0 14px;word-break:break-all}
.lede{font-size:1.1rem;color:var(--dim);margin:0 0 22px;max-width:60ch}
.strip{display:flex;flex-wrap:wrap;border:1px solid var(--line);border-radius:12px;background:var(--panel);
overflow:hidden;margin:0 0 14px}
.strip div{flex:1 1 130px;padding:13px 16px;border-right:1px solid var(--line)}
.strip div:last-child{border-right:0}
.strip .k{display:block;font:600 .62rem/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;
color:var(--faint);margin:0 0 6px}
.strip .v{font-size:.98rem;font-weight:500}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:.82rem;color:var(--faint);margin:0 0 30px}
.legend span{display:inline-flex;align-items:center;gap:7px}
.mk{font:600 .6rem/1.7 var(--mono);letter-spacing:.1em;text-transform:uppercase;padding:0 6px;
border-radius:999px;border:1px solid currentColor;white-space:nowrap;flex:none}
.mk-seen{color:var(--seen)}.mk-said{color:var(--said)}.mk-none{color:var(--gap)}
section{border:1px solid var(--line);border-radius:14px;background:var(--panel);margin:0 0 18px;overflow:hidden}
section>header{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;padding:16px 22px;
border-bottom:1px solid var(--line);background:var(--raised)}
section>header h2{font-size:1.02rem;font-weight:600;margin:0;letter-spacing:-.01em}
section>header .from{font:.76rem/1.4 var(--mono);color:var(--faint);margin-left:auto;text-align:right}
.inner{padding:6px 22px 20px}
.f{display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px 20px;padding:15px 0;
border-bottom:1px solid var(--line);align-items:baseline}
.f:last-child{border-bottom:0}
.f>dt{font:500 .82rem/1.5 var(--mono);color:var(--faint)}
.f>dd{margin:0;min-width:0}
.f .val{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;font-size:1rem}
.f .note{display:block;margin-top:5px;font-size:.85rem;color:var(--faint);max-width:62ch}
.f .none{color:var(--gap)}
dl{margin:0}
table.tools{width:100%;border-collapse:collapse;margin:4px 0 0}
table.tools th{text-align:left;font:600 .62rem/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;
color:var(--faint);padding:0 14px 11px 0;border-bottom:1px solid var(--line)}
table.tools td{padding:13px 14px 13px 0;border-bottom:1px solid var(--line);vertical-align:top}
table.tools tr:last-child td{border-bottom:0}
table.tools .nm{font:600 .92rem var(--mono);color:var(--seen);white-space:nowrap}
table.tools .in{font:.82rem var(--mono);color:var(--dim)}
.prose{font-size:.95rem;color:var(--dim);max-width:66ch}
.prose p{margin:16px 0 0}
.notice{display:flex;gap:12px;border:1px solid var(--warn);border-left-width:3px;border-radius:10px;
background:rgba(242,169,59,.07);padding:13px 16px;margin:16px 0 4px;font-size:.95rem}
.notice b{color:var(--paper)}
.open li{margin:0 0 7px;color:var(--gap)}
.open{margin:12px 0 0;padding-left:20px}
code{font:.86em var(--mono);background:var(--sunk);border:1px solid var(--line);border-radius:4px;
padding:1px 5px;color:var(--paper)}
@media(max-width:700px){.frame{padding:26px 18px 70px}h1{font-size:1.6rem}
.f{grid-template-columns:1fr;gap:4px}.inner{padding:4px 16px 16px}section>header{padding:14px 16px}
section>header .from{margin-left:0;flex-basis:100%;text-align:left}}
`;

const fRow = (label, f) => {
  if (!f) return "";
  const v = f.value === null || f.value === undefined || f.value === ""
    ? '<span class="none">&mdash;</span>'
    : Array.isArray(f.value)
      ? esc(f.value.join(", ")) || '<span class="none">&mdash;</span>'
      : typeof f.value === "boolean"
        ? `<b>${f.value ? "yes" : "no"}</b>`
        : esc(f.value);
  return `<div class="f"><dt>${esc(label)}</dt><dd><span class="val"><span>${v}</span>${MK[f.mark] ?? ""}</span>` +
    `${f.note ? `<span class="note">${esc(f.note)}</span>` : ""}` +
    `${f.from ? `<span class="note">${esc(f.from)}</span>` : ""}</dd></div>`;
};

const section = (title, from, body) =>
  `<section><header><h2>${esc(title)}</h2><span class="from">${esc(from)}</span></header>` +
  `<div class="inner">${body}</div></section>\n`;

export function render(doc) {
  const F = doc.facts ?? {};
  const at = (doc.produced?.at ?? "").slice(0, 10);

  const archivedNotice = F.archived?.value === true
    ? '<div class="notice"><span>&#9888;</span><span><b>The repository is archived.</b> ' +
      `Its owner marked it no longer maintained${F.lastPushed ? `, and the last change was pushed on ${esc(F.lastPushed.value)}` : ""}.` +
      `${F.answers?.value === true ? " The server still answers." : ""}</span></div>`
    : "";

  const about = section("What it does", "the publisher, and the repository",
    archivedNotice + "<dl>" + fRow("does", F.does) + fRow("archived", F.archived) +
    fRow("licence", F.licence) + fRow("stars", F.stars) + "</dl>");

  const toolBody = doc.tools?.length
    ? '<table class="tools"><thead><tr><th>tool</th><th>what it does</th><th>takes</th></tr></thead><tbody>' +
      doc.tools.map((t) =>
        `<tr><td class="nm">${esc(t.name)}</td><td>${esc(t.description ?? "")}</td>` +
        `<td class="in">${esc((t.takes ?? []).join(", "))}</td></tr>`).join("") +
      "</tbody></table>" +
      `<div class="prose"><p>These ${doc.tools.length} came from the server itself, by opening a session and asking it.</p></div>`
    : '<div class="prose"><p><b>No tool list.</b> An MCP server says what it offers by answering ' +
      "<code>tools/list</code>, which means connecting to it. Nothing here got an answer.</p></div>";

  const connection = section("Connecting to it", `one read, ${at}`,
    "<dl>" + fRow("endpoint", { value: doc.subject?.endpoint, mark: "seen", from: "" }) +
    fRow("answers", F.answers) + fRow("speaks", F.speaks) + fRow("implements", F.implements) +
    fRow("identifies as", F.identifiesAs) + "</dl>");

  const openList = (doc.open ?? []).length
    ? section("Not stated", `${doc.open.length} questions this leaves open`,
        '<ul class="open">' + doc.open.map((o) => `<li>${esc(o)}</li>`).join("") + "</ul>")
    : "";

  const who = section("Who looked", `${esc(doc.produced?.by ?? "unnamed")}, ${at}`,
    '<div class="prose"><p>Anyone can produce one of these; it takes two calls and no credential. ' +
    "So what it is worth depends entirely on who did the looking, and that is why this section exists. " +
    `Everything marked <b>seen</b> above was read by <b>${esc(doc.produced?.by ?? "somebody unnamed")}</b> on ${esc(at)}. ` +
    "Everything marked <b>said</b> is the publisher's own claim and was not checked by anybody.</p></div>");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(F.identifiesAs?.value ?? doc.subject?.repository ?? doc.subject?.endpoint ?? "MCP server")} &mdash; MCPDoc</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style></head>
<body><div class="frame">
<p class="kind">MCPDoc</p>
<h1>${esc(doc.subject?.repository ?? F.identifiesAs?.value ?? "An MCP server")}</h1>
<p class="src">${esc(doc.subject?.endpoint ?? "")}</p>
${F.does?.value ? `<p class="lede">${esc(F.does.value)}</p>` : ""}
<div class="strip">
  <div><span class="k">tools</span><span class="v">${doc.tools?.length ?? "&mdash;"}</span></div>
  <div><span class="k">speaks</span><span class="v">${esc(F.speaks?.value ?? "—")}</span></div>
  <div><span class="k">licence</span><span class="v">${esc(F.licence?.value ?? "not stated")}</span></div>
  <div><span class="k">upkeep</span><span class="v">${F.archived?.value === true ? "archived" : F.archived ? "active" : "—"}</span></div>
</div>
<p class="legend"><span>${MK.said} the publisher&#39;s word</span><span>${MK.seen} read from the server</span><span>${MK.none} not published</span></p>
${about}${section("Its tools", doc.tools?.length ? `asked the running server on ${at}` : "nothing on record", toolBody)}${connection}${openList}${who}
</div></body></html>`;
}
