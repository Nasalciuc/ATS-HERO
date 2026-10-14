// Minimal — clean single column, dark headings with a thin rule, generous whitespace,
// no photo. The most ATS-conservative; justified meta + bullets like the others.
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/types";
import { breakLongWords } from "@/lib/cv-print";
import { FONT, FONT_BOLD, LAYOUT, type TemplateTheme } from "./theme";
import { pdfData } from "./glyphs";
import {
  ContactBar, Section, summaryEntries, skillsEntries, experienceEntries,
  educationEntries, simpleEntries, documentProps, ALL_SIMPLE, GAP, CONTACT_ICON_W,
} from "./shared";

const st = StyleSheet.create({
  page: { paddingVertical: LAYOUT.minimal.padY, paddingHorizontal: LAYOUT.minimal.padX, fontFamily: FONT, fontSize: 10, lineHeight: 1.5 },
  name: { fontSize: 21, fontFamily: FONT_BOLD, letterSpacing: 0.3, lineHeight: 1.25 },
  role: { fontSize: 11.5, marginTop: 5 },
  // A gap, not a bottom margin: see classic.tsx.
  sections: { marginTop: GAP.section, rowGap: GAP.section + 2 },
});

export default function MinimalTemplate({ data: typed, theme }: { data: CvData; theme: TemplateTheme }) {
  const data = pdfData(typed); // only what Inter can draw (glyphs.ts)
  const p = data.personalInfo;

  return (
    <Document {...documentProps(data)}>
      <Page size="A4" style={[st.page, { color: theme.text }]}>
        {/* 12pt less: the name's letter-spacing adds up to that on a long word */}
        {p.name ? <Text style={st.name}>{breakLongWords(p.name, theme.column - 12, 21, true)}</Text> : null}
        {data.summary.position ? <Text style={[st.role, { color: theme.muted }]}>{breakLongWords(data.summary.position, theme.column, 11.5)}</Text> : null}
        <ContactBar p={p} theme={theme} maxTextWidth={theme.column - CONTACT_ICON_W} />

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
