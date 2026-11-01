/**
 * How the apply engine talks to agent-browser (github.com/vercel-labs/agent-browser, Apache-2.0):
 * one command at a time, `--json`, on a named session (one browser per application).
 *
 * `cliRunner` runs the CLI on this machine: the apply lab, and a developer's laptop. In production
 * the agent will run in a Vercel Sandbox (`@agent-browser/sandbox/vercel`, APLICARE-CU-AGENT.md AA-3)
 * behind the same `Runner` type; that runner comes with the route that uses it.
 *
 * agent-browser is not a dependency of the web app: its npm package carries the CLI for every
 * platform (115 MB), and the app never runs a browser itself. The lab installs it at the version
 * below (`npm run apply-lab` documents how); a test keeps the workflow on the same version.
 */
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

export const AGENT_BROWSER_VERSION = "0.41.1";

/** Runs one agent-browser command and returns its `data`; rejects with the CLI's error. */
export type Runner = (args: string[]) => Promise<Record<string, unknown>>;

export class AgentBrowserError extends Error {}

/** AGENT_BROWSER_BIN if set, else the npm package next to the app, else `agent-browser` on the PATH. */
function locate(): { file: string; prefix: string[] } {
  const explicit = process.env.AGENT_BROWSER_BIN;
  if (explicit) return { file: explicit, prefix: [] };
  try {
    const pkg = createRequire(import.meta.url).resolve("agent-browser/package.json");
    return { file: process.execPath, prefix: [path.join(path.dirname(pkg), "bin", "agent-browser.js")] };
  } catch {
    return { file: "agent-browser", prefix: [] };
  }
}

export function cliRunner(session: string, opts: { timeoutMs?: number } = {}): Runner {
  const bin = locate();
  return (args) =>
    new Promise((resolve, reject) => {
      execFile(
        bin.file,
        [...bin.prefix, "--session", session, ...args, "--json"],
        { timeout: opts.timeoutMs ?? 60_000, maxBuffer: 32 * 1024 * 1024 },
        (err, stdout, stderr) => {
          let out: { success?: boolean; data?: unknown; error?: string } | null = null;
          try {
            out = JSON.parse(stdout);
          } catch {
            // not JSON: the CLI didn't start, or crashed
          }
          if (out?.success) return resolve((out.data ?? {}) as Record<string, unknown>);
          const why = out?.error ?? (stderr || err?.message || "no output");
          reject(new AgentBrowserError(`agent-browser ${args.find((a) => !a.startsWith("-")) ?? ""}: ${String(why).slice(0, 300)}`));
        },
      );
    });
}
