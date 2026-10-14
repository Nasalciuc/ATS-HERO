// Modern — two-column with a solid colored sidebar (photo + contact + skills + languages),
// like Reactive Resume's Gengar. A fixed sidebar background repeats on every page.
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/types";
import { FONT, FONT_BOLD, type TemplateTheme } from "./theme";
import {
  Avatar, ContactBar, Section, summaryEntries, experienceEntries, educationEntries,
  simpleEntries, textEntries, ALL_SIMPLE, GAP, type Entry,
} from "./shared";

const SIDEBAR_RATIO = 0.34;
const SIDEBAR_W = `${SIDEBAR_RATIO * 100}%`;
const SIDEBAR_PAD_X = 18;
// A4 width (pt) × sidebar share − horizontal padding − contact icon (9) − icon gap (4).
const CONTACT_TEXT_W = 595.28 * SIDEBAR_RATIO - 2 * SIDEBAR_PAD_X - 13;

const st = StyleSheet.create({
  // The vertical margin belongs to the PAGE: on a column it is dropped where the column continues
  // on the next page, and the text there started at the very top edge.
  page: { fontFamily: FONT, fontSize: 10, lineHeight: 1.45, paddingVertical: 30 },
  sidebarBg: { position: "absolute", top: 0, left: 0, bottom: 0, width: SIDEBAR_W },
  row: { flexDirection: "row" },
  sidebar: { width: SIDEBAR_W, paddingHorizontal: SIDEBAR_PAD_X },
  // A gap between sections, not a bottom margin: see classic.tsx.
  main: { width: "66%", paddingHorizontal: 24, rowGap: GAP.section },
  name: { fontSize: 17, fontFamily: FONT_BOLD, marginTop: 12, lineHeight: 1.25 },
  role: { fontSize: 11, marginTop: 4 },
  sideBlock: { marginTop: 16 },
});

export default function ModernTemplate({ data, theme }: { data: CvData; theme: TemplateTheme }) {
  const p = data.personalInfo;
  const white = theme.onPrimary;
  const languages: Entry[] = data.languages.length > 0 ? [{
    key: "languages",
    body: (
      <View style={{ rowGap: 2, paddingBottom: 2 }}>
        {data.languages.map((l) => (
          <Text key={l.id} style={{ color: white }}>{l.name}{l.level ? <Text style={{ color: white, opacity: 0.8 }}> ({l.level})</Text> : null}</Text>
        ))}
      </View>
    ),
  }] : [];

  return (
    <Document title={`${p.name || "Resume"} — CV`} author={p.name || "ATS Hero"} creator="ATS Hero" producer="ATS Hero">
      <Page size="A4" style={[st.page, { color: theme.text }]}>
        <View fixed style={[st.sidebarBg, { backgroundColor: theme.primary }]} />
        <View style={st.row}>
          {/* Sidebar */}
          <View style={st.sidebar}>
            <Avatar src={p.photo} size={88} radius={8} />
            <Text style={[st.name, { color: white }]}>{p.name || "Your Name"}</Text>
            {data.summary.position ? <Text style={[st.role, { color: white }]}>{data.summary.position}</Text> : null}

            <ContactBar p={p} theme={theme} color={white} direction="column" columnTextWidth={CONTACT_TEXT_W} />

            <Section title="SKILLS" variant="onPrimary" theme={theme} style={st.sideBlock} entries={textEntries("skills", data.skills.join(", "), white)} />
            <Section title="TOOLS" variant="onPrimary" theme={theme} style={st.sideBlock} entries={textEntries("tools", data.instruments.join(", "), white)} />
            <Section title="SOFT SKILLS" variant="onPrimary" theme={theme} style={st.sideBlock} entries={textEntries("soft", data.softSkills.join(", "), white)} />
            <Section title="LANGUAGES" variant="onPrimary" theme={theme} style={st.sideBlock} entries={languages} />
          </View>

          {/* Main */}
          <View style={st.main}>
            <Section title="SUMMARY" theme={theme} entries={summaryEntries(data, theme)} />
            <Section title="EXPERIENCE" theme={theme} entries={experienceEntries(data, theme)} />
            <Section title="EDUCATION" theme={theme} entries={educationEntries(data, theme)} />
            {ALL_SIMPLE.map(({ key, title }) => (
              <Section key={key} title={title} theme={theme} entries={simpleEntries(data[key] as any, theme)} />
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
