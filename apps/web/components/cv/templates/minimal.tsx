// Minimal — clean single column, dark headings with a thin rule, generous whitespace,
// no photo. The most ATS-conservative; justified meta + bullets like the others.
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/types";
import { FONT, FONT_BOLD, type TemplateTheme } from "./theme";
import {
  ContactBar, Section, summaryEntries, skillsEntries, experienceEntries,
  educationEntries, simpleEntries, ALL_SIMPLE, GAP,
} from "./shared";

const st = StyleSheet.create({
  page: { paddingVertical: 46, paddingHorizontal: 54, fontFamily: FONT, fontSize: 10, lineHeight: 1.5 },
  name: { fontSize: 21, fontFamily: FONT_BOLD, letterSpacing: 0.3, lineHeight: 1.25 },
  role: { fontSize: 11.5, marginTop: 5 },
  // A gap, not a bottom margin: see classic.tsx.
  sections: { marginTop: GAP.section, rowGap: GAP.section + 2 },
});

export default function MinimalTemplate({ data, theme }: { data: CvData; theme: TemplateTheme }) {
  const p = data.personalInfo;

  return (
    <Document title={`${p.name || "Resume"} — CV`} author={p.name || "ATS Hero"} creator="ATS Hero" producer="ATS Hero">
      <Page size="A4" style={[st.page, { color: theme.text }]}>
        <Text style={st.name}>{p.name || "Your Name"}</Text>
        {data.summary.position ? <Text style={[st.role, { color: theme.muted }]}>{data.summary.position}</Text> : null}
        <ContactBar p={p} theme={theme} />

        <View style={st.sections}>
          <Section title="SUMMARY" variant="minimal" theme={theme} entries={summaryEntries(data, theme)} />
          <Section title="SKILLS" variant="minimal" theme={theme} entries={skillsEntries(data, theme)} />
          <Section title="EXPERIENCE" variant="minimal" theme={theme} entries={experienceEntries(data, theme)} />
          <Section title="EDUCATION" variant="minimal" theme={theme} entries={educationEntries(data, theme)} />
          {ALL_SIMPLE.map(({ key, title }) => (
            <Section key={key} title={title} variant="minimal" theme={theme} entries={simpleEntries(data[key] as any, theme)} />
          ))}
        </View>
      </Page>
    </Document>
  );
}
