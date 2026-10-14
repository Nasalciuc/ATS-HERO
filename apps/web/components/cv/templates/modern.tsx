// Modern — two-column with a solid colored sidebar (photo + contact + skills + languages),
// like Reactive Resume's Gengar. A fixed sidebar background repeats on every page.
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/types";
import { breakLongWords, fitWordsFontSize } from "@/lib/cv-print";
import { A4_WIDTH, FONT, FONT_BOLD, LAYOUT, type TemplateTheme } from "./theme";
import {
  Avatar, ContactBar, Section, summaryEntries, experienceEntries, educationEntries,
  simpleEntries, textEntries, ALL_SIMPLE, GAP, CONTACT_ICON_W, type Entry,
} from "./shared";

const L = LAYOUT.modern;
const SIDEBAR_W = `${L.sidebarPct}%`;
/** Width (pt) of the text inside the sidebar. */
const SIDE_TEXT_W = (A4_WIDTH * L.sidebarPct) / 100 - 2 * L.sidebarPadX;
const NAME_SIZE = 17;
const NAME_MIN = 12;

const st = StyleSheet.create({
  // The vertical margin belongs to the PAGE: on a column it is dropped where the column continues
  // on the next page, and the text there started at the very top edge.
  page: { fontFamily: FONT, fontSize: 10, lineHeight: 1.45, paddingVertical: L.padY },
  sidebarBg: { position: "absolute", top: 0, left: 0, bottom: 0, width: SIDEBAR_W },
  row: { flexDirection: "row" },
  sidebar: { width: SIDEBAR_W, paddingHorizontal: L.sidebarPadX },
  // A gap between sections, not a bottom margin: see classic.tsx.
  main: { width: `${100 - L.sidebarPct}%`, paddingHorizontal: L.mainPadX, rowGap: GAP.section },
  name: { fontSize: NAME_SIZE, fontFamily: FONT_BOLD, marginTop: 12, lineHeight: 1.25 },
  role: { fontSize: 11, marginTop: 4 },
  sideBlock: { marginTop: 16 },
});

export default function ModernTemplate({ data, theme }: { data: CvData; theme: TemplateTheme }) {
  const p = data.personalInfo;
  const white = theme.onPrimary;
  // White text that runs past the sidebar disappears on the white page. A long name gets smaller
  // until its longest word fits (down to NAME_MIN) and may wrap after a hyphen. Contacts shrink
  // to fit (ContactBar); one that does not fit even at the smallest size wraps in the sidebar.
  // (Moving such contacts to the main column was tried: it reordered the text that ATS parsers
  // read across the two columns, and the ATS lab lost the job list of a real-looking CV.)
  const nameSize = fitWordsFontSize(p.name, SIDE_TEXT_W, NAME_SIZE, NAME_MIN, true);
  const side = (text: string) => breakLongWords(text, SIDE_TEXT_W);
  const languages: Entry[] = data.languages.length > 0 ? [{
    key: "languages",
    body: (
      <View style={{ rowGap: 2, paddingBottom: 2 }}>
        {data.languages.map((l) => (
          <Text key={l.id} style={{ color: white }}>{side(l.name)}{l.level ? <Text style={{ color: white, opacity: 0.8 }}> ({side(l.level)})</Text> : null}</Text>
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
            {p.name ? <Text style={[st.name, { color: white, fontSize: nameSize }]}>{breakLongWords(p.name, SIDE_TEXT_W, nameSize, true)}</Text> : null}
            {data.summary.position ? <Text style={[st.role, { color: white }]}>{breakLongWords(data.summary.position, SIDE_TEXT_W, 11)}</Text> : null}

            <ContactBar p={p} theme={theme} color={white} direction="column" maxTextWidth={SIDE_TEXT_W - CONTACT_ICON_W} />

            <Section title="SKILLS" variant="onPrimary" theme={theme} style={st.sideBlock} entries={textEntries("skills", data.skills.join(", "), white, SIDE_TEXT_W)} />
            <Section title="TOOLS" variant="onPrimary" theme={theme} style={st.sideBlock} entries={textEntries("tools", data.instruments.join(", "), white, SIDE_TEXT_W)} />
            <Section title="SOFT SKILLS" variant="onPrimary" theme={theme} style={st.sideBlock} entries={textEntries("soft", data.softSkills.join(", "), white, SIDE_TEXT_W)} />
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
