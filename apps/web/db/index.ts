import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions/db-connections";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const isLocal = process.env.DATABASE_URL?.includes("localhost")
  || process.env.DATABASE_URL?.includes("127.0.0.1");

// TLS is configured only here. pg lets SSL settings parsed from the URL (?sslmode=require and
// friends) REPLACE the `ssl` object below, which drops the pinned RDS CA; the RDS CA is not in
// Node's default trust store, so every connection (app and migrations) would then fail.
function withoutUrlTls(url: string | undefined): string | undefined {
  if (!url) return url;
  const u = new URL(url);
  for (const key of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"]) {
    u.searchParams.delete(key);
  }
  return u.toString();
}

// Serverless: every warm function instance keeps its own pool, so keep it small and let idle
// connections go quickly; RDS has a fixed connection limit shared by all instances.
const pool = new Pool({
  connectionString: withoutUrlTls(process.env.DATABASE_URL),
  max: 2,
  idleTimeoutMillis: 5_000,       // close an idle connection after 5 s (pg's default is 10 s)
  // Fail the request instead of hanging when no connection comes. 2 s is ample next to the
  // database (Vercel iad1 → RDS us-east-1); db/migrate.ts, run from a laptop an ocean away,
  // raises it through DB_CONNECT_TIMEOUT_MS.
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 2_000,
  ssl: isLocal ? undefined : {
    ca: fs.readFileSync(path.join(process.cwd(), "certs/rds-global-bundle.pem"), "utf8"),
    rejectUnauthorized: true,
  },
});
// On Vercel, keeps a suspended instance alive until its idle connections are closed, so they
// are not left open on RDS. Does nothing anywhere else (local, CI, build).
attachDatabasePool(pool);
export const db = drizzle(pool, { schema, logger: process.env.NODE_ENV === "development" });
