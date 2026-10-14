// Classic — single column, photo header, colored section headings with a rule.
// Inspired by Reactive Resume's Onyx/Rhyhorn. Safe, recruiter-friendly default.
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/types";
import { FONT, FONT_BOLD, type TemplateTheme } from "./theme";
import {
  Avatar, ContactBar, Section, summaryEntries, skillsEntries, experienceEntries,
  educationEntries, simpleEntries, ALL_SIMPLE, GAP,
} from "./shared";

const st = StyleSheet.create({
  page: { paddingVertical: 38, paddingHorizontal: 44, fontFamily: FONT, fontSize: 10, lineHeight: 1.45 },
  header: { flexDirection: "row", alignItems: "center", columnGap: 16, marginBottom: GAP.section },
  name: { fontSize: 22, fontFamily: FONT_BOLD, lineHeight: 1.25 },
  role: { fontSize: 12, marginTop: 5 },
  // Space between sections is a gap of the column, not a bottom margin: react-pdf moves a node to
  // the next page when its bottom MARGIN does not fit, which sent whole sections (and half a page
  // of white) to page 2.
  sections: { rowGap: GAP.section },
});

export default function ClassicTemplate({ data, theme }: { data: CvData; theme: TemplateTheme }) {
  const p = data.personalInfo;

  return (
    <Document title={`${p.name || "Resume"} — CV`} author={p.name || "ATS Hero"} creator="ATS Hero" producer="ATS Hero">
      <Page size="A4" style={[st.page, { color: theme.text }]}>
        <View style={st.header}>
          <Avatar src={p.photo} size={68} radius={10} />
          <View style={{ flex: 1 }}>
            <Text style={st.name}>{p.name || "Your Name"}</Text>
            {data.summary.position ? <Text style={[st.role, { color: theme.muted }]}>{data.summary.position}</Text> : null}
            <ContactBar p={p} theme={theme} />
          </View>
        </View>

        <View style={st.sections}>
          <Section title="SUMMARY" theme={theme} entries={summaryEntries(data, theme)} />
          <Section title="SKILLS" theme={theme} entries={skillsEntries(data, theme)} />
          <Section title="EXPERIENCE" theme={theme} entries={experienceEntries(data, theme)} />
          <Section title="EDUCATION" theme={theme} entries={educationEntries(data, theme)} />
          {ALL_SIMPLE.map(({ key, title }) => (
            <Section key={key} title={title} theme={theme} entries={simpleEntries(data[key] as any, theme)} />
          ))}
        </View>
      </Page>
    </Document>
  );
}
