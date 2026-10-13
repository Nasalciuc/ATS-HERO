import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
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

const pool = new Pool({
  connectionString: withoutUrlTls(process.env.DATABASE_URL),
  max: 2,                                  // serverless: small pool per warm instance
  ssl: isLocal ? undefined : {
    ca: fs.readFileSync(path.join(process.cwd(), "certs/rds-global-bundle.pem"), "utf8"),
    rejectUnauthorized: true,
  },
});
export const db = drizzle(pool, { schema, logger: process.env.NODE_ENV === "development" });
