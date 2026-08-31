import { config } from "dotenv";

// See db/migrate.ts — env must load before db/index.ts is imported.
config({ path: ".env.local" });

async function main() {
  const { db } = await import("./index");
  const { users, cvs, scans } = await import("./schema");
  const { emptyCvData } = await import("@/lib/types");

  const [u] = await db.insert(users).values({
    clerkId: "user_dev_seed", email: "dev@atshero.local", name: "Dev Seed",
  }).returning();
  const [cv] = await db.insert(cvs).values({
    ownerId: u.clerkId, title: "Seed CV",
    data: emptyCvData(),                       // minimal valid CvData per lib/types.ts
  }).returning();
  await db.insert(scans).values({
    ownerId: u.clerkId, cvId: cv.id, kind: "score", engine: "client",
    generalScore: 72.5, result: { generalScore: 72.5, message: "seed", sections: [] },
  });
  console.log("✔ seeded");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
