import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const runMigrations = async () => {
  const connectionString = process.env.DATABASE_URL!;
  
  console.log('🔄 Running migrations...');
  
  // Create a dedicated connection for migrations.
  // prepare: false for Supabase Supavisor (transaction-mode pooling) compatibility.
  const migrationClient = postgres(connectionString, { max: 1, prepare: false });
  const db = drizzle(migrationClient);
  
  try {
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
  
  await migrationClient.end();
  process.exit(0);
};

runMigrations();
