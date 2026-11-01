"""ATS lab — a small "foreign CV" corpus: layouts people send that our templates never produce
(contacts in the page header, experience in a table, a whole-page sidebar table, creative headings),
built with python-docx. One synthetic person, Elena Rusu (AGENTS.md rule 11: no real CVs here).

    python tools/ats-lab/corpus/make_corpus.py tools/ats-lab/out/corpus
    soffice --headless --convert-to pdf --outdir tools/ats-lab/out/corpus tools/ats-lab/out/corpus/*.docx

The files are generated, not committed (tools/ats-lab/out/ is ignored). `app.lab.parity` reads them.
"""
import sys

from docx import Document

out = sys.argv[1]
NAME, EMAIL, PHONE, LINK = "Elena Rusu", "elena.rusu@example.com", "+373 69 555 012", "linkedin.com/in/elena-rusu"
JOBS = [
    ("Senior Data Analyst", "Orange Moldova", "Mar 2021", "Present",
     ["Built Power BI dashboards used by 40 managers", "Cut monthly reporting time by 60% with Python and SQL"]),
    ("Data Analyst", "Moldcell", "Jun 2018", "Feb 2021",
     ["Automated churn analysis in Python", "Ran A/B tests on 3 tariff launches"]),
]
SKILLS = "Python, SQL, Power BI, Tableau, A/B testing, Excel"

def plain(doc):
    doc.add_heading("Experience", level=1)
    for t, c, s, e, bullets in JOBS:
        doc.add_paragraph(f"{t}, {c}, {s} – {e}")
        for b in bullets: doc.add_paragraph(b, style="List Bullet")
    doc.add_heading("Education", level=1)
    doc.add_paragraph("BSc Computer Science, Technical University of Moldova, 2014 – 2018")
    doc.add_heading("Skills", level=1)
    doc.add_paragraph(SKILLS)

# 1) one column, contacts in the body: the safe reference
d = Document(); d.add_heading(NAME, 0); d.add_paragraph(f"{EMAIL} | {PHONE} | {LINK}"); plain(d); d.save(f"{out}/w1-plain.docx")

# 2) name + contacts only in the PAGE HEADER (common in Word templates)
d = Document(); h = d.sections[0].header.paragraphs[0]; h.text = f"{NAME}\n{EMAIL} | {PHONE} | {LINK}"; plain(d); d.save(f"{out}/w2-header-contacts.docx")

# 3) experience laid out in a TABLE: dates in the left cell, title/company/bullets in the right cell
d = Document(); d.add_heading(NAME, 0); d.add_paragraph(f"{EMAIL} | {PHONE} | {LINK}")
d.add_heading("Experience", level=1)
tbl = d.add_table(rows=0, cols=2)
for t, c, s, e, bullets in JOBS:
    r = tbl.add_row().cells; r[0].text = f"{s} – {e}"; r[1].text = f"{t}\n{c}\n" + "\n".join("• " + b for b in bullets)
d.add_heading("Education", level=1); d.add_paragraph("BSc Computer Science, Technical University of Moldova, 2014 – 2018")
d.add_heading("Skills", level=1); d.add_paragraph(SKILLS); d.save(f"{out}/w3-table-experience.docx")

# 4) a two-column TABLE for the whole page (sidebar: contacts + skills; main: experience)
d = Document(); tbl = d.add_table(rows=1, cols=2); left, right = tbl.rows[0].cells
left.text = f"{NAME}\n{EMAIL}\n{PHONE}\n{LINK}\n\nSKILLS\n" + SKILLS.replace(", ", "\n")
right.text = "EXPERIENCE\n" + "\n".join(f"{t}, {c}\n{s} – {e}\n" + "\n".join("• " + b for b in bl) for t, c, s, e, bl in JOBS) + "\n\nEDUCATION\nBSc Computer Science, Technical University of Moldova, 2014 – 2018"
d.save(f"{out}/w4-sidebar-table.docx")

# 5) non-standard headings and dates ("Where I've worked", "Oct '21 – now")
d = Document(); d.add_heading(NAME, 0); d.add_paragraph(f"{EMAIL} | {PHONE} | {LINK}")
d.add_heading("Where I've made an impact", level=1)
d.add_paragraph("Senior Data Analyst @ Orange Moldova (Mar '21 – now)")
for b in JOBS[0][4]: d.add_paragraph(b, style="List Bullet")
d.add_paragraph("Data Analyst @ Moldcell ('18 – '21)")
for b in JOBS[1][4]: d.add_paragraph(b, style="List Bullet")
d.add_heading("What I know", level=1); d.add_paragraph(SKILLS)
d.add_heading("Learning", level=1); d.add_paragraph("Technical University of Moldova — Computer Science")
d.save(f"{out}/w5-creative-headings.docx")
print("ok")
