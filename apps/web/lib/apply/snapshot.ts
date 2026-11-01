/**
 * Reads agent-browser's accessibility snapshot (`agent-browser snapshot`, the full tree, not `-i`):
 * one line per node, indented two spaces per level, like
 *
 *   - group "Are you authorized to work in the EU?"
 *     - radio "Yes" [checked=false, ref=e5]
 *   - combobox "How did you hear about us?" [expanded=false, ref=e12]: Select…
 *     - option "Job board" [ref=e20]
 *
 * The full tree is needed: the interactive-only snapshot (`-i`) drops the group a radio button
 * belongs to, so "Yes" and "No" would arrive without their question.
 */

export interface FormControl {
  ref: string;
  role: string;
  name: string;
  required: boolean;
  checked: boolean | null;
  /** the text after ": " on the line (a combobox's current choice, a file button's file name) */
  value: string | null;
  /** the question of the nearest enclosing group or radiogroup */
  group: string | null;
  /** the closest text before the control under the same parent ("Resume/CV" before "Attach") */
  context: string | null;
  /** a combobox's or listbox's options, in order */
  options: { ref: string | null; name: string }[];
}

export interface SnapshotNode {
  depth: number;
  role: string;
  name: string;
  attrs: Record<string, string>;
  value: string | null;
  children: SnapshotNode[];
  parent: SnapshotNode | null;
}

const LINE = /^(\s*)- (\S+)(?: "((?:[^"\\]|\\.)*)")?(?: \[([^\]]*)\])?(?:: (.*))?$/;

const unescape = (s: string) => s.replace(/\\(.)/g, "$1");

function attrsOf(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = v.length ? v.join("=") : "true";
  }
  return out;
}

/** The snapshot as a tree. Lines that are not nodes (headers, boundary markers) are skipped. */
export function parseTree(text: string): SnapshotNode[] {
  const roots: SnapshotNode[] = [];
  const stack: SnapshotNode[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(LINE);
    if (!m) continue;
    const node: SnapshotNode = {
      depth: Math.floor(m[1].length / 2),
      role: m[2],
      name: unescape(m[3] ?? "").trim(),
      attrs: attrsOf(m[4]),
      value: m[5]?.trim() || null,
      children: [],
      parent: null,
    };
    while (stack.length && stack[stack.length - 1].depth >= node.depth) stack.pop();
    const parent = stack[stack.length - 1] ?? null;
    node.parent = parent;
    (parent ? parent.children : roots).push(node);
    stack.push(node);
  }
  return roots;
}

const CONTROL_ROLES = new Set(["textbox", "searchbox", "spinbutton", "combobox", "listbox", "checkbox", "switch", "radio", "button"]);
const GROUP_ROLES = new Set(["group", "radiogroup"]);

function textOf(node: SnapshotNode): string {
  if (node.role === "StaticText" || node.role === "text") return node.name;
  return node.children.map(textOf).filter(Boolean).join(" ");
}

/** The text nodes right before `node` among its siblings, nearest first (labels sit there). */
function contextOf(node: SnapshotNode): string | null {
  const siblings = node.parent?.children ?? [];
  for (let i = siblings.indexOf(node) - 1; i >= 0; i--) {
    const s = siblings[i];
    if (s.attrs.ref) break; // another control: its label isn't ours
    const t = textOf(s).trim();
    if (t) return t;
  }
  return null;
}

/** A select's options sit under a popup node ("MenuListPopup"), not right under the combobox. */
function optionsOf(node: SnapshotNode): { ref: string | null; name: string }[] {
  const out: { ref: string | null; name: string }[] = [];
  const walk = (n: SnapshotNode) => {
    for (const c of n.children) {
      if (c.role === "option") out.push({ ref: c.attrs.ref ?? null, name: c.name });
      else walk(c);
    }
  };
  walk(node);
  return out;
}

// A <select required> is not marked required in the tree: the label's mark is what says it.
const REQUIRED_MARK = /\*|✱|✳|\((required|obligatoriu|обязательно)\)/iu;

/** Every control that has a ref, with the group and the text that give it meaning. */
export function controlsOf(text: string): FormControl[] {
  const out: FormControl[] = [];
  const walk = (node: SnapshotNode) => {
    if (node.attrs.ref && CONTROL_ROLES.has(node.role)) {
      let g = node.parent;
      while (g && !GROUP_ROLES.has(g.role)) g = g.parent;
      out.push({
        ref: node.attrs.ref,
        role: node.role,
        name: node.name,
        // a radio's "*" is on its question
        required: node.attrs.required === "true" || REQUIRED_MARK.test(node.name) || (node.role === "radio" && REQUIRED_MARK.test(g?.name ?? "")),
        checked: node.attrs.checked === undefined ? null : node.attrs.checked === "true",
        value: node.value,
        group: g?.name || null,
        context: contextOf(node),
        options: optionsOf(node),
      });
    }
    node.children.forEach(walk);
  };
  parseTree(text).forEach(walk);
  return out;
}
