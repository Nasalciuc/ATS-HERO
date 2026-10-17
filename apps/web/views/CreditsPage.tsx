// Credits, in the legal pages' layout: the icon sets the UI ships (generated with the icons), the
// font we host and the open-source packages the web app runs on (generated from package-lock.json:
// `npm run credits`). tests/credits-page.test.tsx keeps all three complete.
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DocFileIcon, EditLine, MinusThin, PlusThin, StepIcon } from "@/components/figma-icons";
import { ICON_CREDITS } from "@/components/icon-credits";
import { SOFTWARE_CREDITS, type SoftwareCredit } from "@/components/software-credits";
import { LegalDetails, LegalHero, LegalTable, type LegalSection, type LegalStat } from "@/components/legal/LegalLayout";
import { SUPPORT_EMAIL } from "@/lib/legal";

const link = (href: string | null, text: string) =>
  href ? (
    <a href={href} rel="noopener noreferrer" target="_blank">
      {text}
    </a>
  ) : (
    text
  );

/** The packages grouped by licence, the most common licence first. */
function byLicence(list: SoftwareCredit[]) {
  const groups = new Map<string, SoftwareCredit[]>();
  for (const p of list) groups.set(p.license, [...(groups.get(p.license) ?? []), p]);
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1));
}

const stats: LegalStat[] = [
  { Icon: EditLine, size: 30, num: `${ICON_CREDITS.length} icon sets`, desc: "drawn by designers who share them freely" },
  { Icon: DocFileIcon, size: 30, num: "1 font", desc: "Inter, by Rasmus Andersson" },
  { Icon: StepIcon, size: 30, num: `${SOFTWARE_CREDITS.length} open-source packages`, desc: "the software the web app runs on" },
];

const sections: LegalSection[] = [
  {
    id: "icons",
    title: "Icons",
    body: (
      <>
        <p>The icons in ATS Hero come from these sets. Each name links to its source, each licence to its text.</p>
        <LegalTable
          head={["Icon set", "Made by", "Licence"]}
          rows={ICON_CREDITS.map((c) => [link(c.url, c.name), c.author, link(c.licenseUrl, c.license)])}
        />
      </>
    ),
  },
  {
    id: "font",
    title: "Font",
    body: (
      <>
        <p>We host the font ourselves, with its licence file, so it loads from our site and from nowhere else.</p>
        <LegalTable
          head={["Font", "Made by", "Licence"]}
          rows={[
            [
              link("https://rsms.me/inter/", "Inter"),
              "Rasmus Andersson",
              link("https://openfontlicense.org", "SIL Open Font License 1.1"),
            ],
          ]}
        />
      </>
    ),
  },
  {
    id: "software",
    title: "Open-source software",
    body: (
      <>
        <p>
          The web app runs on {SOFTWARE_CREDITS.length} open-source packages: the ones it installs to run, without
          the tools we only use to build and test it. Each name links to the package, where you find its authors
          and the full text of its licence.
        </p>
        <ul className="legal-licences">
          {byLicence(SOFTWARE_CREDITS).map(([licence, packages]) => (
            <li key={licence}>
              <details className="legal-licence">
                <summary>
                  <span>{licence}</span>
                  <span className="legal-licence__count">
                    {packages.length} {packages.length === 1 ? "package" : "packages"}
                  </span>
                  <span className="legal-licence__toggle" aria-hidden="true">
                    <PlusThin size={24} />
                    <MinusThin size={24} />
                  </span>
                </summary>
                <ul className="legal-licence__list">
                  {packages.map((p) => (
                    <li key={`${p.name}@${p.version}`}>
                      {link(`https://www.npmjs.com/package/${p.name}`, p.name)}{" "}
                      <span className="legal-licence__version">{p.version}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: "missing",
    title: "Something missing?",
    body: (
      <p>
        If you made something we use and it isn’t credited the way you want, write to us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we’ll fix it.
      </p>
    ),
  },
];

/** Everything between the navbar and the footer (rendered on its own in tests). */
export function CreditsContent() {
  return (
    <main className="legal-page">
      <LegalHero
        name="Credits"
        title={["Built with the work", "of generous people"]}
        lead="ATS Hero uses free icons, a free font and open-source software. Their authors share them under the licences below. Thank you."
        stats={stats}
      />
      <LegalDetails id="details-title" title="Who made what" sections={sections} />
    </main>
  );
}

export default function CreditsPage() {
  return (
    <>
      <Navbar />
      <CreditsContent />
      <Footer />
    </>
  );
}
