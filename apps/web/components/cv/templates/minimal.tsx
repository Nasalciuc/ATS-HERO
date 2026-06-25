// Minimal — clean single column, dark headings with a thin rule, generous whitespace,
// no photo. The most ATS-conservative; justified meta + bullets like the others.
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/types";
import { FONT, FONT_BOLD, type TemplateTheme } from "./theme";
import {
  ContactBar, SectionHeading, SummaryBody, SkillsBody, ExperienceBody,
  EducationBody, SimpleSection, hasSkills, ALL_SIMPLE, GAP,
} from "./shared";

const st = StyleSheet.create({
  page: { paddingVertical: 46, paddingHorizontal: 54, fontFamily: FONT, fontSize: 10, lineHeight: 1.5 },
  name: { fontSize: 21, fontFamily: FONT_BOLD, letterSpacing: 0.3, lineHeight: 1.25 },
  role: { fontSize: 11.5, marginTop: 5 },
  section: { marginBottom: GAP.section + 2 },
});

export default function MinimalTemplate({ data, theme }: { data: CvData; theme: TemplateTheme }) {
  const p = data.personalInfo;
  const Section = ({ title, children, show }: { title: string; children: React.ReactNode; show: boolean }) =>
    show ? <View style={st.section}><SectionHeading title={title} theme={theme} variant="minimal" />{children}</View> : null;

  return (
    <Document title={`${p.name || "Resume"} — CV`} author={p.name || "ATS Hero"} creator="ATS Hero" producer="ATS Hero">
      <Page size="A4" style={[st.page, { color: theme.text }]}>
        <Text style={st.name}>{p.name || "Your Name"}</Text>
        {data.summary.position ? <Text style={[st.role, { color: theme.muted }]}>{data.summary.position}</Text> : null}
        <ContactBar p={p} theme={theme} />

        <View style={{ marginTop: GAP.section }}>
          <Section title="SUMMARY" show={!!data.summary.valueProposition}><SummaryBody data={data} theme={theme} /></Section>
          <Section title="SKILLS" show={hasSkills(data)}><SkillsBody data={data} theme={theme} /></Section>
          <Section title="EXPERIENCE" show={data.work.length > 0}><ExperienceBody data={data} theme={theme} /></Section>
          <Section title="EDUCATION" show={data.education.length > 0}><EducationBody data={data} theme={theme} /></Section>
          {ALL_SIMPLE.map(({ key, title }) => (
            <Section key={key} title={title} show={(data[key] as unknown[]).length > 0}>
              <SimpleSection items={data[key] as any} theme={theme} />
            </Section>
          ))}
        </View>
      </Page>
    </Document>
  );
}
