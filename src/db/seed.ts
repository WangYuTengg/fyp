/**
 * Seed script for demo/testing data.
 *
 * Creates:
 * - 1 admin
 * - 2 staff (1 lecturer for SC2007, 1 lecturer for SC3004)
 * - 50 students (all enrolled in SC2007)
 * - 2 courses: SC2007 (populated), SC3004 (empty)
 * - 18 questions in SC2007: 10 MCQ + 3 Written + 5 UML
 * - 1 assignment in SC2007 containing all 18 questions
 *
 * Usage:
 *   npm run db:seed
 */
import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const DEFAULT_PASSWORD = 'password123';
const POPULATED_COURSE = 'SC2007';

const COURSES = [
  { code: 'SC2007', name: 'Software Engineering', description: 'Introduction to software engineering principles, SDLC, requirements engineering, testing, and project management.' },
  { code: 'SC3004', name: 'Advanced Software Engineering', description: 'Advanced topics in software engineering including software architecture, design patterns, UML modeling, and agile methodologies.' },
] as const;

const STAFF = [
  { email: 'staff01@seed.local', name: 'Dr. Karen Yap', courseCode: 'SC2007' },
  { email: 'staff02@seed.local', name: 'Dr. Frank Lee', courseCode: 'SC3004' },
] as const;

const STUDENT_FIRST_NAMES = ['Wei', 'Jun', 'Yi', 'Xin', 'Hui', 'Jia', 'Zhi', 'Hao', 'Min', 'Ling', 'Aiden', 'Bella', 'Caleb', 'Diana', 'Ethan', 'Fiona', 'George', 'Hannah', 'Ivan', 'Julia', 'Kevin', 'Laura', 'Marcus', 'Nadia', 'Oscar'];
const STUDENT_LAST_NAMES = ['Tan', 'Lim', 'Lee', 'Ng', 'Wong', 'Chen', 'Goh', 'Ong', 'Teo', 'Ho'];

function studentName(i: number): string {
  return `${STUDENT_FIRST_NAMES[i % STUDENT_FIRST_NAMES.length]} ${STUDENT_LAST_NAMES[i % STUDENT_LAST_NAMES.length]}`;
}

// ── Question data (all for the populated course) ──

type McqQuestion = {
  title: string;
  description: string;
  points: number;
  tags: string[];
  content: { question: string; options: Array<{ id: string; text: string; isCorrect: boolean }> };
};

type WrittenQuestion = {
  title: string;
  description: string;
  points: number;
  tags: string[];
  content: { prompt: string; modelAnswer: string };
  rubric: { criteria: Array<{ description: string; maxPoints: number }> };
};

type UmlQuestion = {
  title: string;
  description: string;
  points: number;
  tags: string[];
  content: { umlSubtype: 'class' | 'sequence'; prompt: string; modelAnswer: string };
  rubric: { criteria: Array<{ description: string; maxPoints: number }> };
};

const MCQ_QUESTIONS: McqQuestion[] = [
  { title: 'SDLC Phases', description: 'Software Development Life Cycle phases', points: 5, tags: ['sdlc'],
    content: { question: 'What is the correct order of SDLC phases in the Waterfall model?', options: [
      { id: 'a', text: 'Requirements → Design → Implementation → Testing → Deployment → Maintenance', isCorrect: true },
      { id: 'b', text: 'Coding → Testing → Deployment', isCorrect: false },
      { id: 'c', text: 'Planning → Coding → Release', isCorrect: false },
      { id: 'd', text: 'Analysis → Coding → Maintenance', isCorrect: false },
    ] } },
  { title: 'Requirements Types', description: 'Functional vs non-functional requirements', points: 5, tags: ['requirements'],
    content: { question: '"The system shall respond within 2 seconds" is an example of what type of requirement?', options: [
      { id: 'a', text: 'Non-functional requirement', isCorrect: true },
      { id: 'b', text: 'Functional requirement', isCorrect: false },
      { id: 'c', text: 'Business requirement', isCorrect: false },
      { id: 'd', text: 'User requirement', isCorrect: false },
    ] } },
  { title: 'Testing Levels', description: 'Software testing levels', points: 5, tags: ['testing'],
    content: { question: 'What is the correct order of testing levels (from smallest to largest scope)?', options: [
      { id: 'a', text: 'Unit → Integration → System → Acceptance', isCorrect: true },
      { id: 'b', text: 'Acceptance → System → Integration → Unit', isCorrect: false },
      { id: 'c', text: 'Code Review → Unit → Deployment', isCorrect: false },
      { id: 'd', text: 'Alpha → Beta → Release', isCorrect: false },
    ] } },
  { title: 'Version Control', description: 'Version control concepts', points: 5, tags: ['version-control', 'git'],
    content: { question: 'Which of the following is a distributed version control system?', options: [
      { id: 'a', text: 'Git', isCorrect: true },
      { id: 'b', text: 'Docker', isCorrect: false },
      { id: 'c', text: 'Jenkins', isCorrect: false },
      { id: 'd', text: 'Jira', isCorrect: false },
    ] } },
  { title: 'Code Review Benefits', description: 'Benefits of code review', points: 5, tags: ['code-review', 'quality'],
    content: { question: 'What are benefits of code review?', options: [
      { id: 'a', text: 'All of the above', isCorrect: true },
      { id: 'b', text: 'Finding bugs early', isCorrect: false },
      { id: 'c', text: 'Knowledge sharing among team members', isCorrect: false },
      { id: 'd', text: 'Improving code quality and consistency', isCorrect: false },
    ] } },
  { title: 'Scrum Roles', description: 'Roles in Scrum methodology', points: 5, tags: ['agile', 'scrum'],
    content: { question: 'What are the three roles in Scrum?', options: [
      { id: 'a', text: 'Product Owner, Scrum Master, Development Team', isCorrect: true },
      { id: 'b', text: 'Project Manager, Developer, Tester', isCorrect: false },
      { id: 'c', text: 'CEO, CTO, Developer', isCorrect: false },
      { id: 'd', text: 'Analyst, Designer, Programmer', isCorrect: false },
    ] } },
  { title: 'Coupling and Cohesion', description: 'Understanding coupling and cohesion', points: 5, tags: ['design', 'quality'],
    content: { question: 'What is generally considered good software design?', options: [
      { id: 'a', text: 'Low coupling and high cohesion', isCorrect: true },
      { id: 'b', text: 'High coupling and low cohesion', isCorrect: false },
      { id: 'c', text: 'High coupling and high cohesion', isCorrect: false },
      { id: 'd', text: 'Low coupling and low cohesion', isCorrect: false },
    ] } },
  { title: 'CI/CD Pipeline', description: 'Continuous Integration and Deployment', points: 5, tags: ['devops', 'ci-cd'],
    content: { question: 'What is CI/CD?', options: [
      { id: 'a', text: 'Automating the build, test, and deployment process', isCorrect: true },
      { id: 'b', text: 'Writing code continuously without breaks', isCorrect: false },
      { id: 'c', text: 'A version control branching strategy', isCorrect: false },
      { id: 'd', text: 'A project management methodology', isCorrect: false },
    ] } },
  { title: 'Black Box vs White Box Testing', description: 'Testing approaches', points: 5, tags: ['testing'],
    content: { question: 'What is the difference between black box and white box testing?', options: [
      { id: 'a', text: 'Black box tests functionality without knowing internal structure; white box tests with knowledge of internal structure', isCorrect: true },
      { id: 'b', text: 'Black box is manual testing; white box is automated testing', isCorrect: false },
      { id: 'c', text: 'Black box is unit testing; white box is integration testing', isCorrect: false },
      { id: 'd', text: 'There is no difference', isCorrect: false },
    ] } },
  { title: 'Code Smells', description: 'Identifying code smells', points: 5, tags: ['refactoring', 'quality'],
    content: { question: 'What are code smells?', options: [
      { id: 'a', text: 'Indicators of potential problems in code that may need refactoring', isCorrect: true },
      { id: 'b', text: 'Syntax errors in code', isCorrect: false },
      { id: 'c', text: 'Security vulnerabilities', isCorrect: false },
      { id: 'd', text: 'Performance bottlenecks', isCorrect: false },
    ] } },
];

const WRITTEN_QUESTIONS: WrittenQuestion[] = [
  { title: 'Waterfall vs Agile', description: 'Compare Waterfall and Agile methodologies', points: 20, tags: ['sdlc', 'methodology'],
    content: { prompt: 'Compare the Waterfall and Agile software development methodologies. Discuss the strengths and weaknesses of each approach, and describe scenarios where each methodology would be most appropriate.',
      modelAnswer: 'Waterfall is a sequential, phase-based approach (Requirements → Design → Implementation → Testing → Deployment). Strengths: clear milestones, thorough documentation, predictable timelines. Weaknesses: inflexible to change, late testing, customer sees product only at the end. Agile is iterative and incremental, delivering working software in short sprints. Strengths: adaptable to change, continuous feedback, early delivery of value. Weaknesses: scope creep risk, requires experienced teams, less documentation. Use Waterfall for well-defined, stable requirements (e.g., embedded systems, regulatory projects). Use Agile for evolving requirements and customer-facing applications.' },
    rubric: { criteria: [
      { description: 'Accurate description of Waterfall methodology', maxPoints: 5 },
      { description: 'Accurate description of Agile methodology', maxPoints: 5 },
      { description: 'Strengths and weaknesses comparison', maxPoints: 5 },
      { description: 'Appropriate scenario recommendations', maxPoints: 5 },
    ] } },
  { title: 'Requirements Elicitation', description: 'Discuss requirements elicitation techniques', points: 15, tags: ['requirements', 'elicitation'],
    content: { prompt: 'Describe at least four requirements elicitation techniques. For each technique, explain when it is most effective and provide an example of how it would be used in a real project.',
      modelAnswer: 'Four key techniques: (1) Interviews — one-on-one discussions with stakeholders; best for understanding individual perspectives and uncovering implicit requirements. (2) Surveys/Questionnaires — collecting input from many users; effective for large user bases and quantitative data. (3) Workshops/JAD sessions — collaborative group sessions; best for resolving conflicts and building consensus. (4) Prototyping — building mockups for user feedback; effective when requirements are unclear and users need something tangible to react to. Additional techniques include observation, document analysis, and use case modeling.' },
    rubric: { criteria: [
      { description: 'Description of at least 4 techniques', maxPoints: 8 },
      { description: 'Effectiveness analysis and real-world examples', maxPoints: 7 },
    ] } },
  { title: 'Software Testing Strategy', description: 'Design a testing strategy for a web application', points: 15, tags: ['testing', 'strategy'],
    content: { prompt: 'Design a comprehensive testing strategy for an e-commerce web application. Include the types of tests you would write, the tools you would use, and how you would integrate testing into the CI/CD pipeline.',
      modelAnswer: 'A comprehensive testing strategy includes: Unit tests (Jest/Vitest) for individual functions and components. Integration tests for API endpoints and database operations. E2E tests (Playwright/Cypress) for critical user flows like checkout and payment. Performance tests (k6/Artillery) for load testing. Security tests (OWASP ZAP) for vulnerability scanning. CI/CD integration: run unit and integration tests on every PR, E2E tests on merge to main, performance tests nightly, and security scans weekly. Use code coverage thresholds (e.g., 80%) as merge gates.' },
    rubric: { criteria: [
      { description: 'Comprehensive coverage of testing types', maxPoints: 5 },
      { description: 'Appropriate tool selection', maxPoints: 5 },
      { description: 'CI/CD integration plan', maxPoints: 5 },
    ] } },
];

const UML_QUESTIONS: UmlQuestion[] = [
  { title: 'Class Diagram: Hospital System', description: 'Design a class diagram for hospital management', points: 20, tags: ['uml', 'class-diagram'],
    content: { umlSubtype: 'class', prompt: 'Design a UML class diagram for a hospital management system. Include Patient, Doctor, Nurse, Appointment, MedicalRecord, Ward, and Prescription classes. Show inheritance, composition, and association relationships.',
      modelAnswer: '@startuml\nabstract class Person {\n  -id: String\n  -name: String\n  -phone: String\n}\nclass Patient extends Person {\n  -patientId: String\n  -dateOfBirth: Date\n  -bloodType: String\n}\nclass Doctor extends Person {\n  -specialization: String\n  -licenseNo: String\n}\nclass Nurse extends Person {\n  -department: String\n  -shift: String\n}\nclass Appointment {\n  -dateTime: DateTime\n  -status: String\n}\nclass MedicalRecord {\n  -diagnosis: String\n  -treatment: String\n  -date: Date\n}\nclass Ward {\n  -wardNo: String\n  -capacity: int\n  -type: String\n}\nclass Prescription {\n  -medication: String\n  -dosage: String\n  -duration: String\n}\nPatient "1" -- "0..*" Appointment\nDoctor "1" -- "0..*" Appointment\nPatient "1" *-- "0..*" MedicalRecord\nDoctor "1" -- "0..*" MedicalRecord\nMedicalRecord "1" *-- "0..*" Prescription\nWard "1" -- "0..*" Patient\nWard "1" -- "0..*" Nurse\n@enduml' },
    rubric: { criteria: [
      { description: 'Complete class definitions with attributes and methods', maxPoints: 8 },
      { description: 'Correct relationships and multiplicities', maxPoints: 7 },
      { description: 'Proper use of inheritance and composition', maxPoints: 5 },
    ] } },
  { title: 'Sequence Diagram: Login Flow', description: 'Draw a sequence diagram for user login', points: 15, tags: ['uml', 'sequence-diagram'],
    content: { umlSubtype: 'sequence', prompt: 'Draw a UML sequence diagram showing the login process for a web application. Include the User, Browser, Web Server, Authentication Service, and Database as participants.',
      modelAnswer: '@startuml\nactor User\nparticipant Browser\nparticipant "Web Server" as WS\nparticipant "Auth Service" as Auth\ndatabase Database\n\nUser -> Browser: Enter credentials\nBrowser -> WS: POST /login (email, password)\nWS -> Auth: validateCredentials(email, password)\nAuth -> Database: SELECT user WHERE email = ?\nDatabase --> Auth: user record\nAuth -> Auth: verify password hash\nalt valid credentials\n  Auth --> WS: auth token\n  WS --> Browser: 200 OK + JWT\n  Browser --> User: Redirect to dashboard\nelse invalid credentials\n  Auth --> WS: authentication failed\n  WS --> Browser: 401 Unauthorized\n  Browser --> User: Show error message\nend\n@enduml' },
    rubric: { criteria: [
      { description: 'Correct participants and lifelines', maxPoints: 5 },
      { description: 'Proper message sequencing', maxPoints: 5 },
      { description: 'Correct notation (synchronous, asynchronous, return)', maxPoints: 5 },
    ] } },
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  console.log('Seeding database...\n');

  // ── 1. Admin ──
  await sql`
    INSERT INTO users (id, email, name, role, password_hash)
    VALUES (${randomUUID()}, 'admin@seed.local', 'Admin User', 'admin', ${passwordHash})
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = 'Admin User', role = 'admin'
  `;
  console.log('Created admin: admin@seed.local');

  // ── 2. Staff ──
  for (const s of STAFF) {
    await sql`
      INSERT INTO users (id, email, name, role, password_hash)
      VALUES (${randomUUID()}, ${s.email}, ${s.name}, 'staff', ${passwordHash})
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = ${s.name}, role = 'staff'
    `;
  }
  console.log(`Created ${STAFF.length} staff`);

  // ── 3. Students ──
  for (let i = 0; i < 50; i++) {
    const email = `student${String(i + 1).padStart(3, '0')}@seed.local`;
    const name = studentName(i);
    await sql`
      INSERT INTO users (id, email, name, role, password_hash)
      VALUES (${randomUUID()}, ${email}, ${name}, 'student', ${passwordHash})
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = ${name}, role = 'student'
    `;
  }
  console.log('Created 50 students');

  // ── 4. Courses ──
  for (const c of COURSES) {
    await sql`
      INSERT INTO courses (id, code, name, description, academic_year, semester, is_active)
      VALUES (${randomUUID()}, ${c.code}, ${c.name}, ${c.description}, '2025/2026', 'Semester 2', true)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true
    `;
  }
  console.log(`Created ${COURSES.length} courses: ${COURSES.map(c => c.code).join(', ')}`);

  // ── Look up IDs (ON CONFLICT DO UPDATE may not return RETURNING for old rows reliably) ──
  const courseRows = await sql<Array<{ id: string; code: string }>>`
    SELECT id, code FROM courses WHERE code = ANY(${COURSES.map(c => c.code)})
  `;
  const courseIdByCode = Object.fromEntries(courseRows.map(r => [r.code, r.id]));

  const staffRows = await sql<Array<{ id: string; email: string }>>`
    SELECT id, email FROM users WHERE email = ANY(${STAFF.map(s => s.email)})
  `;
  const staffIdByEmail = Object.fromEntries(staffRows.map(r => [r.email, r.id]));

  const studentRows = await sql<Array<{ id: string }>>`
    SELECT id FROM users WHERE email LIKE 'student%@seed.local' ORDER BY email
  `;
  const studentIds = studentRows.map(r => r.id);

  const populatedCourseId = courseIdByCode[POPULATED_COURSE];
  const populatedLecturerId = staffIdByEmail[STAFF.find(s => s.courseCode === POPULATED_COURSE)!.email];

  // ── 5. Enroll staff (1 lecturer per course) ──
  for (const s of STAFF) {
    await sql`
      INSERT INTO enrollments (user_id, course_id, role)
      VALUES (${staffIdByEmail[s.email]}, ${courseIdByCode[s.courseCode]}, 'lecturer')
      ON CONFLICT ON CONSTRAINT enrollments_user_id_course_id_unique DO NOTHING
    `;
  }
  console.log('Enrolled 1 lecturer per course');

  // ── 6. Enroll all students in the populated course only ──
  for (const id of studentIds) {
    await sql`
      INSERT INTO enrollments (user_id, course_id, role)
      VALUES (${id}, ${populatedCourseId}, 'student')
      ON CONFLICT ON CONSTRAINT enrollments_user_id_course_id_unique DO NOTHING
    `;
  }
  console.log(`Enrolled 50 students in ${POPULATED_COURSE}`);

  // ── 7. Wipe and re-create questions + assignment for the populated course ──
  // Cascades to assignment_questions, submissions, answers, marks.
  await sql`DELETE FROM assignments WHERE course_id = ${populatedCourseId}`;
  await sql`DELETE FROM questions WHERE course_id = ${populatedCourseId}`;

  const questionIds: string[] = [];

  for (const q of MCQ_QUESTIONS) {
    const id = randomUUID();
    questionIds.push(id);
    await sql`
      INSERT INTO questions (id, course_id, type, title, description, content, points, tags, created_by)
      VALUES (${id}, ${populatedCourseId}, 'mcq', ${q.title}, ${q.description}, ${sql.json(q.content)}, ${q.points}, ${q.tags}, ${populatedLecturerId})
    `;
  }
  for (const q of WRITTEN_QUESTIONS) {
    const id = randomUUID();
    questionIds.push(id);
    await sql`
      INSERT INTO questions (id, course_id, type, title, description, content, rubric, points, tags, created_by)
      VALUES (${id}, ${populatedCourseId}, 'written', ${q.title}, ${q.description}, ${sql.json(q.content)}, ${sql.json(q.rubric)}, ${q.points}, ${q.tags}, ${populatedLecturerId})
    `;
  }
  for (const q of UML_QUESTIONS) {
    const id = randomUUID();
    questionIds.push(id);
    await sql`
      INSERT INTO questions (id, course_id, type, title, description, content, rubric, points, tags, created_by)
      VALUES (${id}, ${populatedCourseId}, 'uml', ${q.title}, ${q.description}, ${sql.json(q.content)}, ${sql.json(q.rubric)}, ${q.points}, ${q.tags}, ${populatedLecturerId})
    `;
  }
  console.log(`Created ${questionIds.length} questions (${MCQ_QUESTIONS.length} MCQ, ${WRITTEN_QUESTIONS.length} written, ${UML_QUESTIONS.length} UML)`);

  // ── 8. Single assignment containing all questions ──
  const assignmentId = randomUUID();
  await sql`
    INSERT INTO assignments (id, course_id, title, description, due_date, open_date, max_attempts, is_published, created_by)
    VALUES (
      ${assignmentId},
      ${populatedCourseId},
      'SE Comprehensive Assignment',
      'Combined MCQ, written, and UML assessment covering software engineering fundamentals.',
      ${new Date('2026-04-15T23:59:59Z')},
      ${new Date('2026-03-01T00:00:00Z')},
      1,
      true,
      ${populatedLecturerId}
    )
  `;

  for (let i = 0; i < questionIds.length; i++) {
    await sql`
      INSERT INTO assignment_questions (assignment_id, question_id, "order")
      VALUES (${assignmentId}, ${questionIds[i]}, ${i + 1})
    `;
  }
  console.log(`Created 1 assignment with ${questionIds.length} questions attached`);

  console.log('\nSeed complete!');
  console.log('─────────────────────────────────');
  console.log('All users have password: password123');
  console.log('Admin:    admin@seed.local');
  console.log(`Staff:    ${STAFF.map(s => `${s.email} (${s.courseCode})`).join(', ')}`);
  console.log('Students: student001@seed.local ... student050@seed.local');
  console.log('─────────────────────────────────');

  await sql.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
