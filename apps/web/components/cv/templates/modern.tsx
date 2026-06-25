// Modern — two-column with a solid colored sidebar (photo + contact + skills + languages),
// like Reactive Resume's Gengar. A fixed sidebar background repeats on every page.
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/types";
import { FONT, FONT_BOLD, type TemplateTheme } from "./theme";
import {
  Avatar, ContactBar, SectionHeading, SummaryBody, ExperienceBody, EducationBody,
  SimpleSection, ALL_SIMPLE, GAP,
} from "./shared";

const SIDEBAR_W = "34%";

const st = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: 10, lineHeight: 1.45 },
  sidebarBg: { position: "absolute", top: 0, left: 0, bottom: 0, width: SIDEBAR_W },
  row: { flexDirection: "row" },
  sidebar: { width: SIDEBAR_W, paddingVertical: 30, paddingHorizontal: 18 },
  main: { width: "66%", paddingVertical: 30, paddingHorizontal: 24 },
  name: { fontSize: 17, fontFamily: FONT_BOLD, marginTop: 12, lineHeight: 1.25 },
  role: { fontSize: 11, marginTop: 4 },
  sideBlock: { marginTop: 16 },
  section: { marginBottom: GAP.section },
});

export default function ModernTemplate({ data, theme }: { data: CvData; theme: TemplateTheme }) {
  const p = data.personalInfo;
  const white = theme.onPrimary;

  const SideBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={st.sideBlock}>
      <SectionHeading title={title} theme={theme} variant="onPrimary" />
      {children}
    </View>
  );
  const Section = ({ title, children, show }: { title: string; children: React.ReactNode; show: boolean }) =>
    show ? <View style={st.section}><SectionHeading title={title} theme={theme} variant="primary" />{children}</View> : null;

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

            <ContactBar p={p} theme={theme} color={white} direction="column" />

            {data.skills.length > 0 ? (
              <SideBlock title="SKILLS"><Text style={{ color: white }}>{data.skills.join(", ")}</Text></SideBlock>
            ) : null}
            {data.instruments.length > 0 ? (
              <SideBlock title="TOOLS"><Text style={{ color: white }}>{data.instruments.join(", ")}</Text></SideBlock>
            ) : null}
            {data.softSkills.length > 0 ? (
              <SideBlock title="SOFT SKILLS"><Text style={{ color: white }}>{data.softSkills.join(", ")}</Text></SideBlock>
            ) : null}
            {data.languages.length > 0 ? (
              <SideBlock title="LANGUAGES">
                {data.languages.map((l) => (
                  <Text key={l.id} style={{ color: white, marginBottom: 2 }}>{l.name} <Text style={{ color: white, opacity: 0.8 }}>({l.level})</Text></Text>
                ))}
              </SideBlock>
            ) : null}
          </View>

          {/* Main */}
          <View style={st.main}>
            <Section title="SUMMARY" show={!!data.summary.valueProposition}><SummaryBody data={data} theme={theme} /></Section>
            <Section title="EXPERIENCE" show={data.work.length > 0}><ExperienceBody data={data} theme={theme} /></Section>
            <Section title="EDUCATION" show={data.education.length > 0}><EducationBody data={data} theme={theme} /></Section>
            {ALL_SIMPLE.map(({ key, title }) => (
              <Section key={key} title={title} show={(data[key] as unknown[]).length > 0}>
                <SimpleSection items={data[key] as any} theme={theme} />
              </Section>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
