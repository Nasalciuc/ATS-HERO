export const metadata = { title: "Terms and Conditions — ATS Hero" };

export default function Terms() {
  return (
    <main className="legal">
      <h1>Terms and Conditions</h1>
      <p><em>Last updated: {new Date().toISOString().slice(0, 10)}</em></p>

      <h2>The service</h2>
      <p>ATS Hero helps you build a CV, score it the way an applicant tracking system would
      read it, and compare it against a job description. The scores and suggestions are
      guidance, not a guarantee of any hiring outcome.</p>

      <h2>Free beta</h2>
      <p>The service is currently in free beta. Features may change or be withdrawn, and we
      cannot promise uninterrupted availability. We will give notice before introducing
      charges for anything you already rely on.</p>

      <h2>Acceptable use</h2>
      <p>Describe your own experience truthfully. Do not use ATS Hero to fabricate
      qualifications, impersonate another person, upload content you have no right to share,
      or to attack, overload, or reverse-engineer the service.</p>

      <h2>Your content</h2>
      <p>Your CV content stays yours. You grant us only the permission needed to store it and
      to generate the analysis you asked for.</p>

      <h2>Termination</h2>
      <p>You can delete your account at any time from your dashboard. We may suspend accounts
      that break these terms.</p>

      <h2>Contact</h2>
      <p>support@atshero.app</p>
    </main>
  );
}
