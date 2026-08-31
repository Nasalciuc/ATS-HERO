export const FeedbackLink = () => (
  <a className="appshell__feedback"
     href={process.env.NEXT_PUBLIC_FEEDBACK_URL ?? "mailto:feedback@atshero.app?subject=ATS%20Hero%20feedback"}
     target="_blank" rel="noreferrer">Feedback</a>
);
