/**
 * Seed script to generate student submissions for SC2007 assignments.
 *
 * Creates submissions with varying quality levels (good/average/poor) for
 * all 60 students enrolled in SC2007. Some submissions are graded, some
 * are submitted but ungraded, and some remain as drafts.
 *
 * Prerequisites: Run `npm run db:seed` first to create courses, users,
 * questions, and assignments.
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

// ── Written answer generators by quality ──

const WRITTEN_ANSWERS: Record<string, { good: string; average: string; poor: string }> = {
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

// ── UML answer generators by quality (PlantUML) ──

const UML_ANSWERS: Record<string, { good: string; average: string; poor: string }> = {
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
};

// ── MCQ answer generators ──

function generateMcqAnswer(isCorrect: boolean): object {
  // MCQ answers store the selected option ID
  if (isCorrect) {
    return { selectedOptionId: 'a' }; // 'a' is always the correct answer in seed data
  }
  return { selectedOptionId: pick(['b', 'c', 'd']) };
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  console.log('Seeding SC2007 submissions...\n');

  // ── Fetch SC2007 course, assignments, questions, and enrolled students ──
  const [course] = await sql`SELECT id FROM courses WHERE code = 'SC2007'`;
  if (!course) {
    console.error('SC2007 course not found. Run npm run db:seed first.');
    process.exit(1);
  }
  const courseId = course.id as string;

  const assignments = await sql`
    SELECT id, title FROM assignments WHERE course_id = ${courseId} ORDER BY title
  `;
  if (assignments.length === 0) {
    console.error('No assignments found for SC2007. Run npm run db:seed first.');
    process.exit(1);
  }

  // Get enrolled students
  const students = await sql`
    SELECT u.id, u.name FROM users u
    JOIN enrollments e ON e.user_id = u.id
    WHERE e.course_id = ${courseId} AND e.role = 'student'
    ORDER BY u.email
  `;
  console.log(`Found ${students.length} students enrolled in SC2007`);

  // Get lecturer for grading
  const [lecturer] = await sql`
    SELECT u.id FROM users u
    JOIN enrollments e ON e.user_id = u.id
    WHERE e.course_id = ${courseId} AND e.role = 'lecturer'
  `;
  const lecturerId = lecturer.id as string;

  // Process each assignment
  for (const assignment of assignments) {
    const assignmentId = assignment.id as string;
    const assignmentTitle = assignment.title as string;
    console.log(`\nProcessing: ${assignmentTitle}`);

    // Get questions for this assignment
    const questions = await sql`
      SELECT q.id, q.type, q.title, q.points, q.content
      FROM questions q
      JOIN assignment_questions aq ON aq.question_id = q.id
      WHERE aq.assignment_id = ${assignmentId}
      ORDER BY aq."order"
    `;

    // Clean up existing submissions for this assignment to avoid conflicts
    await sql`DELETE FROM submissions WHERE assignment_id = ${assignmentId}`;

    let submittedCount = 0;
    let gradedCount = 0;
    let draftCount = 0;

    for (let si = 0; si < students.length; si++) {
      const studentId = students[si].id as string;

      // Determine submission status distribution:
      // 70% submitted & graded, 15% submitted (awaiting grading), 10% draft, 5% no submission
      const roll = Math.random();
      if (roll > 0.95) continue; // 5% skip (no submission)

      const isGraded = roll < 0.70;
      const isDraft = roll >= 0.85;

      // Determine quality tier: 30% good, 45% average, 25% poor
      const qualityRoll = Math.random();
      const quality: 'good' | 'average' | 'poor' =
        qualityRoll < 0.30 ? 'good' : qualityRoll < 0.75 ? 'average' : 'poor';

      const startedAt = minutesAgo(randomInt(120, 2880)); // 2h to 2 days ago
      const submittedAt = isDraft ? null : new Date(startedAt.getTime() + randomInt(15, 90) * 60_000);
      const status = isDraft ? 'draft' : isGraded ? 'graded' : 'submitted';

      const submissionId = randomUUID();
      const questionIds = questions.map(q => q.id as string);

      await sql`
        INSERT INTO submissions (id, assignment_id, user_id, attempt_number, status, started_at, submitted_at, graded_at, question_order, created_at, updated_at)
        VALUES (
          ${submissionId},
          ${assignmentId},
          ${studentId},
          1,
          ${status},
          ${startedAt},
          ${submittedAt},
          ${isGraded && submittedAt ? new Date(submittedAt.getTime() + randomInt(5, 60) * 60_000) : null},
          ${JSON.stringify(questionIds)},
          ${startedAt},
          ${submittedAt ?? startedAt}
        )
      `;

      // Create answers for each question
      for (const question of questions) {
        const qType = question.type as string;
        const qTitle = question.title as string;
        const qPoints = question.points as number;
        const answerId = randomUUID();

        let answerContent: object;

        if (qType === 'mcq') {
          // Good students get ~90% right, average ~60%, poor ~30%
          const correctChance = quality === 'good' ? 0.9 : quality === 'average' ? 0.6 : 0.3;
          answerContent = generateMcqAnswer(Math.random() < correctChance);
        } else if (qType === 'written') {
          const answers = WRITTEN_ANSWERS[qTitle];
          if (answers) {
            answerContent = { text: answers[quality] };
          } else {
            // Fallback generic answer
            answerContent = { text: quality === 'good'
              ? 'This is a comprehensive answer covering all key aspects of the topic with examples and analysis.'
              : quality === 'average'
              ? 'This answer covers the main points but lacks depth and examples.'
              : 'Brief answer without much detail.' };
          }
        } else if (qType === 'uml') {
          const answers = UML_ANSWERS[qTitle];
          if (answers) {
            answerContent = { umlText: answers[quality] };
          } else {
            answerContent = { umlText: '@startuml\nclass Example {\n  -field: String\n}\n@enduml' };
          }
        } else {
          answerContent = { text: 'Answer placeholder' };
        }

        await sql`
          INSERT INTO answers (id, submission_id, question_id, content, created_at, updated_at)
          VALUES (${answerId}, ${submissionId}, ${question.id}, ${JSON.stringify(answerContent)}, ${startedAt}, ${submittedAt ?? startedAt})
        `;

        // Create marks for graded submissions
        if (isGraded && !isDraft) {
          let points: number;
          if (qType === 'mcq') {
            // MCQ: either full marks or 0
            const selectedId = (answerContent as { selectedOptionId: string }).selectedOptionId;
            points = selectedId === 'a' ? qPoints : 0;
          } else {
            // Written/UML: score based on quality
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

    console.log(`  ${gradedCount} graded, ${submittedCount} submitted, ${draftCount} drafts`);
  }

  console.log('\nSC2007 submissions seed complete!');
  await sql.end();
}

main().catch((err) => {
  console.error('Seed submissions failed:', err);
  process.exit(1);
});
