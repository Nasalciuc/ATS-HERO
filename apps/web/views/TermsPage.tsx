// The terms, told the way the product works, like the Privacy Policy: four moments of using ATS
// Hero, what we ask of you, then the legal details.
//
// They describe ATS Hero as it is today: free, no AI, no job search. When payments, AI features or
// job search start, change this page and TERMS_UPDATED in the same commit (AGENTS.md, rule 11,
// "Terms page"). No payment provider is named until one is chosen.
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CvFileIcon, FileDownloadIcon, UserRoundIcon } from "@/components/figma-icons";
import {
  LegalBand,
  LegalDetails,
  LegalHero,
  LegalSteps,
  type LegalSection,
  type LegalStat,
  type LegalStep,
} from "@/components/legal/LegalLayout";
import { OPERATOR, PRIVACY_EMAIL, SUPPORT_EMAIL, type LegalDate } from "@/lib/legal";
import { GUEST_RETENTION_DAYS } from "@/lib/retention";

/** The date the content last changed. Change it with the content, never compute it. */
export const TERMS_UPDATED: LegalDate = { iso: "2026-10-17", label: "17 October 2026" };

const DELETE_STEPS = "Your CVs → type DELETE → Delete my account";

const stats: LegalStat[] = [
  { Icon: FileDownloadIcon, size: 32, num: "$0", desc: "to build, check and download CVs in the beta" },
  { Icon: UserRoundIcon, size: 32, num: "16+", desc: "the age to use ATS Hero" },
  { Icon: CvFileIcon, size: 32, num: `${GUEST_RETENTION_DAYS} days`, desc: "then a guest CV is deleted on its own" },
];

const steps: LegalStep[] = [
  {
    emoji: "👋",
    title: "You try it as a guest",
    points: [
      "Building, scoring and downloading CVs is free and needs no account.",
      "Your CVs are saved under a guest code in this browser. The next person who signs in on this browser gets them.",
      `A guest CV is deleted ${GUEST_RETENTION_DAYS} days after its last edit.`,
    ],
    tag: "Free during the beta",
  },
  {
    emoji: "📝",
    title: "You build and check your CV",
    points: [
      "The score is our estimate of how applicant tracking systems read a CV. It isn’t any employer’s decision.",
      "Scores and tips are guidance: they can’t promise you an interview or a job.",
      "A CV you check in Improve My Resume or Check Job Fit is read in your browser and isn’t uploaded.",
    ],
    tag: "Your CV stays yours",
  },
  {
    emoji: "🔑",
    title: "You sign in to keep your work",
    points: [
      "An account is for one person. Keep your sign-in to yourself.",
      "Your guest CVs move into your account, and the job tracker keeps what you add to it.",
      "You decide what your CVs say and where you send them.",
    ],
    tag: "Kept until you delete it",
  },
  {
    emoji: "🚪",
    title: "You leave whenever you want",
    points: [
      `On a computer: ${DELETE_STEPS}. On a phone, email ${PRIVACY_EMAIL}.`,
      "We may suspend an account that breaks these terms. When we can, we tell you first and why.",
      "If we ever close ATS Hero, you get at least 30 days to download your CVs.",
    ],
    tag: "No notice needed from you",
  },
];

const asks = [
  {
    title: "Don’t invent anything in your CV.",
    text: "No studies, jobs, titles or certificates you don’t have. ATS Hero helps you show the real you at your best.",
  },
  { title: "Don’t use someone else’s CV without asking.", text: "Build and check your own CV, or one you’ve been asked to help with." },
  {
    title: "Don’t attack, overload or copy the service.",
    text: "No bots, scraping or floods of requests. Our limits stop most of it, and we block the rest.",
  },
  { title: "Don’t pretend to be someone else.", text: "Sign in with your own email address or account." },
];

const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>;

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          ATS Hero is run by {OPERATOR.name}, {OPERATOR.address}. In these terms, “we” means us and “you” means
          anyone who uses ATS Hero. Write to us at {mail(SUPPORT_EMAIL)}.
        </p>
        <p>
          By using ATS Hero you agree to these terms. Our <a href="/privacy">Privacy Policy</a> says what we keep
          about you and why.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "What ATS Hero is, and isn’t",
    body: (
      <>
        <p>
          ATS Hero helps you build a CV in templates made to be read by applicant tracking systems (ATS),
          download it as PDF or Word, score a CV the way an ATS might read it, and compare it with a job
          description. Signed in, you can also keep a job tracker.
        </p>
        <p>
          The score and the tips are our estimate and our guidance, based on how applicant tracking systems
          commonly read CVs. They are not the decision of any employer or of its software, and they can’t
          guarantee an interview or a job. We don’t apply to jobs for you and we don’t contact employers.
        </p>
      </>
    ),
  },
  {
    id: "who-can",
    title: "Who can use it",
    body: (
      <p>
        You must be 16 or older. An account belongs to one person: keep your sign-in to yourself, and tell us
        if you think someone else is using it.
      </p>
    ),
  },
  {
    id: "beta",
    title: "The free beta",
    body: (
      <>
        <p>
          ATS Hero is free while it is in beta. We may add, change or remove features, and we can’t promise
          it will always be available or free of errors.
        </p>
        <p>
          Before we charge for anything, we’ll publish the price and the payment and refund terms here, and
          say so on the site at least 30 days ahead. Paying will always take your clear agreement: nothing is
          ever charged without it.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>
          What you put in ATS Hero (your CVs, your photo and your tracker entries) stays yours. You let us
          store and process it only to run ATS Hero for you: to save it, show it, score it and make your
          downloads. We don’t sell or rent it.
        </p>
        <p>
          You are responsible for what you write and for having the right to use it. Keep a copy of anything
          important: you can download every CV as PDF or Word.
        </p>
      </>
    ),
  },
  {
    id: "ours",
    title: "What’s ours",
    body: (
      <p>
        The site, its design, the CV templates and our software belong to us: you may not copy, resell or
        rebuild them. A CV you make with our templates is yours to use however you like, including sending it
        to employers. The icons, the font and the open-source software we use belong to their authors; see
        the <a href="/credits">Credits</a>.
      </p>
    ),
  },
  {
    id: "others",
    title: "Other services we rely on",
    body: (
      <p>
        Other companies provide our sign-in, hosting and storage. Our{" "}
        <a href="/privacy#providers">Privacy Policy</a> lists them and what each one sees. If you sign in with
        Google or GitHub, their terms apply to your account with them.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Our responsibility",
    body: (
      <>
        <p>
          We build ATS Hero with care, but during the free beta it is provided as it is. As far as the law
          allows, we are not responsible for indirect losses, such as a job you didn’t get, or for losing
          content you didn’t keep a copy of.
        </p>
        <p>
          Nothing in these terms limits our responsibility where the law doesn’t allow it, for example for
          harm we cause on purpose or through gross negligence, and nothing takes away your rights as a
          consumer.
        </p>
      </>
    ),
  },
  {
    id: "ending",
    title: "Ending your use",
    body: (
      <>
        <p>
          You can stop using ATS Hero and delete your account at any time: on a computer, {DELETE_STEPS}; on a
          phone, email {mail(PRIVACY_EMAIL)}. The <a href="/privacy#retention">Privacy Policy</a> says what is
          deleted and when.
        </p>
        <p>
          We may suspend or close an account that breaks these terms or puts the service or other people at
          risk. When we can, we tell you first and why. If we ever close ATS Hero, you get at least 30 days to
          download your CVs.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        When these terms change, we update the date at the top. If a change takes away something you rely
        on, or adds a charge, we say so on the site at least 30 days before it applies. If you don’t agree,
        you can delete your account before then.
      </p>
    ),
  },
  {
    id: "law",
    title: "Law and disputes",
    body: (
      <>
        <p>
          These terms are governed by the law of the Republic of Moldova. If you use ATS Hero as a consumer in
          the European Union or the United Kingdom, you keep the protection of the mandatory consumer law of
          the country where you live, and you can take a dispute to its courts.
        </p>
        <p>If something goes wrong, write to us first: most problems are quicker to solve by email.</p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <>
        <p>
          Questions about these terms: {mail(SUPPORT_EMAIL)}. About your data: {mail(PRIVACY_EMAIL)}.
        </p>
        <div className="legal-actions">
          <a className="btn btn--dark" href="/privacy">
            Read the Privacy Policy
          </a>
          <a className="btn btn--outline-dark" href={`mailto:${SUPPORT_EMAIL}`}>
            Email {SUPPORT_EMAIL}
          </a>
        </div>
      </>
    ),
  },
];

/** Everything between the navbar and the footer (rendered on its own in tests). */
export function TermsContent() {
  return (
    <main className="legal-page">
      <LegalHero
        name="Terms and Conditions"
        updated={TERMS_UPDATED}
        title={["What you can expect,", "and what we ask of you"]}
        lead="ATS Hero is free while it’s in beta. These terms say what the service does and doesn’t do, and what happens to your work, in plain words. The legal details follow."
        stats={stats}
      />
      <LegalSteps id="steps-title" title="Using ATS Hero, step by step" steps={steps} />
      <LegalBand id="asks-title" title="What we ask of you" items={asks} />
      <LegalDetails id="details-title" title="The legal details" sections={sections} />
    </main>
  );
}

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <TermsContent />
      <Footer />
    </>
  );
}
