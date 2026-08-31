import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const isLocal = process.env.DATABASE_URL?.includes("localhost")
  || process.env.DATABASE_URL?.includes("127.0.0.1");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,                                  // serverless: small pool per warm instance
  ssl: isLocal ? undefined : {
    ca: fs.readFileSync(path.join(process.cwd(), "certs/rds-global-bundle.pem"), "utf8"),
    rejectUnauthorized: true,
  },
});
export const db = drizzle(pool, { schema, logger: process.env.NODE_ENV === "development" });
