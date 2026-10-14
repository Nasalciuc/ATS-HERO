// Shared building blocks for all CV templates — rebuilt to match Reactive Resume's
// @react-pdf design language (RR v4 also uses @react-pdf): profile picture, icon
// contact items, justified split-row meta (title left / dates right), bullet lists,
// colored section headings with a rule, consistent section spacing.
import { View, Text, Image, Svg, Path, StyleSheet } from "@react-pdf/renderer";
import type { CvData, SimpleEntry } from "@/lib/types";
import { breakLongWords, displayUrl, fitFontSize, textWidth } from "@/lib/cv-print";
import { FONT, FONT_BOLD, type TemplateTheme } from "./theme";

/* ---------------------------------------------------------------- spacing scale */
export const GAP = { section: 14, heading: 4, entry: 9, line: 2 };

/* ----------------------------------------------------------------------- icons  */
// Lucide line icons (MIT), drawn with @react-pdf Svg/Path.
const ICON_PATHS: Record<string, string[]> = {
  mail: ["M3 6 h18 v12 h-18 z", "M3 6 l9 7 l9 -7"],
  phone: ["M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.09 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 .96 .36 1.9 .7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91 .34 1.85 .57 2.81 .7A2 2 0 0 1 22 16.92z"],
  pin: ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", "M12 7 a3 3 0 1 0 0 6 a3 3 0 0 0 0 -6"],
  globe: ["M12 2 a10 10 0 1 0 0 20 a10 10 0 0 0 0 -20", "M2 12 h20", "M12 2 a15 15 0 0 1 0 20 a15 15 0 0 1 0 -20"],
  link: ["M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1", "M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"],
};

export function Icon({ name, color, size = 9 }: { name: string; color: string; size?: number }) {
  const paths = ICON_PATHS[name];
  if (!paths) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {paths.map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={2} fill="none" />
      ))}
    </Svg>
  );
}

/* --------------------------------------------------------------------- avatar   */
export function Avatar({ src, size = 64, radius }: { src?: string; size?: number; radius?: number }) {
  if (!src) return null;
  return <Image src={src} style={{ width: size, height: size, borderRadius: radius ?? size / 2, objectFit: "cover" }} />;
}

/** Separator between inline items. A no-break space before the dot keeps "·" at the END of a
 *  line when a list wraps (a line used to start with "· GCP"); the space after it is the only
 *  place to wrap. Never two ASCII spaces: react-pdf treats a double space as an in-word break
 *  point and adds a fake hyphen there ("Kafka ·-", caught by the ATS lab on a 20-skill CV). */
export const SEP = "\u00A0· ";

/* --------------------------------------------------------------------- helpers  */
export function dateRange(start?: string, end?: string, ongoing?: boolean): string {
  const finish = ongoing ? "Present" : end;
  return [start, finish].filter(Boolean).join(" – ");
}

export function hasSkills(d: CvData): boolean {
  return d.skills.length > 0 || d.instruments.length > 0 || d.softSkills.length > 0 || d.languages.length > 0;
}

function descLines(text?: string): string[] {
  return (text || "").split(/\r?\n/).map((s) => s.trim().replace(/^[•\-*]\s*/, "")).filter(Boolean);
}

type ContactPair = { icon: string; text: string };
export function contactPairs(p: CvData["personalInfo"]): ContactPair[] {
  const loc = [p.cityState, p.country].filter(Boolean).join(", ");
  return [
    p.email ? { icon: "mail", text: p.email } : null,
    p.phone ? { icon: "phone", text: p.phone } : null,
    loc ? { icon: "pin", text: loc } : null,
    p.website ? { icon: "globe", text: displayUrl(p.website) } : null,
    p.linkedin ? { icon: "link", text: displayUrl(p.linkedin) } : null,
  ].filter(Boolean) as ContactPair[];
}

/* ------------------------------------------------------------------- contact    */
/** Width the contact icon and its gap take in front of the text (pt). */
export const CONTACT_ICON_W = 13;
const CONTACT_MIN_SIZE = 6.5;

export function ContactBar({
  p, theme, color, direction = "row", maxTextWidth,
}: {
  p: CvData["personalInfo"]; theme: TemplateTheme; color?: string; direction?: "row" | "column";
  /** Width (pt) one contact's text may take (the line minus CONTACT_ICON_W). */
  maxTextWidth: number;
}) {
  const c = color ?? theme.muted;
  const items = contactPairs(p);
  return (
    <View style={direction === "row"
      ? { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 3, marginTop: 6 }
      : { flexDirection: "column", rowGap: 4, marginTop: 8 }}>
      {items.map((it, i) => {
        // ONE line per contact, never split: the ATS lab showed a wrapped e-mail or URL is lost by
        // every extractor (pdf.js even joins the pieces with spaces). A long one shrinks to fit;
        // only what does not fit even at CONTACT_MIN_SIZE may wrap, rather than run off the page.
        // (The wrapping Text gets an exact width — see SplitRow for why.)
        const size = fitFontSize(it.text, maxTextWidth, 9, CONTACT_MIN_SIZE);
        const fits = textWidth(it.text, size) <= maxTextWidth;
        return (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", columnGap: 4 }}>
            <Icon name={it.icon} color={c} />
            <Text style={[{ fontSize: size, color: c, lineHeight: direction === "row" ? 1 : 1.2 }, fits ? {} : { width: maxTextWidth }]}>
              {fits ? it.text : breakLongWords(it.text, maxTextWidth, size)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ----------------------------------------------------------------- headings     */
export type HeadingVariant = "primary" | "onPrimary" | "minimal";

export function SectionHeading({ title, theme, variant = "primary" }: { title: string; theme: TemplateTheme; variant?: HeadingVariant }) {
  const color = variant === "onPrimary" ? theme.onPrimary : variant === "minimal" ? theme.text : theme.primary;
  const ruleColor = variant === "onPrimary" ? "rgba(255,255,255,0.4)" : variant === "minimal" ? "#D4D4D8" : theme.primary;
  return (
    <View style={{ marginBottom: GAP.heading }}>
      <Text style={{ fontSize: 10.5, fontFamily: FONT_BOLD, letterSpacing: 1, color, marginBottom: 3 }}>{title}</Text>
      <View style={{ height: variant === "minimal" ? 0.75 : 1.25, backgroundColor: ruleColor }} />
    </View>
  );
}

/* ------------------------------------------------------------- page breaks    */
// How a CV may break across pages — what a recruiter expects, checked by
// tests/cv-page-breaks.test.tsx:
//  - a section heading never ends a page: it is laid out together with its first entry's header;
//  - an entry's header (title, dates, company…) never ends a page: it keeps at least three lines
//    of its content on the same page (KEEP_AHEAD = the 2pt gap + 3 lines of at most 15pt);
//  - a bullet is ONE Text (marker included), so the marker never stays behind, and a bullet or
//    paragraph of 2–3 lines never splits (react-pdf's default orphans = widows = 2).
// react-pdf ignores minPresenceAhead on a node that has nothing before it on the page, hence the
// zero-height <View /> that opens every entry.
const KEEP_AHEAD = 47;

/** One entry of a section: `head` never splits and keeps KEEP_AHEAD of `body` with it. */
export type Entry = { key: string; head?: React.ReactNode; body?: React.ReactNode };

export function Section({
  title, theme, variant = "primary", style, entries,
}: {
  title: string; theme: TemplateTheme; variant?: HeadingVariant;
  style?: React.ComponentProps<typeof View>["style"]; entries: Entry[];
}) {
  if (entries.length === 0) return null;
  return (
    <View style={style}>
      <View style={{ rowGap: GAP.entry }}>
        {entries.map((e, i) => (
          <View key={e.key}>
            <View />
            <View wrap={false} minPresenceAhead={e.body ? KEEP_AHEAD : 0}>
              {i === 0 ? <SectionHeading title={title} theme={theme} variant={variant} /> : null}
              {e.head}
            </View>
            {e.body}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ----------------------------------------------------------------- split row    */
// The right side (dates, place, issuer; 9pt) takes the width of its text, up to half the row;
// longer text wraps inside that half, right-aligned. It used to never shrink, so a long issuer
// squeezed the title into one word per line or ran over it. The wrapping box gets an exact
// width: inside a box that is only capped (maxWidth), react-pdf measures the text wider than
// the box and it runs past the margin.
const RIGHT_SHARE = 0.5;
const SPLIT_GAP = 12;

/** Widths (pt) a long word must fit in a SplitRow of `theme`'s column (see breakLongWords). */
const leftWidth = (theme: TemplateTheme) => theme.column * (1 - RIGHT_SHARE) - SPLIT_GAP;
const rightWidth = (theme: TemplateTheme) => theme.column * RIGHT_SHARE;

export function SplitRow({ left, right, theme }: { left: React.ReactNode; right?: string; theme: TemplateTheme }) {
  const fits = !!right && textWidth(right, 9) <= rightWidth(theme);
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", columnGap: SPLIT_GAP }}>
      <View style={{ flex: 1 }}>{left}</View>
      {right ? (
        <View style={fits ? { flexShrink: 0 } : { width: rightWidth(theme) }}>
          <Text style={[meta.date, { color: theme.faint }]}>{fits ? right : breakLongWords(right, rightWidth(theme), 9)}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ----------------------------------------------------------------- bullets      */
// The marker sits in a hanging indent: Inter Bold "•" is 4.7412pt wide at the 10pt body size;
// + 2.1875pt letter-spacing + one space (2.8125pt) puts the text at 9.7412pt, exactly where the
// wrapped lines start (the same place as before bullets became one Text). The test checks these
// numbers against the font files and the alignment in a rendered PDF.
// react-pdf takes a paragraph's indent from its FIRST run (here the marker) and textIndent is
// not inherited, so the marker carries it.
export const BULLET = { indent: 9.7412109375, track: 2.1875 };

/** A description as bullets (one line of text = one bullet); null when there is no text. */
export function bullets(text: string | undefined, theme: TemplateTheme): React.ReactNode | null {
  const lines = descLines(text);
  if (lines.length === 0) return null;
  if (lines.length === 1) return <Text style={{ color: theme.text, marginTop: 1 }}>{breakLongWords(lines[0], theme.column)}</Text>;
  return (
    <View style={{ marginTop: 2, rowGap: 2 }}>
      {lines.map((l, i) => (
        <Text key={i} style={{ color: theme.text, marginLeft: BULLET.indent }}>
          <Text style={{ color: theme.primary, fontFamily: FONT_BOLD, letterSpacing: BULLET.track, textIndent: -BULLET.indent }}>•</Text>
          {` ${breakLongWords(l, theme.column - BULLET.indent)}`}
        </Text>
      ))}
    </View>
  );
}

const meta = StyleSheet.create({
  title: { fontFamily: FONT_BOLD },
  sub: {},
  date: { fontSize: 9, textAlign: "right" },
});

/** Text pieces of an entry, with long words made wrappable for where they sit. */
const asTitle = (s: string, theme: TemplateTheme) => breakLongWords(s, leftWidth(theme), 10, true);
const asLeft = (s: string, theme: TemplateTheme) => breakLongWords(s, leftWidth(theme));
const asBody = (s: string, theme: TemplateTheme) => breakLongWords(s, theme.column);

/* ---------------------------------------------------------------- entries      */
export function summaryEntries(data: CvData, theme: TemplateTheme): Entry[] {
  if (!data.summary.valueProposition) return [];
  return [{ key: "summary", body: <Text style={{ color: theme.text }}>{asBody(data.summary.valueProposition, theme)}</Text> }];
}

export function skillsEntries(data: CvData, theme: TemplateTheme): Entry[] {
  return hasSkills(data) ? [{ key: "skills", body: <SkillsBody data={data} theme={theme} /> }] : [];
}

/** A single paragraph in a narrow column of `width` pt (Modern sidebar blocks). */
export function textEntries(key: string, text: string, color: string, width: number): Entry[] {
  return text ? [{ key, body: <Text style={{ color }}>{breakLongWords(text, width)}</Text> }] : [];
}

export function experienceEntries(data: CvData, theme: TemplateTheme): Entry[] {
  return data.work.map((w) => {
    const dates = dateRange(w.startDate, w.endDate, w.current);
    const loc = [w.cityState, w.country].filter(Boolean).join(", ");
    const head = theme.meta === "stacked" ? (
      <>
        <Text style={[meta.title, { color: theme.text }]}>{breakLongWords(w.role || w.company || "—", theme.column, 10, true)}</Text>
        <Text style={{ color: theme.muted }}>{asBody([dates, w.role ? w.company : "", loc].filter(Boolean).join(SEP), theme)}</Text>
      </>
    ) : (
      <>
        <SplitRow
          left={<Text style={[meta.title, { color: theme.text }]}>{asTitle(w.role || "—", theme)}</Text>}
          right={dates}
          theme={theme}
        />
        <SplitRow
          left={<Text style={{ color: theme.muted }}>{asLeft(w.company, theme)}</Text>}
          right={loc}
          theme={theme}
        />
      </>
    );
    return { key: w.id, head, body: bullets(w.description, theme) };
  });
}

export function educationEntries(data: CvData, theme: TemplateTheme): Entry[] {
  return data.education.map((e) => {
    const dates = dateRange(e.startDate, e.endDate);
    const right = [e.location, e.grade ? `Grade: ${e.grade}` : ""].filter(Boolean).join(SEP);
    const head = theme.meta === "stacked" ? (
      <>
        <Text style={[meta.title, { color: theme.text }]}>{breakLongWords(e.degree || e.institution || "—", theme.column, 10, true)}</Text>
        <Text style={{ color: theme.muted }}>{asBody([dates, e.degree ? e.institution : "", e.location, e.grade ? `Grade: ${e.grade}` : ""].filter(Boolean).join(SEP), theme)}</Text>
      </>
    ) : (
      <>
        <SplitRow
          left={<Text style={[meta.title, { color: theme.text }]}>{asTitle(e.degree || e.institution || "—", theme)}</Text>}
          right={dates}
          theme={theme}
        />
        <SplitRow
          left={<Text style={{ color: theme.muted }}>{asLeft(e.degree ? e.institution : "", theme)}</Text>}
          right={right}
          theme={theme}
        />
      </>
    );
    const body = e.additional ? <Text style={{ color: theme.text, marginTop: 1 }}>{asBody(e.additional, theme)}</Text> : null;
    return { key: e.id, head, body };
  });
}

export function SkillsBody({ data, theme, stacked = false }: { data: CvData; theme: TemplateTheme; stacked?: boolean }) {
  const sep = stacked ? ", " : SEP;
  const space = stacked ? 4 : 2; // a gap + padding, not a bottom margin (see classic.tsx)
  const Group = ({ label, value }: { label: string; value: string }) => (
    <Text style={{ color: theme.text }}>
      <Text style={{ fontFamily: FONT_BOLD, color: theme.text }}>{label}: </Text>
      {asBody(value, theme)}
    </Text>
  );
  return (
    <View style={{ rowGap: space, paddingBottom: space }}>
      {data.skills.length > 0 ? <Group label="Hard skills" value={data.skills.join(sep)} /> : null}
      {data.instruments.length > 0 ? <Group label="Tools" value={data.instruments.join(sep)} /> : null}
      {data.softSkills.length > 0 ? <Group label="Soft skills" value={data.softSkills.join(sep)} /> : null}
      {!stacked && data.languages.length > 0 ? (
        <Group label="Languages" value={data.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(sep)} />
      ) : null}
    </View>
  );
}

export function simpleEntries(items: SimpleEntry[], theme: TemplateTheme): Entry[] {
  return items.map((it) => {
    const right = [it.organisation || it.issuer || it.publisher, it.date].filter(Boolean).join(SEP);
    const desc = bullets(it.description, theme);
    const link = it.link ? <Text style={{ fontSize: 9, color: theme.faint, marginTop: 1 }}>{breakLongWords(it.link, theme.column, 9)}</Text> : null;
    return {
      key: it.id,
      head: (
        <SplitRow
          left={<Text style={[meta.title, { color: theme.text }]}>{asTitle(it.title || it.role || "—", theme)}</Text>}
          right={right}
          theme={theme}
        />
      ),
      body: desc || link ? <>{desc}{link}</> : null,
    };
  });
}

export const ALL_SIMPLE: { key: keyof CvData; title: string }[] = [
  { key: "awards", title: "AWARDS" },
  { key: "certifications", title: "CERTIFICATIONS" },
  { key: "publications", title: "PUBLICATIONS" },
  { key: "volunteering", title: "VOLUNTEERING" },
  { key: "activities", title: "RELEVANT ACTIVITIES" },
];
