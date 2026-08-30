import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,                                  // serverless: small pool per warm instance
  // RDS forces SSL; encrypted-but-unverified is the pragmatic solo-stage posture.
  // Upgrade path (Etapa 2): pin the RDS global CA bundle + rejectUnauthorized: true.
  ssl: process.env.DATABASE_URL?.includes("localhost") ? undefined
                                                       : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema, logger: process.env.NODE_ENV === "development" });
