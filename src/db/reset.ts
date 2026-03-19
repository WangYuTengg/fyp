import { execFileSync } from "child_process";
import * as dotenv from "dotenv";
import * as readline from "readline";

import postgres from "postgres";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  console.log(
    "\n⚠️  This will DROP ALL TABLES and re-push the schema from scratch."
  );
  console.log("   All data will be permanently lost.\n");

  const answer = await ask('Type "yes" to confirm: ');

  if (answer !== "yes") {
    console.log("Aborted.");
    rl.close();
    process.exit(0);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    rl.close();
    process.exit(1);
  }

  console.log("\nDropping all tables and types...");
  const sql = postgres(connectionString, { max: 1 });

  try {
    // Drop all tables in the public schema
    await sql.unsafe(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    // Drop all custom enum types
    await sql.unsafe(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
          EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    console.log("All tables and types dropped.");
  } finally {
    await sql.end();
  }

  console.log("\nRe-pushing schema...");
  execFileSync("npx", ["drizzle-kit", "push", "--force"], {
    stdio: "inherit",
  });

  console.log("\nDatabase reset complete.");
  rl.close();
}

main().catch((err) => {
  console.error("Reset failed:", err);
  rl.close();
  process.exit(1);
});
