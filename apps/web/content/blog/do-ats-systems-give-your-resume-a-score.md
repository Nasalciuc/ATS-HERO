---
title: Do ATS systems give your resume a score?
description: "Not on their own: without a job post, an ATS only reads your CV into a profile. Where real ATS scores come from, what recruiters see, and what our lab measured."
dek: Not on their own. Without a job post, an ATS only reads your CV into a profile. Scores exist only against one job, and most are categories, not percentages.
topic: how-ats-works
cover: score
author: vladimir-nasalciuc
publishedAt: 2026-11-23
updatedAt: 2026-11-23
checkedAt: 2026-11-01

shortAnswer:
  - lead: No score without a job post.
    text: The ATS reads your CV into a profile that recruiters search.
  - lead: Scores exist only against one job,
    text: and most are categories such as “Strong Match” or a grade from A to D, not percentages.
  - lead: "What hurts is a profile read wrong:"
    text: skills run into your job title, dates go missing, or the file is too big to parse (over 2.5 MB in Greenhouse).

levels:
  critical:
    meaning: The profile may come out badly wrong.
    example: no email and no phone, or dates set in columns.
  major:
    meaning: Part of the profile comes out wrong or mixed up.
    example: the name isn't found, or sections have no title.
  missing:
    meaning: A field the profile should have is empty.
    example: a job without a company.
  tip:
    meaning: Nothing is lost, but it's worth changing.
    example: a separate references section.

atsScores:
  - ats: Workday HiredScore
    kind: grades
    shows: [A, B, C, D]
    note: and “met” or “not met” for each requirement
    comparedWith: the job's required and preferred qualifications
  - ats: Greenhouse
    kind: levels
    shows: [Strong Match, Good, Partial, Limited]
    note: one match level per candidate, which the recruiter can change
    comparedWith: the criteria the recruiter sets
  - ats: SmartRecruiters
    kind: stars
    filled: 3
    of: 4
    note: 1 to 4 stars
    comparedWith: the job's requirements
  - ats: iCIMS
    kind: label
    shows: [Job Fit]
    note: which isn't absolute and shifts as new candidates apply
    comparedWith: the job's title, description and requirements

titleFilter:
  parsed: Data Analyst Python, SQL
  issue: "Major issue: skills ran into the title"
  filter: Job title is “Data Analyst”
  result: This profile doesn't match
  caption: An exact filter on the title misses a profile whose title was read wrong.

lab:
  date: 2026-11-13
  results:
    - passed: 79
      runs: 80
      label: one-column PDF runs passed
    - passed: 30
      runs: 30
      label: Word (.docx) runs passed
    - passed: 18
      runs: 40
      label: two-column PDF runs passed; 21 had warnings, 1 failed
  note: A run is one CV through one text reader. Pass, warning and fail are our lab's own thresholds.

faq:
  - q: Is there such a thing as an ATS score?
    a: Not from the ATS itself. Resume parsers such as Textkernel and RChilli can flag problems on four levels, with no number. A score appears only when an ATS compares you with a specific job, usually as a category such as “Strong Match” or a grade from A to D.
  - q: Will an ATS reject my CV automatically?
    a: Rarely on the CV alone. Greenhouse says its matching “does not automatically advance or reject candidates”. The automatic rejections that are documented come from the application form's knockout questions, such as a work permit, a location or a licence.
  - q: Should I send a PDF or a Word file?
    a: Either works if it has one column. In our lab, one-column PDFs from our templates passed 79 of 80 runs and Word files 30 of 30. Some parsers flag every PDF as a major issue, so if a site accepts .docx, it's the safest.
  - q: Where does “75% of resumes are rejected by an ATS” come from?
    a: We found no source that can be checked. In a small 2025 study by Enhancv (25 US recruiters), 92% said their ATS doesn't reject CVs on its own for their format, keywords or an AI score, and 68% said the 75% figure comes from posts on LinkedIn and TikTok.

sources:
  - title: "Greenhouse Support: Talent Matching"
    url: https://support.greenhouse.io/hc/en-us/articles/41396009937307-Talent-Matching
  - title: "Greenhouse Support: Unsuccessful resume parse"
    url: https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse
  - title: "Workday HiredScore: Candidate grades"
    url: https://doc.workday.com/hiredscore/en-us/workday-hiredscore/recruiter-productivity-/reference--candidate-grades.html
  - title: "SAP Learning: Introducing Winston Match (SmartRecruiters)"
    url: https://learning.sap.com/courses/smartrecruiters-for-sap-successfactors-academy/introducing-winston-match
  - title: "iCIMS: Winter Release 2021, Talent Cloud AI"
    url: https://community.icims.com/articles/Knowledge/Release-Notes-Winter-Release-2021-iCIMS-Talent-Cloud-AI
  - title: "Textkernel: Resume parser output (Resume Quality)"
    url: https://developer.textkernel.com/tx-platform/v10/resume-parser/overview/parser-output
  - title: "RChilli: Resume Quality"
    url: https://docs.rchilli.com/kc/c_Rchilli_resume_parser_resume_quality.html
  - title: "SmartRecruiters: Subprocessors"
    url: https://www.smartrecruiters.com/legal/subprocessors
  - title: "iCIMS: Subprocessors"
    url: https://www.icims.com/subprocessors/
  - title: "Oracle Taleo: Candidate prescreening"
    url: https://docs.oracle.com/en/cloud/saas/taleo-enterprise/20b/otrec/candidate-prescreening.html
  - title: "LinkedIn: Manage applicants"
    url: https://business.linkedin.com/talent-solutions/cx/jobs-101/manage-applicants
  - title: "Enhancv: Resume checker"
    url: https://enhancv.com/resources/resume-checker/
  - title: "IT Brief UK: Study reveals ATS rarely auto-rejects CVs"
    url: https://itbrief.co.uk/story/study-reveals-ats-rarely-auto-rejects-cvs-debunks-75-myth
---

Search for “ATS score” and you'll find dozens of tools that grade a CV out of 100. The ATSs themselves work differently, and their own documentation says how. Here is what an ATS does with your CV, where scores really come from, and what our lab measured.

```blog-short-answer
```

## What an ATS does with your CV when there's no job

Every ATS starts the same way: it turns your file into text, the text into fields, and the fields into a candidate profile. Recruiters then search and filter those fields: titles, companies, dates, skills, degrees.

```blog-steps
```

Many ATSs don't write that parser themselves: Lever and SmartRecruiters use Textkernel, and iCIMS uses Daxtra. Textkernel and RChilli can also check a CV on its own, with no job, and what they return is telling: findings on four levels, with no number at all.

```blog-levels
```

## Scores exist only against one job

Every score we found in a real ATS compares your CV with one specific job post. Without a post there is nothing to rank you against: Workday's HiredScore doesn't grade a candidate at all when the post has no description.

```blog-ats-scores
```

Most show a category, not a percentage, and most explain it requirement by requirement. That is the part worth copying: which of the job's requirements your CV shows, and which it doesn't. Our [Job Fit check](/app/jobfit) works the same way, with no percentage.

## What actually filters people out

Greenhouse says plainly that its matching “does not automatically advance or reject candidates”. The automatic rejections that are documented come from the application form: knockout questions about a work permit, a location or a licence. Oracle Taleo can screen a candidate out on such an answer, and LinkedIn sends a rejection on its own only when the post has screening questions.

> There's no such thing as an ATS score.
>
> — Enhancv, on the page of its own resume checker

The other filter is the recruiter's search. If a parser files your title as “Data Analyst Python, SQL” because a sidebar ran into it, a recruiter who filters by the title “Data Analyst” may never see you.

```blog-title-filter
```

## What our lab found

Our lab renders CVs from our templates, reads them with the kind of text readers ATS parsers start from, and checks every field against what was typed. The latest run:

```blog-lab
```

So for our templates, the layout mattered more than the file type: one column read cleanly as PDF or Word; two columns did not.

```blog-cta
```
