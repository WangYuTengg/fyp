import * as dotenv from 'dotenv';
import * as readline from 'readline';

import postgres from 'postgres';

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
  console.log('\n⚠️  This will DELETE ALL ROWS from every table.');
  console.log('   Tables and schema will remain intact.\n');

  const answer = await ask('Type "yes" to confirm: ');

  if (answer !== 'yes') {
    console.log('Aborted.');
    rl.close();
    process.exit(0);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    rl.close();
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });

  try {
    console.log('\nWiping all rows...');

    await sql.unsafe(`
      TRUNCATE TABLE
        staff_notifications,
        ai_usage_stats,
        ai_grading_jobs,
        marks,
        rubrics,
        answers,
        submissions,
        assignment_questions,
        assignments,
        questions,
        enrollments,
        courses,
        refresh_tokens,
        password_reset_tokens,
        system_settings,
        users
      CASCADE
    `);

    console.log('All rows deleted. Schema intact.');
  } finally {
    await sql.end();
  }

  rl.close();
}

main().catch((err) => {
  console.error('Wipe failed:', err);
  rl.close();
  process.exit(1);
});
