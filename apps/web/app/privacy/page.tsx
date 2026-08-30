export const metadata = { title: "Privacy Policy — ATS Hero" };

export default function Privacy() {
  return (
    <main className="legal">
      <h1>Privacy Policy</h1>
      <p><em>Last updated: {new Date().toISOString().slice(0, 10)}</em></p>

      <h2>What we store</h2>
      <p>Your account details (name, email) via Clerk, our authentication provider; the CV
      content you enter or upload; and the analysis results we generate for you.</p>

      <h2>Working without an account</h2>
      <p>You can build and score a CV without signing up. In that case the CV is tied to a
      random identifier stored in your browser, not to a person. If you later sign in, the
      work you already did is attached to your new account.</p>

      <h2>Where your data lives</h2>
      <p>Your data is stored on cloud infrastructure in the United States (AWS, us-east-1).
      For users in the EU/EEA, transfers rely on Standard Contractual Clauses.</p>

      <h2>Retention &amp; deletion</h2>
      <p>Data is kept while your account is active. You can permanently delete your account
      and all associated data at any time from your dashboard (&ldquo;Delete my account&rdquo;).
      Guest data unclaimed for 90 days is automatically removed.</p>

      <h2>What we don&rsquo;t do</h2>
      <p>We do not sell your data. Your CV content is never used to train third-party models.</p>

      <h2>Contact</h2>
      <p>privacy@atshero.app — we reply within 7 days.</p>
    </main>
  );
}
