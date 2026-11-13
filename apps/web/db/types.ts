import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * A Drizzle database over our schema, whichever driver runs it: node-postgres in the app (db/index.ts),
 * PGlite in the tests (tests/db/setup.ts). A transaction (`tx`) is one too, so helpers that take a `Db`
 * work inside and outside `db.transaction(...)`.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
