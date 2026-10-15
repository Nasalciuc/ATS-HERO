import { config } from "dotenv";

// ESM hoists imports above statements, so db/index.ts must be pulled in *after* the env
// file is loaded — otherwise the Pool is built without DATABASE_URL and hits port 5432.
config({ path: ".env.local" });
// Migrations run from a laptop far from the database: TCP, TLS and the password exchange take
// several round trips, so allow 15 s instead of the app's 2 s (db/index.ts).
process.env.DB_CONNECT_TIMEOUT_MS ??= "15000";

async function main() {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { db } = await import("./index");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✔ migrations applied");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
