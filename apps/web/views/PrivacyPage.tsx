// The privacy policy, told the way the product works: the four moments when ATS Hero touches
// your data (drawn like the builder's stepper), what we never do, then the legal details.
//
// Every statement here was checked against the code (storage keys, tables, cron, deletion, logs,
// third parties in next.config.ts). When data handling changes — a new provider, AI rewriting,
// payments, another storage key, a different retention — change this page in the same commit
// (AGENTS.md, rule 11, "Privacy page").
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BlockIcon, CvFileIcon, GraphBarIcon, ScanIcon } from "@/components/figma-icons";
import { GUEST_RETENTION_DAYS } from "@/lib/retention";
import { RATE_LIMIT_WINDOW_MS } from "@/lib/ratelimit";

/** The date the content last changed. Change it with the content, never compute it. */
export const PRIVACY_UPDATED = { iso: "2026-10-15", label: "15 October 2026" };

/** Who runs ATS Hero. Fill in before the page goes live; until then the gaps show on the page. */
const OPERATOR = {
  name: "[FILL: operator’s legal name]",
  address: "[FILL: registered address], Republic of Moldova",
};

const EMAIL = "privacy@atshero.app";
const RATE_SECONDS = RATE_LIMIT_WINDOW_MS / 1000;

const stats = [
  { Icon: GraphBarIcon, size: 27, num: "0 trackers", desc: "no ads, no analytics, no tracking pixels" },
  { Icon: CvFileIcon, size: 32, num: `${GUEST_RETENTION_DAYS} days`, desc: "then a guest CV is deleted on its own" },
  { Icon: ScanIcon, size: 32, num: "0 uploads", desc: "files you check stay in your browser" },
];

type Step = { emoji: string; title: string; points: string[]; keep: string; note?: string };

const journey: Step[] = [
  {
    emoji: "🌐",
    title: "You open the site",
    points: [
      "Visiting without an account puts nothing in our database. There are no analytics, ads or tracking pixels.",
      "Our host, Vercel, sees your IP address and browser in its request logs, to deliver the page and stop attacks.",
      "Clerk, our sign-in service, loads on every page to check whether you’re signed in, so it sees your IP address and browser too.",
      `Requests that read or change your data are counted per IP address (and account) for ${RATE_SECONDS} seconds, in our server’s memory only, to stop abuse.`,
    ],
    keep: "Request logs: up to 1 day",
  },
  {
    emoji: "📝",
    title: "You build a CV as a guest",
    points: [
      "The first time you open the app, your browser gets a random guest code, and your CVs are saved under it.",
      "What you type in the builder is saved to our database as you go.",
      "A file or text you check in Improve My Resume or Check Job Fit is read inside your browser and never uploaded.",
      "PDF and Word downloads are made in your browser too.",
    ],
    keep: `Guest CVs: deleted ${GUEST_RETENTION_DAYS} days after your last edit`,
    note: "The next person who signs in on this browser gets these CVs. Sign in first, or delete your CV when you finish.",
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
    keep: "Kept until you delete it",
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
    keep: "Backups: gone within 30 days",
  },
];

const nevers = [
  { title: "We don’t sell or rent your data.", text: "Not to recruiters, not to advertisers, not to anyone." },
  { title: "No ads, no analytics, no tracking pixels.", text: "The only cookies are the ones sign-in needs." },
  { title: "Your CV doesn’t go to AI services.", text: "If we add AI rewriting, we’ll update this page before it’s switched on." },
  { title: "No payments during the free beta.", text: "Before we charge for anything, we’ll name our payment provider here." },
];

const sections = [
  { id: "who", title: "Who is responsible" },
  { id: "why", title: "What we use it for, and why we may" },
  { id: "providers", title: "Who else handles it" },
  { id: "transfers", title: "Transfers outside your country" },
  { id: "retention", title: "How long we keep it" },
  { id: "storage", title: "Cookies and browser storage" },
  { id: "rights", title: "Your rights" },
  { id: "children", title: "Children" },
  { id: "changes", title: "Changes to this policy" },
];

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="privacy-table">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, i) => (
              <td key={i} data-label={head[i]}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Everything between the navbar and the footer (rendered on its own in tests). */
export function PrivacyContent() {
  return (
    <main className="privacy">
      <section className="privacy-hero">
        <div className="container privacy-hero__grid">
          <div>
            <p className="privacy-hero__badge">
              <span className="privacy-hero__dot" aria-hidden="true" />
              <span>
                Privacy Policy · updated <time dateTime={PRIVACY_UPDATED.iso}>{PRIVACY_UPDATED.label}</time>
              </span>
            </p>
            <h1 className="privacy-hero__title">
              <span className="sel-text">
                <span className="sel-line">
                  <i className="sel-caret sel-caret--start" aria-hidden="true" />
                  What we keep about you,{" "}
                </span>
                <span className="sel-line">
                  where, and for how long
                  <i className="sel-caret sel-caret--end" aria-hidden="true" />
                </span>
              </span>
            </h1>
            <p className="privacy-hero__lead">
              ATS Hero is a CV builder, so it has to store your CV. Below is exactly what that means at each step,
              in plain words. The legal details follow.
            </p>
          </div>
          <aside className="privacy-hero__card" aria-label="At a glance">
            <ul className="privacy-hero__stats">
              {stats.map(({ Icon, size, num, desc }) => (
                <li className="stat" key={num}>
                  <div className="stat__icon">
                    <Icon size={size} />
                  </div>
                  <div className="stat__body">
                    <div className="stat__num">{num}</div>
                    <div className="stat__desc">{desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="privacy-journey" aria-labelledby="journey-title">
        <div className="container">
          <h2 className="privacy-section-title" id="journey-title">
            Your data, step by step
          </h2>
          <ol className="privacy-journey__steps">
            {journey.map((step, i) => (
              <li className="pj-step" key={step.title}>
                <div className="pj-step__head">
                  <span className="pj-step__node" aria-hidden="true">
                    <span className="pj-step__emoji">{step.emoji}</span>
                  </span>
                  <span className="pj-step__num">Step {i + 1}</span>
                  <h3 className="pj-step__title">{step.title}</h3>
                </div>
                <div className="pj-step__card">
                  <ul className="pj-step__points">
                    {step.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  {step.note && (
                    <p className="pj-step__note">
                      <b>Shared computer?</b> {step.note}
                    </p>
                  )}
                  <p className="pj-step__keep">
                    <span className="pj-step__keep-dot" aria-hidden="true" />
                    {step.keep}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="privacy-never" aria-labelledby="never-title">
        <div className="container">
          <h2 className="privacy-section-title privacy-section-title--light" id="never-title">
            What we don’t do
          </h2>
          <ul className="privacy-never__grid">
            {nevers.map((n) => (
              <li className="privacy-never__item" key={n.title}>
                <BlockIcon className="privacy-never__icon" />
                <div>
                  <p className="privacy-never__title">{n.title}</p>
                  <p className="privacy-never__text">{n.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="privacy-details" aria-labelledby="details-title">
        <div className="container privacy-details__grid">
          <nav className="privacy-toc" aria-labelledby="details-title">
            <h2 className="privacy-toc__title" id="details-title">
              The legal details
            </h2>
            <ol className="privacy-toc__list">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="privacy-details__body">
            <section className="privacy-block" id="who">
              <h2>Who is responsible</h2>
              <p>
                ATS Hero is run by {OPERATOR.name}, {OPERATOR.address}. We decide what happens to your data, which
                makes us its controller. Write to us at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
              </p>
              <p>
                We follow Moldova’s Law No. 195/2024 on personal data protection and, for people in the European
                Union and the European Economic Area, the General Data Protection Regulation (GDPR).
              </p>
            </section>

            <section className="privacy-block" id="why">
              <h2>What we use it for, and why we may</h2>
              <Table
                head={["What we do", "With which data", "Why we may"]}
                rows={[
                  ["Save and show your CVs, as a guest or signed in", "What you type in the builder, your guest code, CV IDs", "You asked us to (our agreement with you)"],
                  ["Your account and sign-in", "Email address, Clerk ID, the date you joined, sometimes your name", "Our agreement with you"],
                  ["The job tracker", "What you enter in it", "Our agreement with you"],
                  ["Keep the service safe and working: request logs, sign-in checks, rate limits, the bot check", "IP address, browser, guest code, account and CV IDs", "Our legitimate interest in a service that works and isn’t abused"],
                  ["Backups", "Everything in our database", "Our legitimate interest in not losing your work"],
                ]}
              />
              <p>We don’t use your data for advertising, and nothing on ATS Hero makes automated decisions about you.</p>
            </section>

            <section className="privacy-block" id="providers">
              <h2>Who else handles it</h2>
              <p>These companies process data for us, only to run ATS Hero:</p>
              <Table
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
            </section>

            <section className="privacy-block" id="transfers">
              <h2>Transfers outside your country</h2>
              <p>
                Vercel, Amazon Web Services, Clerk and Cloudflare are based in the United States, so your data
                leaves Moldova and the EU. Their data processing terms include the European Commission’s Standard
                Contractual Clauses, which protect data sent from the EU.
              </p>
            </section>

            <section className="privacy-block" id="retention">
              <h2>How long we keep it</h2>
              <Table
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
            </section>

            <section className="privacy-block" id="storage">
              <h2>Cookies and browser storage</h2>
              <Table
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
            </section>

            <section className="privacy-block" id="rights">
              <h2>Your rights</h2>
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
              <div className="privacy-actions">
                <a className="btn btn--dark" href="/app">
                  Open Your CVs
                </a>
                <a className="btn btn--outline-dark" href={`mailto:${EMAIL}`}>
                  Email {EMAIL}
                </a>
              </div>
            </section>

            <section className="privacy-block" id="children">
              <h2>Children</h2>
              <p>
                ATS Hero is for people aged 16 and over. If you think a child under 16 has given us data, email us
                and we will delete it.
              </p>
            </section>

            <section className="privacy-block" id="changes">
              <h2>Changes to this policy</h2>
              <p>
                When this policy changes, we update the date at the top. If a change affects what happens to your
                CV, for example a new company that would see it, we say so on the site before it takes effect.
              </p>
            </section>
          </div>
        </div>
      </section>
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
