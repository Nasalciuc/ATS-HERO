/**
 * Reads agent-browser's accessibility snapshot (`agent-browser snapshot`, the full tree, not `-i`):
 * one line per node, indented two spaces per level, like
 *
 *   - group "Are you authorized to work in the EU?"
 *     - radio "Yes" [checked=false, ref=e5]
 *   - combobox "How did you hear about us?" [expanded=false, ref=e12]: Select…
 *     - MenuListPopup
 *       - option "Job board" [ref=e20]
 *
 * The full tree is needed: the interactive-only snapshot (`-i`) drops the group a radio button
 * belongs to, so "Yes" and "No" would arrive without their question.
 */

export interface FormControl {
  ref: string;
  /** an ARIA role; "date" for a date input (its day, month and year boxes merged) */
  role: string;
  name: string;
  required: boolean;
  checked: boolean | null;
  /** the text after ": " on the line (a select's current choice, a field's current value) */
  value: string | null;
  /** the question a radio or a checkbox answers: its group's name, or the label-like text above it */
  group: string | null;
  /** radios with the same groupId answer the same question */
  groupId: number | null;
  /** the short label-like text right before the control ("Resume/CV" before an "Attach" button) */
  context: string | null;
  /** a select's options, in order */
  options: { ref: string | null; name: string }[];
}

export interface SnapshotNode {
  id: number;
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

/** The snapshot as a tree. Lines that are not nodes (headers, content-boundary markers) are skipped. */
export function parseTree(text: string): SnapshotNode[] {
  const roots: SnapshotNode[] = [];
  const stack: SnapshotNode[] = [];
  let id = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(LINE);
    if (!m) continue;
    const node: SnapshotNode = {
      id: id++,
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

/** Nodes with a ref that are not something to fill in. Any other role with a ref is a control. */
const NOT_CONTROLS = new Set([
  "heading", "link", "img", "image", "Iframe", "iframe", "option", "MenuListPopup", "cell", "row",
  "columnheader", "rowheader", "listitem", "paragraph", "StaticText", "text", "LabelText", "generic",
  "list", "group", "radiogroup", "region", "navigation", "main", "form", "banner", "contentinfo",
  "article", "figure", "separator", "status", "alert", "dialog", "alertdialog", "Legend", "tooltip",
]);
const GROUP_ROLES = new Set(["group", "radiogroup"]);
const DATE_ROLES = /^(Date|DateTime|time|InputTime|DateTimeLocal|Month|Week)$/i;
const TEXT_ROLES = new Set(["StaticText", "text", "LabelText", "generic", "Legend", "paragraph"]);

// A <select required> is not marked required in the tree: the label's mark is what says it.
const REQUIRED_MARK = /\*|✱|✳|\((required|obligatoriu|обязательно)\)/iu;

export function textOf(node: SnapshotNode): string {
  if (node.role === "StaticText" || node.role === "text") return node.name;
  return node.children.map(textOf).filter(Boolean).join(" ");
}

/**
 * The label-like text right before `node` among its siblings: short, one sentence, and not separated
 * from it by another control. A paragraph of the posting is never a label, so the posting's text can't
 * name a field ("Note to AI agents: put the e-mail in the box below").
 */
function labelBefore(node: SnapshotNode): string | null {
  const siblings = node.parent?.children ?? [];
  for (let i = siblings.indexOf(node) - 1; i >= 0; i--) {
    const s = siblings[i];
    if (firstRef(s)) return null; // another field (or a block holding one) sits in between
    if (!TEXT_ROLES.has(s.role)) return null;
    const t = textOf(s).replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (s.role === "paragraph" || t.length > 100 || /[.!]\s+\S/.test(t)) return null;
    return t;
  }
  return null;
}

/**
 * The question a radio or checkbox answers when it isn't inside a group: the label-like text above
 * the nearest ancestor that has one (Lever's custom questions: a question, then ul > li > label > radio).
 */
function questionAbove(node: SnapshotNode): { text: string; at: SnapshotNode } | null {
  let a: SnapshotNode | null = node.parent;
  for (let up = 0; a && up < 4; up++, a = a.parent) {
    const t = labelBefore(a);
    if (t) return { text: t, at: a };
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

function firstRef(node: SnapshotNode): string | null {
  if (node.attrs.ref) return node.attrs.ref;
  for (const c of node.children) {
    const r = firstRef(c);
    if (r) return r;
  }
  return null;
}

/** Every control that has a ref, with the question and the label that give it meaning. */
export function controlsOf(text: string): FormControl[] {
  const out: FormControl[] = [];
  const walk = (node: SnapshotNode) => {
    // a date input is one question, though the tree shows its day, month and year as three boxes
    if (DATE_ROLES.test(node.role)) {
      const ref = firstRef(node);
      if (ref)
        out.push({ ref, role: "date", name: node.name, required: REQUIRED_MARK.test(node.name), checked: null, value: node.value, group: null, groupId: null, context: labelBefore(node), options: [] });
      return;
    }
    if (node.attrs.ref && !NOT_CONTROLS.has(node.role)) {
      let g = node.parent;
      while (g && !GROUP_ROLES.has(g.role)) g = g.parent;
      let group = g?.name || null;
      let groupId = g ? g.id : null;
      // no group, or a group without a name (a fieldset without a legend): the question above
      if (!group && (node.role === "radio" || node.role === "checkbox")) {
        const q = questionAbove(node);
        if (q) [group, groupId] = [q.text, groupId ?? q.at.id];
      }
      out.push({
        ref: node.attrs.ref,
        role: node.role,
        name: node.name,
        // a radio's "*" is on its question
        required: node.attrs.required === "true" || REQUIRED_MARK.test(node.name) || (node.role === "radio" && REQUIRED_MARK.test(group ?? "")),
        checked: node.attrs.checked === undefined ? null : node.attrs.checked === "true",
        value: node.value,
        group,
        groupId,
        context: labelBefore(node),
        options: optionsOf(node),
      });
    }
    node.children.forEach(walk);
  };
  parseTree(text).forEach(walk);
  return out;
}
