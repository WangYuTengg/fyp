/**
 * Seed script to set passwords for users in the database.
 *
 * Usage:
 *   npx tsx src/db/seed-passwords.ts
 *
 * Edit the `seedUsers` array below with the emails and plaintext passwords
 * you want. The script will hash them and update the users table.
 */
import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const seedUsers: Array<{ email: string; password: string; name: string; role: 'admin' | 'staff' | 'student' }> = [
  // Add your users here:
  // { email: 'admin@example.com', password: 'password123', name: 'Admin', role: 'admin' },
  // { email: 'staff@example.com', password: 'password123', name: 'Staff User', role: 'staff' },
  // { email: 'student@example.com', password: 'password123', name: 'Student', role: 'student' },
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  for (const user of seedUsers) {
    const hash = await bcrypt.hash(user.password, 10);

    // Upsert: insert or update password_hash if user already exists
    await sql`
      INSERT INTO users (email, name, role, password_hash)
      VALUES (${user.email}, ${user.name}, ${user.role}, ${hash})
      ON CONFLICT (email) DO UPDATE SET password_hash = ${hash}, name = COALESCE(${user.name}, users.name)
    `;

    console.log(`Set password for ${user.email} (${user.role})`);
  }

  console.log('Done.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
