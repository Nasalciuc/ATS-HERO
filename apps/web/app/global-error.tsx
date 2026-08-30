"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, fontFamily: "Helvetica, Arial, sans-serif" }}>
        <main style={{ textAlign: "center", padding: "2rem", maxWidth: 480 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Configuration error</h1>
          <p style={{ color: "#6B7280", marginBottom: 24 }}>
            This deployment is missing required configuration, so we stopped instead of loading a
            broken app. If you are the site owner, check the environment variables.
          </p>
          <button
            onClick={reset}
            style={{ padding: "10px 20px", borderRadius: 100, border: "none", background: "#1A1A1A", color: "#fff", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
