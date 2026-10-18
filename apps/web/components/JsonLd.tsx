import { serializeJsonLd, type JsonLd as JsonLdData } from "@/lib/structured-data";

/**
 * Structured data for crawlers. A data block, not a script: browsers never run it, so the CSP's
 * script-src doesn't apply. Server Component: the JSON is in the HTML before any JavaScript loads.
 *
 * The JSON is the element's text child, so no raw-HTML prop is needed (AGENTS.md rule 3). React 19
 * writes a <script>'s text as-is (quotes stay quotes, so the JSON stays valid) and escapes any
 * "</script" itself; serializeJsonLd escapes every "<" on top of that.
 */
export default function JsonLd({ data }: { data: JsonLdData }) {
  return <script type="application/ld+json">{serializeJsonLd(data)}</script>;
}
