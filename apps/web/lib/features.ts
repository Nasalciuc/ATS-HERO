/**
 * Switches for what isn't live yet (AGENTS.md rule 12). Off unless exactly "true". NEXT_PUBLIC_ so the
 * screens hide what the server would refuse.
 *
 * - Daily search: needs apps/ai's /jobs/search reachable from our server.
 * - The apply agent's queue: needs a browser for the agent (agent-browser on a developer's machine;
 *   in production a Vercel Sandbox, APLICARE-CU-AGENT.md AA-3).
 * - The Interview Trainer: AI features are for paying subscribers (Scaler, Nov 2026), so it waits for
 *   payments, the model on Bedrock and, for speaking, Nova 2 Sonic (ANTRENOR-INTERVIU-CONSTRUCTIE.md).
 *
 * Turning one on in production changes the Privacy and Terms pages in the same commit (rule 11).
 */
export const jobSearchEnabled = () => process.env.NEXT_PUBLIC_JOB_SEARCH_ENABLED === "true";
export const applyAgentEnabled = () => process.env.NEXT_PUBLIC_APPLY_AGENT_ENABLED === "true";
export const interviewTrainerEnabled = () => process.env.NEXT_PUBLIC_INTERVIEW_TRAINER_ENABLED === "true";
