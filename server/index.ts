import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { readDb, writeDb, mergeCvData, normalizeCvData } from "./store.ts";
import { scoreCv, scoreRawText } from "./scoring.ts";
import { jobFit } from "./jobfit.ts";
import type { Cv, CvData, User } from "./types.ts";

const PORT = Number(process.env.PORT ?? 8787);
const JWT_SECRET = process.env.JWT_SECRET ?? "ats-hero-dev-secret";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

type AuthedRequest = Request & { userId?: string };

function authOptional(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string };
      req.userId = payload.sub;
    } catch {
      /* ignore invalid token */
    }
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: "Authentication required" });
  next();
}

function publicUser(u: User) {
  return { id: u.id, email: u.email };
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ----------------------------- auth ----------------------------- */
// Email-first sign in: upserts the user (demo-friendly), returns a JWT.
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || typeof email !== "string")
    return res.status(400).json({ error: "Email is required" });

  const db = readDb();
  let user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    user = {
      id: nanoid(),
      email,
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    writeDb(db);
  } else if (password && user.passwordHash) {
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Incorrect password" });
  } else if (password && !user.passwordHash) {
    user.passwordHash = await bcrypt.hash(password, 10);
    writeDb(db);
  }

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: publicUser(user) });
});

app.get("/api/auth/me", authOptional, requireAuth, (req: AuthedRequest, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});

app.get("/api/cv", authOptional, requireAuth, (req: AuthedRequest, res) => {
  const db = readDb();
  res.json({ cvs: db.cvs.filter((c) => c.ownerId === req.userId) });
});

app.post("/api/cv", authOptional, (req: AuthedRequest, res) => {
  const db = readDb();
  const now = new Date().toISOString();
  const cv: Cv = {
    id: nanoid(),
    ownerId: req.userId ?? null,
    title: req.body?.title ?? "Untitled CV",
    data: normalizeCvData(req.body?.data ?? {}),
    createdAt: now,
    updatedAt: now,
  };
  db.cvs.push(cv);
  writeDb(db);
  res.status(201).json({ cv });
});

app.get("/api/cv/:id", authOptional, (req: AuthedRequest, res) => {
  const db = readDb();
  const cv = db.cvs.find((c) => c.id === req.params.id);
  if (!cv) return res.status(404).json({ error: "CV not found" });
  if (cv.ownerId && cv.ownerId !== req.userId)
    return res.status(403).json({ error: "Not your CV" });
  res.json({ cv });
});

app.put("/api/cv/:id", authOptional, (req: AuthedRequest, res) => {
  const db = readDb();
  const cv = db.cvs.find((c) => c.id === req.params.id);
  if (!cv) return res.status(404).json({ error: "CV not found" });
  if (cv.ownerId && cv.ownerId !== req.userId)
    return res.status(403).json({ error: "Not your CV" });

  if (req.body?.data) cv.data = mergeCvData(cv.data, req.body.data);
  if (typeof req.body?.title === "string") cv.title = req.body.title;
  // Claim ownership on save once the user has signed in.
  if (!cv.ownerId && req.userId) cv.ownerId = req.userId;
  cv.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ cv });
});

app.delete("/api/cv/:id", authOptional, requireAuth, (req: AuthedRequest, res) => {
  const db = readDb();
  const idx = db.cvs.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "CV not found" });
  if (db.cvs[idx].ownerId !== req.userId)
    return res.status(403).json({ error: "Not your CV" });
  db.cvs.splice(idx, 1);
  writeDb(db);
  res.json({ ok: true });
});

/* --------------------------- scoring ---------------------------- */
app.post("/api/score", (req: Request, res: Response) => {
  const { cvId, data, text } = req.body ?? {};
  if (typeof text === "string" && text.trim()) {
    return res.json({ report: scoreRawText(text) });
  }
  let cvData: CvData | undefined =
    data != null ? normalizeCvData(data) : undefined;
  if (!cvData && cvId) {
    const db = readDb();
    const stored = db.cvs.find((c) => c.id === cvId)?.data;
    if (stored) cvData = normalizeCvData(stored);
  }
  if (!cvData) return res.status(400).json({ error: "Provide cvId, data or text" });
  res.json({ report: scoreCv(cvData) });
});

app.post("/api/jobfit", (req: Request, res: Response) => {
  const { cvText, jobText } = req.body ?? {};
  if (typeof cvText !== "string" || typeof jobText !== "string")
    return res.status(400).json({ error: "cvText and jobText are required" });
  res.json({ report: jobFit(cvText, jobText) });
});

app.listen(PORT, () => {
  console.log(`ATS Hero API listening on http://localhost:${PORT}`);
});
