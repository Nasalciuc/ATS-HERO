// The icons in app/ are what browsers, Google and iPhones show for the site. favicon.ico and
// apple-icon.png are generated from icon.svg (`npm run icons`); these checks catch a missing frame,
// a wrong size or an iPhone icon with transparent corners before it ships.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const app = (name: string) => readFileSync(path.resolve(__dirname, "../app", name));

/** Width, height and colour type from a PNG's IHDR chunk. */
function png(buf: Buffer) {
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(buf.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colourType: buf.readUInt8(25) };
}

describe("app icons", () => {
  it("favicon.ico holds 16, 32 and 48 px frames", () => {
    const ico = app("favicon.ico");
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1); // an icon, not a cursor
    const sizes: number[] = [];
    for (let i = 0; i < ico.readUInt16LE(4); i++) {
      const entry = 6 + 16 * i;
      const size = ico.readUInt8(entry) || 256;
      const start = ico.readUInt32LE(entry + 12);
      const frame = png(ico.subarray(start, start + ico.readUInt32LE(entry + 8)));
      expect([frame.width, frame.height]).toEqual([size, size]);
      sizes.push(size);
    }
    expect(sizes.sort((a, b) => a - b)).toEqual([16, 32, 48]);
  });

  it("apple-icon.png is 180 px with no alpha channel (iOS fills transparent corners with black)", () => {
    const icon = png(app("apple-icon.png"));
    expect([icon.width, icon.height]).toEqual([180, 180]);
    expect(icon.colourType).toBe(2); // truecolour, no alpha
  });

  it("icon.svg is a plain drawing: no script, no external reference", () => {
    const svg = app("icon.svg").toString("utf8");
    expect(svg).toMatch(/viewBox="0 0 32 32"/);
    expect(svg).toMatch(/<rect id="tile"/); // scripts/build-icons.mjs drops it for the iPhone icon
    expect(svg).not.toMatch(/<script|<foreignObject|href=|url\(/i);
  });
});
