// The privacy policy, told the way the product works: the four moments when ATS Hero touches
// your data (drawn like the builder's stepper), what we never do, then the legal details.
//
// Every statement here was checked against the code (storage keys, tables, cron, deletion, logs,
// third parties in next.config.ts). When data handling changes — a new provider, AI rewriting,
// payments, another storage key, a different retention — change this page in the same commit
// (AGENTS.md, rule 11, "Privacy page").
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CookieSettingsButton from "@/components/CookieSettingsButton";
import { CvFileIcon, GraphBarIcon, ScanIcon } from "@/components/figma-icons";
import {
  LegalBand,
  LegalDetails,
  LegalHero,
  LegalSteps,
  LegalTable,
  type LegalSection,
  type LegalStat,
  type LegalStep,
} from "@/components/legal/LegalLayout";
import { OPERATOR, PRIVACY_EMAIL as EMAIL, type LegalDate } from "@/lib/legal";
import { GUEST_RETENTION_DAYS } from "@/lib/retention";
import { RATE_LIMIT_WINDOW_MS } from "@/lib/ratelimit";

/** The date the content last changed. Change it with the content, never compute it. */
export const PRIVACY_UPDATED: LegalDate = { iso: "2026-10-15", label: "15 October 2026" };

const RATE_SECONDS = RATE_LIMIT_WINDOW_MS / 1000;

const stats: LegalStat[] = [
  { Icon: GraphBarIcon, size: 27, num: "0 trackers", desc: "no ads, no analytics, no tracking pixels" },
  { Icon: CvFileIcon, size: 32, num: `${GUEST_RETENTION_DAYS} days`, desc: "then a guest CV is deleted on its own" },
  { Icon: ScanIcon, size: 32, num: "0 uploads", desc: "files you check stay in your browser" },
];

const journey: LegalStep[] = [
  {
    emoji: "🌐",
    title: "You open the site",
    points: [
      "Visiting without an account puts nothing in our database. There are no analytics, ads or tracking pixels.",
      "Our host, Vercel, sees your IP address and browser in its request logs, to deliver the page and stop attacks.",
      "Clerk, our sign-in service, loads on every page to check whether you’re signed in, so it sees your IP address and browser too.",
      `Requests that read or change your data are counted per IP address (and account) for ${RATE_SECONDS} seconds, in our server’s memory only, to stop abuse.`,
    ],
    tag: "Request logs: up to 1 day",
  },
  {
    emoji: "📝",
    title: "You build a CV as a guest",
    points: [
      "The first time you open the app, your browser gets a random guest code, and your CVs are saved under it.",
      "What you type in the builder is saved to our database as you go, with your photo if you add one: a small copy made in your browser, not the original file.",
      "A CV you check (on the home page, in Improve My Resume or in Check Job Fit) is read inside your browser and never uploaded, whether it is a PDF, a Word file or text.",
      "PDF and Word downloads are made in your browser too.",
    ],
    tag: `Guest CVs: deleted ${GUEST_RETENTION_DAYS} days after your last edit`,
    note: {
      lead: "Shared computer?",
      text: "The next person who signs in on this browser gets these CVs. Sign in first, or delete your CV when you finish.",
    },
  },
  {
    emoji: "🔑",
    title: "You sign in",
    points: [
      "Clerk runs the sign-in: an email code, or your Google or GitHub account. Cloudflare checks that you aren’t a bot.",
      "We keep your Clerk ID, your email address, the date you joined and sometimes the name on your account. Your guest CVs move into your account.",
      "If you use the job tracker, we keep what you enter (company, role, link, status and notes) and the date you added it.",
      "Our logs hold technical IDs (account, CV, guest code) and error messages, never what your CV says.",
    ],
    tag: "Kept until you delete it",
  },
  {
    emoji: "🗑️",
    title: "You delete your account",
    points: [
      "On a computer: Your CVs → type DELETE → Delete my account. Your CVs, tracker entries and account go at once, here and at Clerk.",
      `On a phone, or if something fails: email ${EMAIL} from your account’s address. We delete within 30 days.`,
      "Backups roll over: daily ones are deleted after 14 days, and the copy we take before a database update within 30 days.",
      `Your browser keeps its guest code until you clear this site’s data. Guest CVs left under it go after ${GUEST_RETENTION_DAYS} days.`,
    ],
    tag: "Backups: gone within 30 days",
  },
];

const nevers = [
  { title: "We don’t sell or rent your data.", text: "Not to recruiters, not to advertisers, not to anyone." },
  { title: "No ads, no analytics, no tracking pixels.", text: "The only cookies are the ones sign-in needs." },
  { title: "Your CV doesn’t go to AI services.", text: "If we add AI rewriting, we’ll update this page before it’s switched on." },
  { title: "No payments during the free beta.", text: "Before we charge for anything, we’ll name our payment provider here." },
];

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who is responsible",
    body: (
      <>
        <p>
          ATS Hero is run by {OPERATOR.name}, {OPERATOR.address}. We decide what happens to your data, which
          makes us its controller. Write to us at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
        <p>
          We follow Moldova’s Law No. 195/2024 on personal data protection and, for people in the European
          Union and the European Economic Area, the General Data Protection Regulation (GDPR).
        </p>
      </>
    ),
  },
  {
    id: "why",
    title: "What we use it for, and why we may",
    body: (
      <>
        <LegalTable
          head={["What we do", "With which data", "Why we may"]}
          rows={[
            ["Save and show your CVs, as a guest or signed in", "What you type in the builder, your photo if you add one, your guest code, CV IDs", "You asked us to (our agreement with you)"],
            ["Your account and sign-in", "Email address, Clerk ID, the date you joined, sometimes your name", "Our agreement with you"],
            ["The job tracker", "What you enter in it", "Our agreement with you"],
            ["Keep the service safe and working: request logs, sign-in checks, rate limits, the bot check", "IP address, browser, guest code, account and CV IDs", "Our legitimate interest in a service that works and isn’t abused"],
            ["Backups", "Everything in our database", "Our legitimate interest in not losing your work"],
          ]}
        />
        <p>We don’t use your data for advertising, and nothing on ATS Hero makes automated decisions about you.</p>
      </>
    ),
  },
  {
    id: "providers",
    title: "Who else handles it",
    body: (
      <>
        <p>These companies process data for us, only to run ATS Hero:</p>
        <LegalTable
          head={["Company", "What it does for us", "Where"]}
          rows={[
            ["Vercel Inc.", "Hosts the site and runs our server code", "United States, with a worldwide network that delivers the pages"],
            ["Amazon Web Services", "Our database and its backups", "United States (N. Virginia)"],
            ["Clerk, Inc.", "Sign-in and accounts; checks on every page whether you’re signed in", "United States"],
            ["Cloudflare, Inc.", "Protects Clerk’s service and runs the bot check at sign-in", "Worldwide"],
          ]}
        />
        <p>
          If you sign in with Google or GitHub, that company shares your email address (and, if your account
          has them, your name and photo) with Clerk. Their own privacy policies apply to what they keep.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "Transfers outside your country",
    body: (
      <p>
        Vercel, Amazon Web Services, Clerk and Cloudflare are based in the United States, so your data
        leaves Moldova and the EU. Their data processing terms include the European Commission’s Standard
        Contractual Clauses, which protect data sent from the EU.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <LegalTable
        head={["Data", "Kept"]}
        rows={[
          ["Guest CVs", `${GUEST_RETENTION_DAYS} days after your last edit`],
          ["Your account, CVs and tracker entries", "Until you delete them or your account"],
          ["Database backups", "Daily backups: 14 days. The copy taken before a database update: up to 30 days"],
          ["Server logs at Vercel (requests, errors)", "Up to 1 day"],
          ["Database logs (slow queries, errors), without what your CV says", "3 days"],
          ["Rate-limit counters", `In our server’s memory only, never saved; each count runs for ${RATE_SECONDS} seconds`],
          ["What you check in Improve My Resume or Check Job Fit", "In your browser tab, until you close it"],
        ]}
      />
    ),
  },
  {
    id: "storage",
    title: "Cookies and browser storage",
    body: (
      <>
        <LegalTable
          head={["Name", "Where", "What it does"]}
          rows={[
            ["__session, __client_uat and Clerk’s other cookies and storage", "Set by Clerk", "Tell the site whether you’re signed in, and keep you signed in"],
            ["_cfuvid", "Cookie set by Cloudflare, for Clerk", "Protects sign-in from abuse"],
            ["ats_hero_guest_id", "Your browser’s local storage", "Links guest CVs to this browser"],
            ["ats_hero_cv_id", "Local storage", "Reopens the CV you were editing"],
            ["ats_text, ats_jd and the other ats_ keys", "Session storage", "Hold what you check in Improve My Resume and Check Job Fit, and its score, until you close the tab"],
          ]}
        />
        <p>
          All of them are needed for the site to work, which is why there is no cookie banner. We set no
          advertising or analytics cookies.
        </p>
        <CookieSettingsButton />
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>
          You can ask to see, correct, delete or take a copy of your data, to restrict how we use it, or to
          object to how we use it. Most of it you can do yourself: edit any CV, download it as PDF or Word,
          delete a CV or your whole account. For anything else, email us from your account’s address and we
          will answer within 30 days.
        </p>
        <p>
          If you think we got something wrong, you can complain to Moldova’s National Center for Personal
          Data Protection (
          <a href="https://datepersonale.md" rel="noopener noreferrer" target="_blank">
            datepersonale.md
          </a>
          ) or, in the EU and EEA, to your local data protection authority.
        </p>
        <div className="legal-actions">
          <a className="btn btn--dark" href="/app">
            Open Your CVs
          </a>
          <a className="btn btn--outline-dark" href={`mailto:${EMAIL}`}>
            Email {EMAIL}
          </a>
        </div>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        ATS Hero is for people aged 16 and over. If you think a child under 16 has given us data, email us
        and we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        When this policy changes, we update the date at the top. If a change affects what happens to your
        CV, for example a new company that would see it, we say so on the site before it takes effect.
      </p>
    ),
  },
];

/** Everything between the navbar and the footer (rendered on its own in tests). */
export function PrivacyContent() {
  return (
    <main className="legal-page">
      <LegalHero
        name="Privacy Policy"
        updated={PRIVACY_UPDATED}
        title={["What we keep about you,", "where, and for how long"]}
        lead="ATS Hero is a CV builder, so it has to store your CV. Below is exactly what that means at each step, in plain words. The legal details follow."
        stats={stats}
      />
      <LegalSteps id="journey-title" title="Your data, step by step" steps={journey} />
      <LegalBand id="never-title" title="What we don’t do" items={nevers} />
      <LegalDetails id="details-title" title="The legal details" sections={sections} />
    </main>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <PrivacyContent />
      <Footer />
    </>
  );
}
