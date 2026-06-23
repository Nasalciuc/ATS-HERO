import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { CvData, SimpleEntry } from "../../lib/types";

// Section-bar accent per chosen style (mirrors CvDocument.tsx / Figma tokens).
const ACCENTS: Record<number, string> = {
  1: "#E6E1FF",
  2: "#D6F7E2",
  3: "#E3E2E2",
  4: "#FFE9D6",
  5: "#DCE9FF",
  6: "#F6D6E8",
};

const styles = StyleSheet.create({
  page: {
    paddingVertical: 36,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#2E2E2E",
    lineHeight: 1.4,
  },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold" },
  role: { fontSize: 12, color: "#555555", marginTop: 2 },
  contact: { fontSize: 9, color: "#555555", marginTop: 3 },
  bar: {
    marginTop: 16,
    marginBottom: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    color: "#2E2E2E",
  },
  para: { marginBottom: 2 },
  block: { marginBottom: 8 },
  itemTitle: { fontFamily: "Helvetica-Bold" },
  itemMeta: { color: "#666666", fontSize: 9, marginBottom: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
});

function dateRange(start?: string, end?: string, ongoing?: boolean): string {
  const finish = ongoing ? "Present" : end;
  return [start, finish].filter(Boolean).join(" – ");
}

export default function CvPdfDocument({
  data,
  styleId = 1,
}: {
  data: CvData;
  styleId?: number;
}) {
  const accent = ACCENTS[styleId] ?? ACCENTS[1];
  const p = data.personalInfo;
  const contactLine1 = [p.cityState || p.country, p.email, p.phone].filter(Boolean).join("   ·   ");
  const contactLine2 = [p.linkedin, p.website].filter(Boolean).join("   ·   ");

  const hasSkills =
    data.skills.length > 0 ||
    data.instruments.length > 0 ||
    data.softSkills.length > 0 ||
    data.languages.length > 0;

  const renderSimple = (items: SimpleEntry[], title: string) => {
    if (items.length === 0) return null;
    return (
      <View>
        <Text style={[styles.bar, { backgroundColor: accent }]}>{title}</Text>
        {items.map((it) => {
          const meta = [it.organisation || it.issuer || it.publisher, it.date]
            .filter(Boolean)
            .join("  ·  ");
          return (
            <View key={it.id} style={styles.block}>
              <Text style={styles.itemTitle}>{it.title || it.role || "—"}</Text>
              {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
              {it.description ? <Text>{it.description}</Text> : null}
              {it.link ? <Text style={styles.itemMeta}>{it.link}</Text> : null}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <Document
      title={`${p.name || "Resume"} — CV`}
      author={p.name || "ATS Hero"}
      creator="ATS Hero"
      producer="ATS Hero"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{p.name || "Your Name"}</Text>
        {data.summary.position ? <Text style={styles.role}>{data.summary.position}</Text> : null}
        {contactLine1 ? <Text style={styles.contact}>{contactLine1}</Text> : null}
        {contactLine2 ? <Text style={styles.contact}>{contactLine2}</Text> : null}

        {data.summary.valueProposition ? (
          <View>
            <Text style={[styles.bar, { backgroundColor: accent }]}>SUMMARY</Text>
            <Text style={styles.para}>{data.summary.valueProposition}</Text>
          </View>
        ) : null}

        {hasSkills ? (
          <View>
            <Text style={[styles.bar, { backgroundColor: accent }]}>SKILLS</Text>
            {data.skills.length > 0 ? (
              <Text style={styles.para}>
                <Text style={styles.bold}>Hard skills: </Text>
                {data.skills.join(" · ")}
              </Text>
            ) : null}
            {data.instruments.length > 0 ? (
              <Text style={styles.para}>
                <Text style={styles.bold}>Tools: </Text>
                {data.instruments.join(" · ")}
              </Text>
            ) : null}
            {data.softSkills.length > 0 ? (
              <Text style={styles.para}>
                <Text style={styles.bold}>Soft skills: </Text>
                {data.softSkills.join(" · ")}
              </Text>
            ) : null}
            {data.languages.length > 0 ? (
              <Text style={styles.para}>
                <Text style={styles.bold}>Languages: </Text>
                {data.languages.map((l) => `${l.name} (${l.level})`).join(" · ")}
              </Text>
            ) : null}
          </View>
        ) : null}

        {data.work.length > 0 ? (
          <View>
            <Text style={[styles.bar, { backgroundColor: accent }]}>EXPERIENCE</Text>
            {data.work.map((w) => {
              const meta = [
                dateRange(w.startDate, w.endDate, w.current),
                [w.cityState, w.country].filter(Boolean).join(", "),
              ]
                .filter(Boolean)
                .join("  ·  ");
              return (
                <View key={w.id} style={styles.block}>
                  <Text style={styles.itemTitle}>{[w.role, w.company].filter(Boolean).join(", ")}</Text>
                  {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                  {w.description ? <Text>{w.description}</Text> : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {data.education.length > 0 ? (
          <View>
            <Text style={[styles.bar, { backgroundColor: accent }]}>EDUCATION</Text>
            {data.education.map((e) => {
              const meta = [
                dateRange(e.startDate, e.endDate),
                e.location,
                e.grade ? `Grade: ${e.grade}` : "",
              ]
                .filter(Boolean)
                .join("  ·  ");
              return (
                <View key={e.id} style={styles.block}>
                  <Text style={styles.itemTitle}>{[e.degree, e.institution].filter(Boolean).join(", ")}</Text>
                  {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                  {e.additional ? <Text>{e.additional}</Text> : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {renderSimple(data.awards, "AWARDS")}
        {renderSimple(data.certifications, "CERTIFICATIONS")}
        {renderSimple(data.publications, "PUBLICATIONS")}
        {renderSimple(data.volunteering, "VOLUNTEERING")}
        {renderSimple(data.activities, "RELEVANT ACTIVITIES")}
      </Page>
    </Document>
  );
}
