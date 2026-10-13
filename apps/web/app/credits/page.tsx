import { ICON_CREDITS } from "@/components/icon-credits";

export const metadata = { title: "Credits — ATS Hero" };

/** Third-party notices: the icon sets (generated list) and the self-hosted font. */
export default function Credits() {
  return (
    <main className="legal">
      <h1>Credits</h1>
      <p>ATS Hero uses these open-source icon sets and fonts. Thank you to their authors.</p>

      <h2>Icons</h2>
      <ul className="legal__list">
        {ICON_CREDITS.map((c) => (
          <li key={c.name}>
            {c.url ? <a href={c.url}>{c.name}</a> : c.name} by {c.author} —{" "}
            {c.licenseUrl ? <a href={c.licenseUrl}>{c.license}</a> : c.license}
          </li>
        ))}
      </ul>

      <h2>Fonts</h2>
      <ul className="legal__list">
        <li>
          <a href="https://rsms.me/inter/">Inter</a> by Rasmus Andersson —{" "}
          <a href="https://openfontlicense.org">SIL Open Font License 1.1</a>
        </li>
      </ul>
    </main>
  );
}
