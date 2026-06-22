/**
 * Full API test suite — mirrors postman/ATS-Hero-API.postman_collection.json
 * Usage: npm run api:test
 */
const BASE = process.env.API_BASE_URL ?? "http://localhost:8787";

async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

let ok = 0;
let fail = 0;

function pass(name, detail) {
  ok++;
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function failTest(name, detail) {
  fail++;
  console.log(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

const sampleCv = {
  title: "Postman Test CV",
  data: {
    personalInfo: {
      name: "David Smith",
      email: "david@example.com",
      phone: "+1 123 456 7890",
      cityState: "Berlin",
      country: "Germany",
    },
    summary: {
      position: "UX Designer",
      valueProposition: "Product designer with 5+ years building user-centered experiences.",
    },
    skills: ["Figma", "User Research", "Prototyping"],
    work: [
      {
        id: "w1",
        role: "Senior UX Designer",
        company: "Acme Corp",
        startDate: "Jan 2022",
        endDate: "Present",
        current: true,
        description: "Led redesign that increased conversion by 25%.",
      },
    ],
    education: [
      {
        id: "e1",
        degree: "BSc Design",
        institution: "Design University",
        startDate: "2016",
        endDate: "2020",
      },
    ],
  },
};

try {
  console.log(`Testing ATS Hero API at ${BASE}\n`);

  const health = await req("GET", "/api/health");
  if (health.status === 200 && health.json?.ok) pass("GET /api/health");
  else failTest("GET /api/health", `status ${health.status}`);

  const login = await req("POST", "/api/auth/login", {
    email: "postman-full@test.local",
    password: "test123",
  });
  const token = login.json?.token;
  if (login.status === 200 && token) pass("POST /api/auth/login", "JWT received");
  else failTest("POST /api/auth/login", `status ${login.status}`);

  if (token) {
    const me = await req("GET", "/api/auth/me", null, token);
    if (me.status === 200 && me.json?.user?.email) pass("GET /api/auth/me", me.json.user.email);
    else failTest("GET /api/auth/me", `status ${me.status}`);
  }

  const create = await req("POST", "/api/cv", sampleCv, token);
  const cvId = create.json?.cv?.id;
  if (create.status === 201 && cvId) pass("POST /api/cv", `id ${cvId}`);
  else failTest("POST /api/cv", `status ${create.status}`);

  if (token && cvId) {
    const list = await req("GET", "/api/cv", null, token);
    if (list.status === 200 && Array.isArray(list.json?.cvs)) pass("GET /api/cv", `${list.json.cvs.length} CV(s)`);
    else failTest("GET /api/cv", `status ${list.status}`);

    const getOne = await req("GET", `/api/cv/${cvId}`, null, token);
    if (getOne.status === 200 && getOne.json?.cv?.id === cvId) pass("GET /api/cv/:id");
    else failTest("GET /api/cv/:id", `status ${getOne.status}`);

    const update = await req(
      "PUT",
      `/api/cv/${cvId}`,
      { title: "Updated Postman CV", data: { skills: ["Figma", "Accessibility"] } },
      token
    );
    if (update.status === 200 && update.json?.cv?.title === "Updated Postman CV")
      pass("PUT /api/cv/:id", "title updated");
    else failTest("PUT /api/cv/:id", `status ${update.status}`);
  }

  const scoreText = await req("POST", "/api/score", {
    text: "Jane Doe Software Engineer React TypeScript Node.js increased revenue 30%",
  });
  if (scoreText.status === 200 && scoreText.json?.report?.generalScore != null)
    pass("POST /api/score (text)", `score ${scoreText.json.report.generalScore}`);
  else failTest("POST /api/score (text)", `status ${scoreText.status}`);

  if (cvId) {
    const scoreCv = await req("POST", "/api/score", { cvId });
    if (scoreCv.status === 200 && scoreCv.json?.report?.sections?.length)
      pass("POST /api/score (cvId)", `${scoreCv.json.report.sections.length} sections`);
    else failTest("POST /api/score (cvId)", `status ${scoreCv.status}`);
  }

  const fit = await req("POST", "/api/jobfit", {
    cvText: "React TypeScript frontend developer with Figma and accessibility skills",
    jobText: "Looking for React, TypeScript, Figma and accessibility experience",
  });
  if (fit.status === 200 && fit.json?.report?.matchScore != null)
    pass("POST /api/jobfit", `match ${fit.json.report.matchScore}%`);
  else failTest("POST /api/jobfit", `status ${fit.status}`);

  if (token && cvId) {
    const del = await req("DELETE", `/api/cv/${cvId}`, null, token);
    if (del.status === 200 && del.json?.ok) pass("DELETE /api/cv/:id");
    else failTest("DELETE /api/cv/:id", `status ${del.status}`);
  }

  const noAuth = await req("GET", "/api/auth/me");
  if (noAuth.status === 401) pass("GET /api/auth/me (no token)", "401 as expected");
  else failTest("GET /api/auth/me (no token)", `expected 401, got ${noAuth.status}`);
} catch (err) {
  console.error("\nAPI unreachable. Start the stack with: npm run dev");
  console.error(String(err.message ?? err));
  process.exit(1);
}

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
