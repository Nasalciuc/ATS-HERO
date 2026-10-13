"""Figma page metadata (XML from the Figma MCP `get_metadata`) -> frame-relative boxes JSON.

    python design-check/figma/xml_to_json.py page.xml > design-check/figma/page-180-17.json

Every top-level frame keeps its own coordinate system (0,0 = frame top-left), which is what the
browser measures at the same viewport size. Instances are leaves in MCP metadata, so boxes of
nodes inside an instance are written into the spec by hand (from get_design_context).

Groups come out as <frame> too, but unlike frames they don't start a coordinate system: a group's
children are positioned in the group's parent space. A <frame> whose children's union is exactly
its own box (in the parent's coordinates) is treated as a group.
"""
import json
import sys
import xml.etree.ElementTree as ET


def main(path: str) -> None:
    text = open(path, encoding="utf-8").read()
    if text.lstrip().startswith("["):  # raw MCP tool output: [{"type":"text","text":"<canvas ..."}]
        text = json.loads(text)[0]["text"]
    root = ET.fromstring(text)
    frames = {}
    for top in root:
        a = top.attrib
        if top.tag not in ("frame", "section") or a.get("hidden"):
            continue
        nodes = {}

        def is_group(node) -> bool:
            kids = list(node)
            a = node.attrib
            x0, y0 = float(a.get("x", 0)), float(a.get("y", 0))
            if node.tag != "frame" or not kids or (abs(x0) < 0.01 and abs(y0) < 0.01):
                return False  # at (0,0) both readings give the same boxes
            xs = [float(k.attrib.get("x", 0)) for k in kids]
            ys = [float(k.attrib.get("y", 0)) for k in kids]
            x1 = max(float(k.attrib.get("x", 0)) + float(k.attrib.get("width", 0)) for k in kids)
            y1 = max(float(k.attrib.get("y", 0)) + float(k.attrib.get("height", 0)) for k in kids)
            w, h = float(a.get("width", 0)), float(a.get("height", 0))
            near = lambda u, v: abs(u - v) < 0.6
            return near(min(xs), x0) and near(min(ys), y0) and near(x1, x0 + w) and near(y1, y0 + h)

        def walk(node, ox: float, oy: float) -> None:
            for c in node:
                ca = c.attrib
                x, y = ox + float(ca.get("x", 0)), oy + float(ca.get("y", 0))
                nodes[ca["id"]] = {"name": ca.get("name", ""), "type": c.tag,
                                   "box": [round(x, 2), round(y, 2), round(float(ca.get("width", 0)), 2),
                                           round(float(ca.get("height", 0)), 2)],
                                   **({"hidden": True} if ca.get("hidden") else {})}
                # a group's children live in the same space as the group itself
                walk(c, ox, oy) if is_group(c) else walk(c, x, y)

        walk(top, 0.0, 0.0)
        frames[a["id"]] = {"name": a.get("name", ""), "size": [float(a["width"]), float(a["height"])], "nodes": nodes}
    json.dump({"page": root.attrib.get("id"), "name": root.attrib.get("name"), "frames": frames},
              sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main(sys.argv[1])
