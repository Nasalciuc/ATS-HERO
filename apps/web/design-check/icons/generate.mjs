#!/usr/bin/env node
// Generates components/figma-icons.tsx and design-check/ICON-SOURCES.md from icons/manifest.json.
//
// The icon sets are NOT dependencies of the app (some are large). Install the ones the manifest
// names next to this run, without saving them:
//
//   npm i --no-save @iconify-json/ep @iconify-json/famicons @iconify-json/ic \
//     @iconify-json/material-symbols @iconify-json/mynaui @iconify-json/streamline-plump @iconify-json/typcn
//   node design-check/icons/generate.mjs
//
// (or point ICONIFY_SETS at a node_modules folder that has them). SVG bodies are emitted as JSX —
// no dangerouslySetInnerHTML — so the CSP and the XSS rules stay untouched.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/design-check/icons
const WEB = path.resolve(HERE, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "manifest.json"), "utf8"));
const require = createRequire(path.join(process.env.ICONIFY_SETS ?? WEB, "noop.js"));

const sets = new Map();
function loadSet(prefix) {
  if (!sets.has(prefix)) {
    let file;
    try {
      file = process.env.ICONIFY_SETS
        ? path.join(process.env.ICONIFY_SETS, "@iconify-json", prefix, "icons.json")
        : require.resolve(`@iconify-json/${prefix}/icons.json`);
    } catch {
      throw new Error(`@iconify-json/${prefix} is not installed — see the header of ${path.relative(WEB, fileURLToPath(import.meta.url))}`);
    }
    const dir = path.dirname(file);
    sets.set(prefix, {
      icons: JSON.parse(fs.readFileSync(file, "utf8")),
      info: JSON.parse(fs.readFileSync(path.join(dir, "info.json"), "utf8")),
      version: JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version,
    });
  }
  return sets.get(prefix);
}

function lookup(fullName) {
  const [prefix, name] = fullName.split(":");
  const set = loadSet(prefix);
  let icon = set.icons.icons[name];
  const alias = set.icons.aliases?.[name];
  if (!icon && alias) {
    if (Object.keys(alias).some((k) => k !== "parent")) throw new Error(`${fullName}: transformed aliases are not supported`);
    icon = set.icons.icons[alias.parent];
  }
  if (!icon) throw new Error(`${fullName} not found in @iconify-json/${prefix}`);
  const dim = (k, d) => icon[k] ?? set.icons[k] ?? d;
  return { body: icon.body, left: dim("left", 0), top: dim("top", 0), width: dim("width", 16), height: dim("height", 16), set };
}

// --- SVG body → JSX ---------------------------------------------------------------------------
const ATTR = {
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-width": "strokeWidth",
  "stroke-miterlimit": "strokeMiterlimit",
  "stroke-dasharray": "strokeDasharray",
  "stroke-dashoffset": "strokeDashoffset",
  "stroke-opacity": "strokeOpacity",
  "fill-rule": "fillRule",
  "fill-opacity": "fillOpacity",
  "clip-rule": "clipRule",
  "clip-path": "clipPath",
  "stop-color": "stopColor",
  "stop-opacity": "stopOpacity",
  "xlink:href": "xlinkHref",
};
const SAFE_TAGS = new Set(["g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "defs", "clipPath", "mask", "linearGradient", "radialGradient", "stop", "use"]);

function attrsToJsx(src, where) {
  const out = [];
  const re = /([\w:-]+)="([^"]*)"/g;
  let m;
  let rest = src;
  while ((m = re.exec(src))) {
    const [, name, value] = m;
    if (name === "style" || name.startsWith("on")) throw new Error(`${where}: attribute "${name}" is not allowed`);
    const jsx = ATTR[name] ?? name;
    if (/-/.test(jsx) && !jsx.startsWith("aria-") && !jsx.startsWith("data-")) throw new Error(`${where}: unmapped attribute "${name}"`);
    out.push(`${jsx}="${value}"`);
    rest = rest.replace(m[0], "");
  }
  if (rest.trim()) throw new Error(`${where}: could not parse attributes "${rest.trim()}"`);
  return out.join(" ");
}

function bodyToJsx(body, where, indent) {
  const lines = [];
  const re = /<(\/?)([\w:]+)([^>]*?)(\/?)>|([^<]+)/g;
  let depth = 0;
  let m;
  while ((m = re.exec(body))) {
    const [, closing, tag, attrs, selfClosing, text] = m;
    if (text !== undefined) {
      if (text.trim()) throw new Error(`${where}: unexpected text "${text.trim()}"`);
      continue;
    }
    if (!SAFE_TAGS.has(tag)) throw new Error(`${where}: element <${tag}> is not allowed`);
    const pad = " ".repeat(indent + 2 * depth);
    if (closing) {
      depth -= 1;
      lines.push(`${" ".repeat(indent + 2 * depth)}</${tag}>`);
    } else if (selfClosing) {
      lines.push(`${pad}<${tag} ${attrsToJsx(attrs, where)} />`);
    } else {
      lines.push(`${pad}<${tag} ${attrsToJsx(attrs, where)}>`);
      depth += 1;
    }
  }
  if (depth !== 0) throw new Error(`${where}: unbalanced SVG body`);
  return lines.join("\n");
}

// --- emit ---------------------------------------------------------------------------------------
const tsx = [
  "// GENERATED by design-check/icons/generate.mjs from design-check/icons/manifest.json — the exact",
  "// Iconify icons the Figma file uses (sources and licences: design-check/ICON-SOURCES.md).",
  "// Regenerate rather than hand-edit. No dangerouslySetInnerHTML: bodies are emitted as JSX.",
  'import type { SVGProps } from "react";',
  "",
  "type P = SVGProps<SVGSVGElement> & { size?: number };",
  "",
];
const rows = [];
for (const entry of manifest.icons) {
  const icon = lookup(entry.icon);
  const viewBox = `${icon.left} ${icon.top} ${icon.width} ${icon.height}`;
  tsx.push(
    `/** ${entry.icon} — ${entry.use} */`,
    `export function ${entry.export}({ size = ${entry.size}, ...p }: P) {`,
    "  return (",
    `    <svg width={size} height={size} viewBox="${viewBox}" aria-hidden="true" focusable="false" {...p}>`,
    bodyToJsx(icon.body, entry.icon, 6),
    "    </svg>",
    "  );",
    "}",
    "",
  );
  const { info, version } = icon.set;
  rows.push(
    `| \`${entry.icon}\` | \`${entry.export}\` | ${entry.use.replace(/\|/g, "\\|")} | [${info.license.title}](${info.license.url}) | [${info.author.name}](${info.author.url}) | ${version} |`,
  );
}
fs.writeFileSync(path.join(WEB, "components/figma-icons.tsx"), tsx.join("\n"));

const attribution = [...new Set(manifest.icons.map((e) => e.icon.split(":")[0]))]
  .map((prefix) => loadSet(prefix))
  .filter((s) => /^CC-BY/.test(s.info.license.spdx))
  .map((s) => `- **${s.info.name}** by ${s.info.author.name} (${s.info.author.url}) — ${s.info.license.title}, ${s.info.license.url}`);

fs.writeFileSync(
  path.join(WEB, "design-check/ICON-SOURCES.md"),
  [
    "# Icon sources",
    "",
    "Generated by `design-check/icons/generate.mjs` from `design-check/icons/manifest.json`. These are the icons the",
    "Figma file uses (its layers are named after the Iconify icon, e.g. `ep:arrow-up`), emitted as React components in",
    "`components/figma-icons.tsx`.",
    "",
    "| Iconify name | Component | Used for | Licence | Author | Set version |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    "## Attribution required",
    "",
    "CC BY / CC BY-SA icons need credit wherever the app lists third-party notices (e.g. a /credits or legal page):",
    "",
    ...(attribution.length ? attribution : ["- none"]),
    "",
  ].join("\n"),
);
console.log(`wrote components/figma-icons.tsx (${manifest.icons.length} icons) and design-check/ICON-SOURCES.md`);
