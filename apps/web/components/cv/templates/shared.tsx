// Shared building blocks for all CV templates — rebuilt to match Reactive Resume's
// @react-pdf design language (RR v4 also uses @react-pdf): profile picture, icon
// contact items, justified split-row meta (title left / dates right), bullet lists,
// colored section headings with a rule, consistent section spacing.
import { View, Text, Image, Svg, Path, StyleSheet } from "@react-pdf/renderer";
import type { CvData, SimpleEntry } from "@/lib/types";
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
    p.website ? { icon: "globe", text: p.website } : null,
    p.linkedin ? { icon: "link", text: p.linkedin } : null,
  ].filter(Boolean) as ContactPair[];
}

/* ------------------------------------------------------------------- contact    */
export function ContactBar({
  p, theme, color, direction = "row",
}: { p: CvData["personalInfo"]; theme: TemplateTheme; color?: string; direction?: "row" | "column" }) {
  const c = color ?? theme.muted;
  const items = contactPairs(p);
  return (
    <View style={direction === "row"
      ? { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 3, marginTop: 6 }
      : { flexDirection: "column", rowGap: 4, marginTop: 8 }}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", columnGap: 4 }}>
          <Icon name={it.icon} color={c} />
          <Text style={{ fontSize: 9, color: c, lineHeight: 1 }}>{it.text}</Text>
        </View>
      ))}
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

/* ----------------------------------------------------------------- split row    */
export function SplitRow({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", columnGap: 12 }}>
      <View style={{ flex: 1 }}>{left}</View>
      {right ? <View style={{ flexShrink: 0 }}>{right}</View> : null}
    </View>
  );
}

/* ----------------------------------------------------------------- bullets      */
export function BulletList({ text, theme }: { text?: string; theme: TemplateTheme }) {
  const lines = descLines(text);
  if (lines.length === 0) return null;
  if (lines.length === 1) return <Text style={{ color: theme.text, marginTop: 1 }}>{lines[0]}</Text>;
  return (
    <View style={{ marginTop: 2, rowGap: 2 }}>
      {lines.map((l, i) => (
        <View key={i} style={{ flexDirection: "row", columnGap: 5, alignItems: "flex-start" }}>
          <Text style={{ color: theme.primary, fontFamily: FONT_BOLD }}>•</Text>
          <Text style={{ color: theme.text, flex: 1 }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

const meta = StyleSheet.create({
  title: { fontFamily: FONT_BOLD },
  sub: {},
  date: { fontSize: 9 },
});

/* ----------------------------------------------------------------- bodies       */
export function SummaryBody({ data, theme }: { data: CvData; theme: TemplateTheme }) {
  if (!data.summary.valueProposition) return null;
  return <Text style={{ color: theme.text }}>{data.summary.valueProposition}</Text>;
}

export function ExperienceBody({ data, theme }: { data: CvData; theme: TemplateTheme }) {
  return (
    <View style={{ rowGap: GAP.entry }}>
      {data.work.map((w) => {
        const dates = dateRange(w.startDate, w.endDate, w.current);
        const loc = [w.cityState, w.country].filter(Boolean).join(", ");
        return (
          <View key={w.id}>
            <SplitRow
              left={<Text style={[meta.title, { color: theme.text }]}>{w.role || "—"}</Text>}
              right={dates ? <Text style={[meta.date, { color: theme.faint }]}>{dates}</Text> : null}
            />
            <SplitRow
              left={<Text style={{ color: theme.muted }}>{w.company}</Text>}
              right={loc ? <Text style={[meta.date, { color: theme.faint }]}>{loc}</Text> : null}
            />
            <BulletList text={w.description} theme={theme} />
          </View>
        );
      })}
    </View>
  );
}

export function EducationBody({ data, theme }: { data: CvData; theme: TemplateTheme }) {
  return (
    <View style={{ rowGap: GAP.entry }}>
      {data.education.map((e) => {
        const dates = dateRange(e.startDate, e.endDate);
        const right = [e.location, e.grade ? `Grade: ${e.grade}` : ""].filter(Boolean).join("  ·  ");
        return (
          <View key={e.id}>
            <SplitRow
              left={<Text style={[meta.title, { color: theme.text }]}>{e.degree || e.institution || "—"}</Text>}
              right={dates ? <Text style={[meta.date, { color: theme.faint }]}>{dates}</Text> : null}
            />
            <SplitRow
              left={<Text style={{ color: theme.muted }}>{e.degree ? e.institution : ""}</Text>}
              right={right ? <Text style={[meta.date, { color: theme.faint }]}>{right}</Text> : null}
            />
            {e.additional ? <Text style={{ color: theme.text, marginTop: 1 }}>{e.additional}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export function SkillsBody({ data, theme, stacked = false }: { data: CvData; theme: TemplateTheme; stacked?: boolean }) {
  const sep = stacked ? ", " : "  ·  ";
  const Group = ({ label, value }: { label: string; value: string }) => (
    <Text style={{ color: theme.text, marginBottom: stacked ? 4 : 2 }}>
      <Text style={{ fontFamily: FONT_BOLD, color: theme.text }}>{label}: </Text>
      {value}
    </Text>
  );
  return (
    <View>
      {data.skills.length > 0 ? <Group label="Hard skills" value={data.skills.join(sep)} /> : null}
      {data.instruments.length > 0 ? <Group label="Tools" value={data.instruments.join(sep)} /> : null}
      {data.softSkills.length > 0 ? <Group label="Soft skills" value={data.softSkills.join(sep)} /> : null}
      {!stacked && data.languages.length > 0 ? (
        <Group label="Languages" value={data.languages.map((l) => `${l.name} (${l.level})`).join(sep)} />
      ) : null}
    </View>
  );
}

export function SimpleSection({ items, theme }: { items: SimpleEntry[]; theme: TemplateTheme }) {
  if (items.length === 0) return null;
  return (
    <View style={{ rowGap: GAP.entry }}>
      {items.map((it) => {
        const right = [it.organisation || it.issuer || it.publisher, it.date].filter(Boolean).join("  ·  ");
        return (
          <View key={it.id}>
            <SplitRow
              left={<Text style={[meta.title, { color: theme.text }]}>{it.title || it.role || "—"}</Text>}
              right={right ? <Text style={[meta.date, { color: theme.faint }]}>{right}</Text> : null}
            />
            <BulletList text={it.description} theme={theme} />
            {it.link ? <Text style={{ fontSize: 9, color: theme.faint, marginTop: 1 }}>{it.link}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export const ALL_SIMPLE: { key: keyof CvData; title: string }[] = [
  { key: "awards", title: "AWARDS" },
  { key: "certifications", title: "CERTIFICATIONS" },
  { key: "publications", title: "PUBLICATIONS" },
  { key: "volunteering", title: "VOLUNTEERING" },
  { key: "activities", title: "RELEVANT ACTIVITIES" },
];
