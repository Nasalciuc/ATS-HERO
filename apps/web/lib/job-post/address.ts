/**
 * Which addresses our server may connect to when it opens a job link: public ones only. A link to
 * a private, loopback, link-local or reserved address (or a name that resolves to one) would let a
 * visitor make our server call its own network ("SSRF").
 */
import { isIP } from "node:net";

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (cloud metadata lives here)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, and 255.255.255.255
];

const v4ToInt = (ip: string) => ip.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;

function v4Public(ip: string): boolean {
  const n = v4ToInt(ip);
  return !V4_BLOCKED.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (v4ToInt(base) & mask);
  });
}

/** The 8 groups of an IPv6 address, as numbers ("::" expanded, a trailing IPv4 part split in two). */
function v6Groups(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = v4ToInt(v4[1]);
    s = s.slice(0, -v4[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = s.split("::");
  const a = head ? head.split(":") : [];
  const b = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const groups = tail !== undefined ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b] : a;
  if (groups.length !== 8) return null;
  return groups.map((g) => parseInt(g || "0", 16));
}

function v6Public(ip: string): boolean {
  const g = v6Groups(ip);
  if (!g) return false;
  if (g.every((x) => x === 0)) return false; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return false; // ::1
  const v4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  // an IPv4 address inside IPv6 (::ffff:a.b.c.d, ::a.b.c.d, 64:ff9b::a.b.c.d): judged as IPv4
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) return v4Public(v4(g[6], g[7]));
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return v4Public(v4(g[6], g[7]));
  // Otherwise only global unicast (2000::/3) is public. That leaves out unique local (fc00::/7),
  // link-local (fe80::/10), the old site-local (fec0::/10), multicast, ::ffff:0:a.b.c.d, 100::/64
  // and local NAT64 (64:ff9b:1::/48).
  if ((g[0] & 0xe000) !== 0x2000) return false;
  if (g[0] === 0x2001 && g[1] === 0) return false; // Teredo: the IPv4 inside is scrambled, refuse it
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
  if (g[0] === 0x3fff && g[1] < 0x1000) return false; // documentation (3fff::/20)
  if (g[0] === 0x2002) return v4Public(v4(g[1], g[2])); // 6to4: judged as the IPv4 it carries
  return true;
}

/** True for an address on the public internet. Anything that isn't a valid IP is not public. */
export function isPublicAddress(ip: string): boolean {
  const kind = isIP(ip.split("%")[0]);
  if (kind === 4) return v4Public(ip);
  if (kind === 6) return v6Public(ip);
  return false;
}
