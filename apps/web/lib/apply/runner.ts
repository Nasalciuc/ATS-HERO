/**
 * How the apply engine talks to agent-browser (github.com/vercel-labs/agent-browser, Apache-2.0): on a
 * named session (one browser per application), held to the posting's domains on every call.
 *
 * - `run` sends one command whose arguments the engine wrote itself (open, snapshot, screenshot…).
 * - `batch` sends commands as JSON on stdin. Every value that comes from the CV or from the person
 *   (a name, an answer) goes this way: on a command line a value like "--headed" would be read as a
 *   flag; in a batch it is typed as it is.
 *
 * Every call carries the idle timeout and the allowed domains as environment variables: a daemon that
 * shut down while the person was reviewing comes back with the same limits, never without them.
 *
 * `cliRunner` runs the CLI on this machine: the apply lab, and a developer's laptop. In production the
 * agent will run in a Vercel Sandbox (`@agent-browser/sandbox/vercel`, APLICARE-CU-AGENT.md AA-3)
 * behind the same `Runner` type; that runner comes with the route that uses it.
 *
 * agent-browser is not a dependency of the web app: its npm package carries the CLI for every
 * platform (115 MB), and the app never runs a browser itself. The lab installs it at the version
 * below (AGENTS.md, Commands); a test keeps the workflow on the same version.
 */
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

export const AGENT_BROWSER_VERSION = "0.41.1";

export interface Runner {
  /** one command; resolves with its `data`, rejects with the CLI's error */
  run(args: string[]): Promise<Record<string, unknown>>;
  /** commands in order, stopping at the first that fails; resolves with each one's result, rejects with the first error */
  batch(commands: string[][]): Promise<Record<string, unknown>[]>;
}

export interface RunnerOptions {
  /** the posting's domains (`postingTarget`): the browser goes nowhere else */
  allowedDomains: string[];
  /** per command; default 60 s */
  timeoutMs?: number;
  /** the browser closes after this long without a command; default 15 minutes, the person's review time */
  idleTimeoutMs?: number;
}

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

const verb = (args: string[]) => args.find((a) => !a.startsWith("-")) ?? "";

export function cliRunner(session: string, opts: RunnerOptions): Runner {
  const bin = locate();
  const env = {
    ...process.env,
    AGENT_BROWSER_IDLE_TIMEOUT_MS: String(opts.idleTimeoutMs ?? 15 * 60_000),
    AGENT_BROWSER_ALLOWED_DOMAINS: opts.allowedDomains.join(","),
  };

  const exec = (args: string[], stdin?: string) =>
    new Promise<{ out: unknown; why: string }>((resolve) => {
      const child = execFile(
        bin.file,
        [...bin.prefix, "--session", session, ...args, "--json"],
        { env, timeout: opts.timeoutMs ?? 60_000, maxBuffer: 32 * 1024 * 1024 },
        (err, stdout, stderr) => {
          let out: unknown = null;
          try {
            out = JSON.parse(stdout);
          } catch {
            // not JSON: the CLI didn't start, or crashed
          }
          resolve({ out, why: String(stderr || err?.message || "no output") });
        },
      );
      child.stdin?.end(stdin ?? "");
    });

  return {
    async run(args) {
      const { out, why } = await exec(args);
      const o = out as { success?: boolean; data?: unknown; error?: string } | null;
      if (o?.success) return (o.data ?? {}) as Record<string, unknown>;
      throw new AgentBrowserError(`agent-browser ${verb(args)}: ${String(o?.error ?? why).slice(0, 300)}`);
    },

    async batch(commands) {
      if (!commands.length) return [];
      const { out, why } = await exec(["batch", "--bail", "--omit-command"], JSON.stringify(commands));
      const items = (Array.isArray(out) ? out : null) as { success?: boolean; error?: string | null; result?: unknown; index?: number }[] | null;
      if (!items) throw new AgentBrowserError(`agent-browser batch: ${why.slice(0, 300)}`);
      const failed = items.find((i) => !i.success);
      if (failed) {
        const cmd = commands[failed.index ?? 0] ?? [];
        throw new AgentBrowserError(`agent-browser ${cmd[0] ?? "batch"} ${cmd[1] ?? ""}: ${String(failed.error ?? "failed").slice(0, 300)}`);
      }
      if (items.length !== commands.length) throw new AgentBrowserError(`agent-browser batch: ${items.length} of ${commands.length} commands ran`);
      return items.map((i) => (i.result ?? {}) as Record<string, unknown>);
    },
  };
}
