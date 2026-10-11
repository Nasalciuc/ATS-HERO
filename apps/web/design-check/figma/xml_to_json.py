"""Figma page metadata (XML from the Figma MCP `get_metadata`) -> frame-relative boxes JSON.

    python design-check/figma/xml_to_json.py page.xml > design-check/figma/page-180-17.json

Every top-level frame keeps its own coordinate system (0,0 = frame top-left), which is what the
browser measures at the same viewport size. Instances are leaves in MCP metadata, so boxes of
nodes inside an instance are written into the spec by hand (from get_design_context).
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

        def walk(node, ox: float, oy: float) -> None:
            for c in node:
                ca = c.attrib
                x, y = ox + float(ca.get("x", 0)), oy + float(ca.get("y", 0))
                nodes[ca["id"]] = {"name": ca.get("name", ""), "type": c.tag,
                                   "box": [round(x, 2), round(y, 2), round(float(ca.get("width", 0)), 2),
                                           round(float(ca.get("height", 0)), 2)],
                                   **({"hidden": True} if ca.get("hidden") else {})}
                walk(c, x, y)

        walk(top, 0.0, 0.0)
        frames[a["id"]] = {"name": a.get("name", ""), "size": [float(a["width"]), float(a["height"])], "nodes": nodes}
    json.dump({"page": root.attrib.get("id"), "name": root.attrib.get("name"), "frames": frames},
              sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main(sys.argv[1])
