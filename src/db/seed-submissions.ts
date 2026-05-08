/**
 * Seed script to generate student submissions for the SC2007 assignment.
 *
 * Creates submissions with varying quality tiers (good/average/poor) for
 * all 50 students enrolled in SC2007. Status distribution: ~70% graded,
 * ~15% submitted (awaiting grading), ~10% draft, ~5% no submission.
 *
 * Prerequisites: Run `npm run db:seed` first to create the course,
 * users, questions, and assignment.
 *
 * Usage:
 *   npm run db:seed-submissions
 */
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

// ── Helpers ──

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

// ── Per-question quality-tiered answers ──
// Keys must exactly match question titles in seed.ts.

type QualityTiers = { good: string; average: string; poor: string };

const WRITTEN_ANSWERS: Record<string, QualityTiers> = {
  'Waterfall vs Agile': {
    good: 'Waterfall follows a sequential process: requirements, design, implementation, testing, and deployment. Each phase must complete before the next begins. Its strengths include clear documentation, predictable timelines, and well-defined milestones. However, it is inflexible to changing requirements and testing happens late. Agile uses iterative sprints (2-4 weeks) to deliver working increments. Strengths include adaptability, continuous customer feedback, and early value delivery. Weaknesses include potential scope creep and the need for experienced, self-organizing teams. Waterfall suits projects with stable, well-understood requirements like embedded systems. Agile is better for web applications and products with evolving requirements.',
    average: 'Waterfall is a linear process where you go through phases one at a time. Agile is iterative and works in sprints. Waterfall is good when requirements are fixed, and Agile is good when requirements change. Waterfall has more documentation while Agile focuses on working software. Both have their uses depending on the project.',
    poor: 'Waterfall is the old way of doing software and Agile is the new way. Agile is better because it is faster and more modern. Most companies use Agile now.',
  },
  'Requirements Elicitation': {
    good: 'Four key elicitation techniques: (1) Interviews — structured or unstructured one-on-one sessions with stakeholders. Most effective for understanding individual perspectives and uncovering implicit needs. Example: interviewing hospital nurses to understand their daily workflow before designing a patient management system. (2) Surveys — distributing questionnaires to large groups. Effective for gathering quantitative data and identifying trends. Example: surveying 500 students about their preferred features in a learning management system. (3) Workshops (JAD sessions) — facilitated group sessions where stakeholders collaboratively define requirements. Best for resolving conflicts and building consensus. Example: bringing together marketing, engineering, and support teams to define requirements for a CRM system. (4) Prototyping — building interactive mockups to elicit feedback. Effective when users struggle to articulate needs without seeing something tangible. Example: creating wireframes of a mobile banking app to validate the user flow with customers.',
    average: 'There are several techniques for gathering requirements. Interviews involve talking to stakeholders directly. Surveys let you ask many people at once. Workshops bring people together to discuss requirements. Prototyping shows users what the system might look like. Each technique has its place and you should use a combination of them.',
    poor: 'You can get requirements by asking people what they want. Interviews and surveys are the main ways. Sometimes you make a prototype too.',
  },
  'Software Testing Strategy': {
    good: 'For an e-commerce application, I would implement a multi-layered testing strategy. Unit tests (using Jest) would cover individual functions like price calculations and cart logic. Integration tests would verify API endpoints and database interactions using a test database. End-to-end tests (using Playwright) would cover critical user journeys: browsing products, adding to cart, checkout, and payment. Performance testing with k6 would simulate concurrent users during peak loads. Security testing with OWASP ZAP would scan for vulnerabilities like XSS and SQL injection. CI/CD integration: unit and integration tests run on every PR as a merge gate (requiring 80% coverage), E2E tests run on merge to main, performance tests run nightly, and security scans run weekly. Failed tests block deployment.',
    average: 'I would write unit tests for the main functions, integration tests for the APIs, and some end-to-end tests for the checkout flow. I would use Jest for unit tests and maybe Cypress for E2E. Tests would run in the CI pipeline before deployment.',
    poor: 'Testing is important for quality. I would test the main features manually and also write some automated tests. The tests should run before we deploy the code.',
  },
};

const UML_ANSWERS: Record<string, QualityTiers> = {
  'Use Case Diagram: Student Portal': {
    good: '@startuml\nleft to right direction\nactor Student\nactor Professor\nactor Admin\nrectangle "Student Portal" {\n  usecase "Enroll in Course" as UC1\n  usecase "View Grades" as UC2\n  usecase "Submit Assignment" as UC3\n  usecase "Manage Courses" as UC4\n  usecase "Grade Assignments" as UC5\n  usecase "Manage Users" as UC6\n  usecase "Login" as UC7\n  usecase "View Course Materials" as UC8\n}\nStudent --> UC1\nStudent --> UC2\nStudent --> UC3\nStudent --> UC8\nProfessor --> UC4\nProfessor --> UC5\nProfessor --> UC8\nAdmin --> UC6\nUC1 ..> UC7 : <<include>>\nUC3 ..> UC7 : <<include>>\nUC5 ..> UC7 : <<include>>\n@enduml',
    average: '@startuml\nactor Student\nactor Professor\nactor Admin\nrectangle "Portal" {\n  usecase "Enroll" as UC1\n  usecase "View Grades" as UC2\n  usecase "Submit Assignment" as UC3\n  usecase "Manage Courses" as UC4\n  usecase "Grade" as UC5\n}\nStudent --> UC1\nStudent --> UC2\nStudent --> UC3\nProfessor --> UC4\nProfessor --> UC5\nAdmin --> UC4\n@enduml',
    poor: '@startuml\nactor Student\nactor Professor\nusecase "Use Portal" as UC1\nStudent --> UC1\nProfessor --> UC1\n@enduml',
  },
  'Activity Diagram: Bug Fix Process': {
    good: '@startuml\nstart\n:Report Bug;\n:Triage Bug;\nif (Severity?) then (Critical)\n  :Assign to Senior Dev;\nelse (Normal)\n  :Assign to Developer;\nendif\n:Investigate & Fix Bug;\nfork\n  :Code Review;\nfork again\n  :Write Unit Tests;\nend fork\nif (Review Approved?) then (Yes)\n  :Run CI Pipeline;\n  if (Tests Pass?) then (Yes)\n    :Deploy to Staging;\n    :QA Verification;\n    :Deploy to Production;\n    :Close Bug Ticket;\n  else (No)\n    :Fix Failing Tests;\n  endif\nelse (No)\n  :Address Comments;\nendif\nstop\n@enduml',
    average: '@startuml\nstart\n:Report Bug;\n:Assign Developer;\n:Fix Bug;\n:Code Review;\nif (Approved?) then (Yes)\n  :Test;\n  :Deploy;\nelse (No)\n  :Revise;\nendif\nstop\n@enduml',
    poor: '@startuml\nstart\n:Find Bug;\n:Fix Bug;\n:Deploy;\nstop\n@enduml',
  },
  'Class Diagram: Hospital System': {
    good: '@startuml\nabstract class Person {\n  -id: String\n  -name: String\n  -phone: String\n  -email: String\n}\nclass Patient extends Person {\n  -patientId: String\n  -dateOfBirth: Date\n  -bloodType: String\n  -allergies: String[]\n  +getAge(): int\n}\nclass Doctor extends Person {\n  -specialization: String\n  -licenseNo: String\n  +prescribeMedication(): Prescription\n}\nclass Nurse extends Person {\n  -department: String\n  -shift: String\n}\nclass Appointment {\n  -dateTime: DateTime\n  -status: String\n  -reason: String\n}\nclass MedicalRecord {\n  -diagnosis: String\n  -treatment: String\n  -date: Date\n  -notes: String\n}\nclass Ward {\n  -wardNo: String\n  -capacity: int\n  -type: String\n}\nclass Prescription {\n  -medication: String\n  -dosage: String\n  -duration: String\n  -instructions: String\n}\nPatient "1" -- "0..*" Appointment\nDoctor "1" -- "0..*" Appointment\nPatient "1" *-- "0..*" MedicalRecord\nDoctor "1" -- "0..*" MedicalRecord : creates\nMedicalRecord "1" *-- "0..*" Prescription\nWard "1" -- "0..*" Patient : admits\nWard "1" -- "1..*" Nurse : assigned to\n@enduml',
    average: '@startuml\nclass Patient {\n  -name: String\n  -id: String\n}\nclass Doctor {\n  -name: String\n  -specialization: String\n}\nclass Appointment {\n  -date: Date\n}\nclass MedicalRecord {\n  -diagnosis: String\n}\nclass Ward {\n  -wardNo: String\n}\nPatient -- Appointment\nDoctor -- Appointment\nPatient -- MedicalRecord\nPatient -- Ward\n@enduml',
    poor: '@startuml\nclass Patient\nclass Doctor\nclass Hospital\nPatient -- Doctor\nDoctor -- Hospital\n@enduml',
  },
  'Sequence Diagram: Login Flow': {
    good: '@startuml\nactor User\nparticipant Browser\nparticipant "Web Server" as WS\nparticipant "Auth Service" as Auth\ndatabase Database\n\nUser -> Browser: Enter credentials\nBrowser -> WS: POST /login (email, password)\nWS -> Auth: validateCredentials(email, password)\nAuth -> Database: SELECT user WHERE email = ?\nDatabase --> Auth: user record\nAuth -> Auth: verify password hash\nalt valid credentials\n  Auth --> WS: auth token\n  WS --> Browser: 200 OK + JWT\n  Browser --> User: Redirect to dashboard\nelse invalid credentials\n  Auth --> WS: authentication failed\n  WS --> Browser: 401 Unauthorized\n  Browser --> User: Show error message\nend\n@enduml',
    average: '@startuml\nactor User\nparticipant Browser\nparticipant Server\ndatabase Database\n\nUser -> Browser: Enter email & password\nBrowser -> Server: POST /login\nServer -> Database: lookup user\nDatabase --> Server: user record\nServer -> Server: verify password\nServer --> Browser: token or error\nBrowser --> User: dashboard or error\n@enduml',
    poor: '@startuml\nactor User\nparticipant Server\nUser -> Server: login\nServer --> User: response\n@enduml',
  },
  'State Diagram: Order Lifecycle': {
    good: '@startuml\n[*] --> Created\nCreated --> Confirmed : payment received\nCreated --> Cancelled : user cancels\nConfirmed --> Processing : warehouse picks order\nConfirmed --> Cancelled : cancel before processing\nProcessing --> Shipped : handed to courier\nShipped --> Delivered : delivery confirmed\nDelivered --> Returned : return requested\nDelivered --> [*]\nReturned --> [*]\nCancelled --> [*]\n@enduml',
    average: '@startuml\n[*] --> Created\nCreated --> Confirmed\nConfirmed --> Shipped\nShipped --> Delivered\nDelivered --> [*]\nCreated --> Cancelled\nCancelled --> [*]\n@enduml',
    poor: '@startuml\n[*] --> New\nNew --> Done\nDone --> [*]\n@enduml',
  },
};

function generateMcqAnswer(isCorrect: boolean): { selectedOptionId: string } {
  // 'a' is always the correct option in seed data.
  return { selectedOptionId: isCorrect ? 'a' : pick(['b', 'c', 'd']) };
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  console.log('Seeding SC2007 submissions...\n');

  const [course] = await sql`SELECT id FROM courses WHERE code = 'SC2007'`;
  if (!course) {
    console.error('SC2007 course not found. Run npm run db:seed first.');
    process.exit(1);
  }
  const courseId = course.id as string;

  const [assignment] = await sql`
    SELECT id, title FROM assignments WHERE course_id = ${courseId}
  `;
  if (!assignment) {
    console.error('No assignment found for SC2007. Run npm run db:seed first.');
    process.exit(1);
  }
  const assignmentId = assignment.id as string;
  console.log(`Assignment: ${assignment.title}`);

  const [lecturer] = await sql`
    SELECT u.id FROM users u
    JOIN enrollments e ON e.user_id = u.id
    WHERE e.course_id = ${courseId} AND e.role = 'lecturer'
  `;
  const lecturerId = lecturer.id as string;

  const students = await sql`
    SELECT u.id FROM users u
    JOIN enrollments e ON e.user_id = u.id
    WHERE e.course_id = ${courseId} AND e.role = 'student'
    ORDER BY u.email
  `;
  console.log(`Found ${students.length} students enrolled in SC2007`);

  const questions = await sql`
    SELECT q.id, q.type, q.title, q.points
    FROM questions q
    JOIN assignment_questions aq ON aq.question_id = q.id
    WHERE aq.assignment_id = ${assignmentId}
    ORDER BY aq."order"
  `;
  console.log(`Assignment has ${questions.length} questions`);

  // Wipe existing submissions for clean re-run
  await sql`DELETE FROM submissions WHERE assignment_id = ${assignmentId}`;

  let submittedCount = 0;
  let gradedCount = 0;
  let draftCount = 0;

  for (const student of students) {
    const studentId = student.id as string;

    // Status distribution: ~70% graded, ~15% submitted, ~10% draft, ~5% absent
    const roll = Math.random();
    if (roll > 0.95) continue;
    const isGraded = roll < 0.70;
    const isDraft = roll >= 0.85;

    // Quality tier: 30% good, 45% average, 25% poor
    const qr = Math.random();
    const quality: keyof QualityTiers = qr < 0.30 ? 'good' : qr < 0.75 ? 'average' : 'poor';

    const startedAt = minutesAgo(randomInt(120, 2880)); // 2h to 2 days ago
    const submittedAt = isDraft ? null : new Date(startedAt.getTime() + randomInt(15, 90) * 60_000);
    const gradedAt = isGraded && submittedAt ? new Date(submittedAt.getTime() + randomInt(5, 60) * 60_000) : null;
    const status = isDraft ? 'draft' : isGraded ? 'graded' : 'submitted';

    const submissionId = randomUUID();
    const questionIds = questions.map(q => q.id as string);

    await sql`
      INSERT INTO submissions (id, assignment_id, user_id, attempt_number, status, started_at, submitted_at, graded_at, question_order, created_at, updated_at)
      VALUES (${submissionId}, ${assignmentId}, ${studentId}, 1, ${status}, ${startedAt}, ${submittedAt}, ${gradedAt}, ${sql.json(questionIds)}, ${startedAt}, ${submittedAt ?? startedAt})
    `;

    for (const q of questions) {
      const qType = q.type as string;
      const qTitle = q.title as string;
      const qPoints = q.points as number;
      const answerId = randomUUID();

      let answerContent: { selectedOptionId: string } | { text: string } | { umlText: string };
      if (qType === 'mcq') {
        // Good students get ~90% right, average ~60%, poor ~30%
        const correctChance = quality === 'good' ? 0.9 : quality === 'average' ? 0.6 : 0.3;
        answerContent = generateMcqAnswer(Math.random() < correctChance);
      } else if (qType === 'written') {
        const a = WRITTEN_ANSWERS[qTitle];
        if (!a) throw new Error(`Missing WRITTEN_ANSWERS entry for "${qTitle}"`);
        answerContent = { text: a[quality] };
      } else if (qType === 'uml') {
        const a = UML_ANSWERS[qTitle];
        if (!a) throw new Error(`Missing UML_ANSWERS entry for "${qTitle}"`);
        answerContent = { umlText: a[quality] };
      } else {
        throw new Error(`Unknown question type: ${qType}`);
      }

      await sql`
        INSERT INTO answers (id, submission_id, question_id, content, created_at, updated_at)
        VALUES (${answerId}, ${submissionId}, ${q.id}, ${sql.json(answerContent)}, ${startedAt}, ${submittedAt ?? startedAt})
      `;

      if (isGraded && !isDraft) {
        let points: number;
        if (qType === 'mcq') {
          const sel = (answerContent as { selectedOptionId: string }).selectedOptionId;
          points = sel === 'a' ? qPoints : 0;
        } else {
          const ratio = quality === 'good' ? randomInt(80, 100) / 100
            : quality === 'average' ? randomInt(50, 75) / 100
            : randomInt(15, 45) / 100;
          points = Math.round(qPoints * ratio);
        }

        const feedback = qType === 'mcq' ? null
          : quality === 'good' ? 'Well-structured answer with good coverage of key concepts.'
          : quality === 'average' ? 'Adequate answer but could benefit from more depth and examples.'
          : 'Answer lacks sufficient detail and misses several important points.';

        await sql`
          INSERT INTO marks (submission_id, answer_id, points, max_points, feedback, marked_by, is_ai_assisted, created_at, updated_at)
          VALUES (${submissionId}, ${answerId}, ${points}, ${qPoints}, ${feedback}, ${lecturerId}, ${Math.random() < 0.6}, ${new Date()}, ${new Date()})
        `;
      }
    }

    if (isDraft) draftCount++;
    else if (isGraded) gradedCount++;
    else submittedCount++;
  }

  console.log(`\nSubmissions: ${gradedCount} graded, ${submittedCount} submitted, ${draftCount} drafts`);
  console.log('SC2007 submissions seed complete!');
  await sql.end();
}

main().catch((err) => {
  console.error('Seed submissions failed:', err);
  process.exit(1);
});
