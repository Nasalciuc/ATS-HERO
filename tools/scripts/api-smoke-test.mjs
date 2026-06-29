/**
 * API smoke test — mirrors tools/postman/ATS-Hero-API.postman_collection.json
 * Usage: node tools/scripts/api-smoke-test.mjs
 * Env: WEB_BASE_URL (default http://localhost:3000), AI_BASE_URL (default http://localhost:8000)
 */
const WEB = process.env.WEB_BASE_URL ?? "http://localhost:3000";
const AI = process.env.AI_BASE_URL ?? "http://localhost:8000";

const sampleCvText =
  "David Smith UX Designer Berlin david@example.com +1 123 456 7890. Led product design at Acme Corp, increased conversion 25%. Skills: Figma, User Research, Prototyping, Accessibility.";
const sampleJobText =
  "We need a UX Designer skilled in Figma, user research, prototyping, and accessibility.";

async function req(method, base, path, body, headers = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 200);
  }
  return { status: res.status, json };
}

let ok = 0;
let fail = 0;
let skip = 0;

function pass(name, detail) {
  ok++;
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function failTest(name, detail) {
  fail++;
  console.log(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}
function skipTest(name, detail) {
  skip++;
  console.log(`○ ${name}${detail ? ` — ${detail}` : ""} (skipped)`);
}

async function testWeb() {
  console.log(`\nNext.js Web @ ${WEB}`);
  try {
    const home = await req("GET", WEB, "/");
    if (home.status === 200) pass("GET /");
    else failTest("GET /", `status ${home.status}`);
  } catch (err) {
    failTest("GET /", String(err.message ?? err));
  }

  try {
    const bad = await req("POST", WEB, "/api/rewrite", { bullets: [] });
    if (bad.status === 400) pass("POST /api/rewrite (empty bullets)", "400 as expected");
    else failTest("POST /api/rewrite (empty bullets)", `status ${bad.status}`);
  } catch (err) {
    failTest("POST /api/rewrite (empty bullets)", String(err.message ?? err));
  }

  try {
    const rewrite = await req("POST", WEB, "/api/rewrite", {
      role: "UX Designer",
      bullets: ["Worked on design projects", "Helped with user research"],
    });
    if (rewrite.status === 200 && Array.isArray(rewrite.json?.rewrites))
      pass("POST /api/rewrite", `${rewrite.json.rewrites.length} rewrites`);
    else if (rewrite.status === 502)
      skipTest("POST /api/rewrite", "502 — AI keys not configured (expected locally)");
    else failTest("POST /api/rewrite", `status ${rewrite.status}`);
  } catch (err) {
    failTest("POST /api/rewrite", String(err.message ?? err));
  }
}

async function testAi() {
  console.log(`\nPython AI @ ${AI}`);
  let reachable = true;
  try {
    const health = await req("GET", AI, "/health");
    if (health.status === 200 && health.json?.status === "ok")
      pass("GET /health", `nlp=${health.json.nlp_model}`);
    else {
      failTest("GET /health", `status ${health.status}`);
      reachable = false;
    }
  } catch (err) {
    reachable = false;
    skipTest("Python AI", `unreachable — start with: cd apps/ai && uvicorn app.main:app --reload --port 8000`);
  }
  if (!reachable) return;

  const score = await req("POST", AI, "/score", { text: sampleCvText });
  if (score.status === 200 && score.json?.overall_score != null)
    pass("POST /score", `score ${score.json.overall_score}`);
  else failTest("POST /score", `status ${score.status}`);

  const fit = await req("POST", AI, "/job-fit", { cv_text: sampleCvText, job_text: sampleJobText });
  if (fit.status === 200 && fit.json?.match_score != null)
    pass("POST /job-fit", `match ${fit.json.match_score}%`);
  else failTest("POST /job-fit", `status ${fit.status}`);

  const region = await req("POST", AI, "/region", { target: "DE", cv_text: sampleCvText });
  if (region.status === 200 && region.json?.target === "DE") pass("POST /region");
  else failTest("POST /region", `status ${region.status}`);
}

console.log("ATS Hero API smoke test");
await testWeb();
await testAi();

console.log(`\n${ok} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail > 0 ? 1 : 0);
