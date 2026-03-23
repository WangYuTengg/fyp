/**
 * Seed script for demo/testing data.
 *
 * Creates:
 * - 1 admin
 * - 15 staff (5 per course: 1 lecturer, 2 TAs, 2 lab execs)
 * - 200 students (distributed across 3 courses)
 * - 3 courses: SC2000, SC3004, SC2007
 * - 50 questions (mix of MCQ, Written, UML)
 * - 6 assignments (2 per course) with questions attached
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

const COURSES = [
  { code: 'SC2000', name: 'Object Oriented Programming', description: 'Fundamentals of OOP including encapsulation, inheritance, polymorphism, and design patterns using Java/C++.' },
  { code: 'SC3004', name: 'Advanced Software Engineering', description: 'Advanced topics in software engineering including software architecture, design patterns, UML modeling, and agile methodologies.' },
  { code: 'SC2007', name: 'Software Engineering', description: 'Introduction to software engineering principles, SDLC, requirements engineering, testing, and project management.' },
] as const;

// Staff: 5 per course (15 total), each assigned to one course
const STAFF_NAMES = [
  // SC2000
  'Dr. Alice Chen', 'Mr. Brian Tan', 'Ms. Clara Wong', 'Mr. Daniel Lim', 'Ms. Emily Ng',
  // SC3004
  'Dr. Frank Lee', 'Ms. Grace Ho', 'Mr. Henry Koh', 'Ms. Irene Teo', 'Mr. James Ong',
  // SC2007
  'Dr. Karen Yap', 'Mr. Liam Goh', 'Ms. Maria Soh', 'Mr. Nathan Sim', 'Ms. Olivia Tan',
];

function generateStudentName(i: number): string {
  const firstNames = [
    'Wei', 'Jun', 'Yi', 'Xin', 'Hui', 'Jia', 'Zhi', 'Hao', 'Min', 'Ling',
    'Kai', 'Rui', 'Fang', 'Yan', 'Shu', 'Mei', 'Li', 'Cheng', 'Hong', 'Qing',
    'Aiden', 'Bella', 'Caleb', 'Diana', 'Ethan', 'Fiona', 'George', 'Hannah', 'Ivan', 'Julia',
    'Kevin', 'Laura', 'Marcus', 'Nadia', 'Oscar', 'Priya', 'Quinn', 'Rachel', 'Samuel', 'Tanya',
  ];
  const lastNames = [
    'Tan', 'Lim', 'Lee', 'Ng', 'Wong', 'Chen', 'Goh', 'Ong', 'Teo', 'Ho',
    'Koh', 'Sim', 'Yap', 'Soh', 'Chua', 'Phua', 'Foo', 'Tay', 'Seah', 'Lau',
  ];
  return `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
}

// ── Question data ──

const MCQ_QUESTIONS: Array<{ title: string; description: string; content: object; points: number; tags: string[]; courseIdx: number }> = [
  // SC2000 - OOP
  { title: 'Encapsulation Basics', description: 'Understanding encapsulation in OOP', courseIdx: 0, points: 5, tags: ['oop', 'encapsulation'],
    content: { options: [
      { id: 'a', text: 'Bundling data and methods that operate on the data within a single unit', isCorrect: true },
      { id: 'b', text: 'Inheriting properties from a parent class', isCorrect: false },
      { id: 'c', text: 'Defining multiple methods with the same name', isCorrect: false },
      { id: 'd', text: 'Creating objects from a class', isCorrect: false },
    ], question: 'What is encapsulation?' } },
  { title: 'Inheritance Types', description: 'Types of inheritance in OOP', courseIdx: 0, points: 5, tags: ['oop', 'inheritance'],
    content: { options: [
      { id: 'a', text: 'Single, Multiple, Multilevel, Hierarchical, Hybrid', isCorrect: true },
      { id: 'b', text: 'Public, Private, Protected', isCorrect: false },
      { id: 'c', text: 'Abstract, Concrete, Final', isCorrect: false },
      { id: 'd', text: 'Static, Dynamic', isCorrect: false },
    ], question: 'Which of the following lists types of inheritance?' } },
  { title: 'Polymorphism', description: 'Understanding polymorphism', courseIdx: 0, points: 5, tags: ['oop', 'polymorphism'],
    content: { options: [
      { id: 'a', text: 'Compile-time and Runtime', isCorrect: true },
      { id: 'b', text: 'Static and Abstract', isCorrect: false },
      { id: 'c', text: 'Public and Private', isCorrect: false },
      { id: 'd', text: 'Synchronous and Asynchronous', isCorrect: false },
    ], question: 'What are the two types of polymorphism?' } },
  { title: 'Abstract Classes', description: 'Abstract class concepts', courseIdx: 0, points: 5, tags: ['oop', 'abstraction'],
    content: { options: [
      { id: 'a', text: 'No, abstract classes cannot be instantiated directly', isCorrect: true },
      { id: 'b', text: 'Yes, like any other class', isCorrect: false },
      { id: 'c', text: 'Only if all methods are implemented', isCorrect: false },
      { id: 'd', text: 'Only in Java', isCorrect: false },
    ], question: 'Can you create an instance of an abstract class?' } },
  { title: 'Access Modifiers', description: 'Understanding access modifiers', courseIdx: 0, points: 5, tags: ['oop', 'access-modifiers'],
    content: { options: [
      { id: 'a', text: 'Accessible only within the same class', isCorrect: true },
      { id: 'b', text: 'Accessible from any class', isCorrect: false },
      { id: 'c', text: 'Accessible within the same package', isCorrect: false },
      { id: 'd', text: 'Accessible by subclasses only', isCorrect: false },
    ], question: 'What does the "private" access modifier mean in Java?' } },
  { title: 'Interface vs Abstract Class', description: 'Comparing interfaces and abstract classes', courseIdx: 0, points: 5, tags: ['oop', 'interface'],
    content: { options: [
      { id: 'a', text: 'A class can implement multiple interfaces but extend only one abstract class', isCorrect: true },
      { id: 'b', text: 'Interfaces can have constructors', isCorrect: false },
      { id: 'c', text: 'Abstract classes support multiple inheritance', isCorrect: false },
      { id: 'd', text: 'There is no difference', isCorrect: false },
    ], question: 'What is a key difference between interfaces and abstract classes in Java?' } },

  // SC3004 - Advanced SE
  { title: 'Design Pattern Categories', description: 'Categories of GoF design patterns', courseIdx: 1, points: 5, tags: ['design-patterns'],
    content: { options: [
      { id: 'a', text: 'Creational, Structural, Behavioral', isCorrect: true },
      { id: 'b', text: 'Abstract, Concrete, Hybrid', isCorrect: false },
      { id: 'c', text: 'Simple, Complex, Compound', isCorrect: false },
      { id: 'd', text: 'Frontend, Backend, Fullstack', isCorrect: false },
    ], question: 'What are the three categories of Gang of Four design patterns?' } },
  { title: 'Singleton Pattern', description: 'Singleton design pattern', courseIdx: 1, points: 5, tags: ['design-patterns', 'singleton'],
    content: { options: [
      { id: 'a', text: 'Ensures a class has only one instance and provides a global access point', isCorrect: true },
      { id: 'b', text: 'Creates a family of related objects', isCorrect: false },
      { id: 'c', text: 'Separates object construction from its representation', isCorrect: false },
      { id: 'd', text: 'Provides a simplified interface to a complex subsystem', isCorrect: false },
    ], question: 'What is the purpose of the Singleton pattern?' } },
  { title: 'SOLID Principles', description: 'SOLID principle identification', courseIdx: 1, points: 5, tags: ['solid', 'design-principles'],
    content: { options: [
      { id: 'a', text: 'Open/Closed Principle', isCorrect: true },
      { id: 'b', text: 'Observer Pattern', isCorrect: false },
      { id: 'c', text: 'Dependency Injection', isCorrect: false },
      { id: 'd', text: 'Model-View-Controller', isCorrect: false },
    ], question: 'Which states that software entities should be open for extension but closed for modification?' } },
  { title: 'Observer Pattern', description: 'Observer design pattern', courseIdx: 1, points: 5, tags: ['design-patterns', 'observer'],
    content: { options: [
      { id: 'a', text: 'Defines a one-to-many dependency between objects', isCorrect: true },
      { id: 'b', text: 'Encapsulates a request as an object', isCorrect: false },
      { id: 'c', text: 'Provides a way to access elements of a collection sequentially', isCorrect: false },
      { id: 'd', text: 'Defines a family of algorithms', isCorrect: false },
    ], question: 'What does the Observer pattern do?' } },
  { title: 'Agile Manifesto', description: 'Core values of Agile', courseIdx: 1, points: 5, tags: ['agile', 'methodology'],
    content: { options: [
      { id: 'a', text: 'Individuals and interactions over processes and tools', isCorrect: true },
      { id: 'b', text: 'Comprehensive documentation over working software', isCorrect: false },
      { id: 'c', text: 'Contract negotiation over customer collaboration', isCorrect: false },
      { id: 'd', text: 'Following a plan over responding to change', isCorrect: false },
    ], question: 'Which is a core value of the Agile Manifesto?' } },
  { title: 'Strategy Pattern', description: 'Strategy design pattern', courseIdx: 1, points: 5, tags: ['design-patterns', 'strategy'],
    content: { options: [
      { id: 'a', text: 'Defines a family of algorithms, encapsulates each one, and makes them interchangeable', isCorrect: true },
      { id: 'b', text: 'Ensures a class has only one instance', isCorrect: false },
      { id: 'c', text: 'Converts the interface of a class into another interface', isCorrect: false },
      { id: 'd', text: 'Composes objects into tree structures', isCorrect: false },
    ], question: 'What is the Strategy pattern?' } },

  // SC2007 - SE
  { title: 'SDLC Phases', description: 'Software Development Life Cycle phases', courseIdx: 2, points: 5, tags: ['sdlc'],
    content: { options: [
      { id: 'a', text: 'Requirements → Design → Implementation → Testing → Deployment → Maintenance', isCorrect: true },
      { id: 'b', text: 'Coding → Testing → Deployment', isCorrect: false },
      { id: 'c', text: 'Planning → Coding → Release', isCorrect: false },
      { id: 'd', text: 'Analysis → Coding → Maintenance', isCorrect: false },
    ], question: 'What is the correct order of SDLC phases in the Waterfall model?' } },
  { title: 'Requirements Types', description: 'Functional vs non-functional requirements', courseIdx: 2, points: 5, tags: ['requirements'],
    content: { options: [
      { id: 'a', text: 'Non-functional requirement', isCorrect: true },
      { id: 'b', text: 'Functional requirement', isCorrect: false },
      { id: 'c', text: 'Business requirement', isCorrect: false },
      { id: 'd', text: 'User requirement', isCorrect: false },
    ], question: '"The system shall respond within 2 seconds" is an example of what type of requirement?' } },
  { title: 'Testing Levels', description: 'Software testing levels', courseIdx: 2, points: 5, tags: ['testing'],
    content: { options: [
      { id: 'a', text: 'Unit → Integration → System → Acceptance', isCorrect: true },
      { id: 'b', text: 'Acceptance → System → Integration → Unit', isCorrect: false },
      { id: 'c', text: 'Code Review → Unit → Deployment', isCorrect: false },
      { id: 'd', text: 'Alpha → Beta → Release', isCorrect: false },
    ], question: 'What is the correct order of testing levels (from smallest to largest scope)?' } },
  { title: 'Version Control', description: 'Version control concepts', courseIdx: 2, points: 5, tags: ['version-control', 'git'],
    content: { options: [
      { id: 'a', text: 'Git', isCorrect: true },
      { id: 'b', text: 'Docker', isCorrect: false },
      { id: 'c', text: 'Jenkins', isCorrect: false },
      { id: 'd', text: 'Jira', isCorrect: false },
    ], question: 'Which of the following is a distributed version control system?' } },
  { title: 'Code Review Benefits', description: 'Benefits of code review', courseIdx: 2, points: 5, tags: ['code-review', 'quality'],
    content: { options: [
      { id: 'a', text: 'All of the above', isCorrect: true },
      { id: 'b', text: 'Finding bugs early', isCorrect: false },
      { id: 'c', text: 'Knowledge sharing among team members', isCorrect: false },
      { id: 'd', text: 'Improving code quality and consistency', isCorrect: false },
    ], question: 'What are benefits of code review?' } },
];

const WRITTEN_QUESTIONS: Array<{ title: string; description: string; content: object; rubric: object; points: number; tags: string[]; courseIdx: number }> = [
  // SC2000
  { title: 'Explain OOP Pillars', description: 'Explain the four pillars of OOP with examples', courseIdx: 0, points: 20, tags: ['oop', 'theory'],
    content: { prompt: 'Explain the four pillars of Object-Oriented Programming (Encapsulation, Abstraction, Inheritance, Polymorphism). Provide a real-world analogy and a code example for each.',
      modelAnswer: 'The four pillars of OOP are: (1) Encapsulation — bundling data and methods together while hiding internal state (e.g., a BankAccount class with a private balance field and public deposit/withdraw methods). (2) Abstraction — exposing only essential features and hiding complexity (e.g., a Car class with a start() method that hides engine internals). (3) Inheritance — creating new classes from existing ones to reuse code (e.g., Dog extends Animal, inheriting eat() and adding bark()). (4) Polymorphism — allowing objects to take many forms (e.g., a Shape reference calling draw() executes different code for Circle vs Rectangle).' },
    rubric: { criteria: [
      { description: 'Encapsulation explanation with example', maxPoints: 5 },
      { description: 'Abstraction explanation with example', maxPoints: 5 },
      { description: 'Inheritance explanation with example', maxPoints: 5 },
      { description: 'Polymorphism explanation with example', maxPoints: 5 },
    ] } },
  { title: 'SOLID Principles Essay', description: 'Discuss SOLID principles and their importance', courseIdx: 0, points: 20, tags: ['solid', 'design-principles'],
    content: { prompt: 'Discuss each of the SOLID principles. For each principle, explain what it means, why it matters, and provide a code example showing a violation and how to fix it.',
      modelAnswer: 'SOLID stands for: (S) Single Responsibility — a class should have one reason to change. (O) Open/Closed — open for extension, closed for modification; use abstractions instead of modifying existing code. (L) Liskov Substitution — subtypes must be substitutable for their base types without breaking behavior. (I) Interface Segregation — prefer small, specific interfaces over large general ones. (D) Dependency Inversion — depend on abstractions, not concrete implementations. Each principle reduces coupling and improves maintainability.' },
    rubric: { criteria: [
      { description: 'Correct explanation of each SOLID principle', maxPoints: 10 },
      { description: 'Code examples showing violations and fixes', maxPoints: 10 },
    ] } },
  { title: 'Composition vs Inheritance', description: 'Compare composition and inheritance', courseIdx: 0, points: 15, tags: ['oop', 'design'],
    content: { prompt: 'Compare and contrast composition and inheritance. When should you prefer one over the other? Provide examples to support your argument.',
      modelAnswer: 'Inheritance creates an "is-a" relationship (Dog is-a Animal) and enables code reuse through class hierarchies, but can lead to tight coupling and fragile base class problems. Composition creates a "has-a" relationship (Car has-a Engine) and is more flexible — components can be swapped at runtime. Prefer composition when you need flexibility, when the relationship is not truly "is-a", or when you want to avoid deep inheritance hierarchies. Prefer inheritance when there is a genuine taxonomic relationship and you want to leverage polymorphism.' },
    rubric: { criteria: [
      { description: 'Clear comparison of composition and inheritance', maxPoints: 5 },
      { description: 'Appropriate use cases for each', maxPoints: 5 },
      { description: 'Quality of examples', maxPoints: 5 },
    ] } },

  // SC3004
  { title: 'Microservices vs Monolith', description: 'Compare microservices and monolithic architecture', courseIdx: 1, points: 20, tags: ['architecture', 'microservices'],
    content: { prompt: 'Compare microservices architecture with monolithic architecture. Discuss the trade-offs including scalability, development complexity, deployment, and team organization. When would you choose each approach?',
      modelAnswer: 'Monolithic architecture packages all components into a single deployable unit — simpler to develop and deploy initially, but harder to scale and maintain as the system grows. Microservices decompose the system into independently deployable services, each owning its data and business logic. Trade-offs: microservices offer better scalability, independent deployment, and team autonomy, but introduce network complexity, distributed data management, and operational overhead. Choose monolith for small teams or early-stage products; choose microservices when you need independent scaling, have multiple teams, or require technology diversity.' },
    rubric: { criteria: [
      { description: 'Accurate comparison of architectures', maxPoints: 7 },
      { description: 'Discussion of trade-offs', maxPoints: 7 },
      { description: 'Appropriate recommendations for when to use each', maxPoints: 6 },
    ] } },
  { title: 'Design Patterns in Practice', description: 'Apply design patterns to a scenario', courseIdx: 1, points: 20, tags: ['design-patterns', 'application'],
    content: { prompt: 'You are designing a notification system that needs to support email, SMS, and push notifications. The system should be easily extensible to support new notification channels. Which design patterns would you use? Explain your choices and sketch the class structure.',
      modelAnswer: 'Use the Strategy pattern to define a NotificationStrategy interface with a send() method, with concrete implementations EmailStrategy, SMSStrategy, and PushStrategy. Use the Factory pattern (NotificationFactory) to create the appropriate strategy based on configuration. Optionally use the Observer pattern if multiple parties need to be notified of events. The class structure: NotificationService holds a list of NotificationStrategy instances; each strategy implements the send(message, recipient) method. Adding a new channel (e.g., Slack) only requires creating a new strategy class without modifying existing code.' },
    rubric: { criteria: [
      { description: 'Appropriate pattern selection (e.g., Strategy, Factory, Observer)', maxPoints: 8 },
      { description: 'Clear explanation of why each pattern fits', maxPoints: 6 },
      { description: 'Class structure diagram or description', maxPoints: 6 },
    ] } },
  { title: 'Technical Debt Analysis', description: 'Analyze technical debt and propose solutions', courseIdx: 1, points: 15, tags: ['technical-debt', 'refactoring'],
    content: { prompt: 'What is technical debt? Categorize different types of technical debt, explain how it accumulates, and propose strategies for managing and reducing it in a real project.',
      modelAnswer: 'Technical debt is the implied cost of rework caused by choosing quick solutions over better approaches. Types: (1) Deliberate — shortcuts taken knowingly under time pressure. (2) Inadvertent — poor decisions due to lack of knowledge. (3) Bit rot — code degrades as requirements evolve. It accumulates through rushed deadlines, lack of refactoring, poor documentation, and insufficient testing. Management strategies: maintain a tech debt backlog, allocate a percentage of each sprint to debt reduction, use static analysis tools, enforce code review standards, and refactor incrementally rather than in big rewrites.' },
    rubric: { criteria: [
      { description: 'Definition and categorization of technical debt', maxPoints: 5 },
      { description: 'Explanation of accumulation causes', maxPoints: 5 },
      { description: 'Practical management strategies', maxPoints: 5 },
    ] } },

  // SC2007
  { title: 'Waterfall vs Agile', description: 'Compare Waterfall and Agile methodologies', courseIdx: 2, points: 20, tags: ['sdlc', 'methodology'],
    content: { prompt: 'Compare the Waterfall and Agile software development methodologies. Discuss the strengths and weaknesses of each approach, and describe scenarios where each methodology would be most appropriate.',
      modelAnswer: 'Waterfall is a sequential, phase-based approach (Requirements → Design → Implementation → Testing → Deployment). Strengths: clear milestones, thorough documentation, predictable timelines. Weaknesses: inflexible to change, late testing, customer sees product only at the end. Agile is iterative and incremental, delivering working software in short sprints. Strengths: adaptable to change, continuous feedback, early delivery of value. Weaknesses: scope creep risk, requires experienced teams, less documentation. Use Waterfall for well-defined, stable requirements (e.g., embedded systems, regulatory projects). Use Agile for evolving requirements and customer-facing applications.' },
    rubric: { criteria: [
      { description: 'Accurate description of Waterfall methodology', maxPoints: 5 },
      { description: 'Accurate description of Agile methodology', maxPoints: 5 },
      { description: 'Strengths and weaknesses comparison', maxPoints: 5 },
      { description: 'Appropriate scenario recommendations', maxPoints: 5 },
    ] } },
  { title: 'Requirements Elicitation', description: 'Discuss requirements elicitation techniques', courseIdx: 2, points: 15, tags: ['requirements', 'elicitation'],
    content: { prompt: 'Describe at least four requirements elicitation techniques. For each technique, explain when it is most effective and provide an example of how it would be used in a real project.',
      modelAnswer: 'Four key techniques: (1) Interviews — one-on-one discussions with stakeholders; best for understanding individual perspectives and uncovering implicit requirements. (2) Surveys/Questionnaires — collecting input from many users; effective for large user bases and quantitative data. (3) Workshops/JAD sessions — collaborative group sessions; best for resolving conflicts and building consensus. (4) Prototyping — building mockups for user feedback; effective when requirements are unclear and users need something tangible to react to. Additional techniques include observation, document analysis, and use case modeling.' },
    rubric: { criteria: [
      { description: 'Description of at least 4 techniques', maxPoints: 8 },
      { description: 'Effectiveness analysis and real-world examples', maxPoints: 7 },
    ] } },
  { title: 'Software Testing Strategy', description: 'Design a testing strategy for a web application', courseIdx: 2, points: 15, tags: ['testing', 'strategy'],
    content: { prompt: 'Design a comprehensive testing strategy for an e-commerce web application. Include the types of tests you would write, the tools you would use, and how you would integrate testing into the CI/CD pipeline.',
      modelAnswer: 'A comprehensive testing strategy includes: Unit tests (Jest/Vitest) for individual functions and components. Integration tests for API endpoints and database operations. E2E tests (Playwright/Cypress) for critical user flows like checkout and payment. Performance tests (k6/Artillery) for load testing. Security tests (OWASP ZAP) for vulnerability scanning. CI/CD integration: run unit and integration tests on every PR, E2E tests on merge to main, performance tests nightly, and security scans weekly. Use code coverage thresholds (e.g., 80%) as merge gates.' },
    rubric: { criteria: [
      { description: 'Comprehensive coverage of testing types', maxPoints: 5 },
      { description: 'Appropriate tool selection', maxPoints: 5 },
      { description: 'CI/CD integration plan', maxPoints: 5 },
    ] } },
];

const UML_QUESTIONS: Array<{ title: string; description: string; content: object; rubric: object; points: number; tags: string[]; courseIdx: number }> = [
  // SC2000
  { title: 'Class Diagram: Library System', description: 'Design a class diagram for a library management system', courseIdx: 0, points: 20, tags: ['uml', 'class-diagram'],
    content: { diagramType: 'class', prompt: 'Design a UML class diagram for a library management system. Include classes for Book, Member, Librarian, Loan, and Reservation. Show relationships, attributes, and methods.',
      modelAnswer: '@startuml\nclass Book {\n  -isbn: String\n  -title: String\n  -author: String\n  -available: boolean\n  +getDetails(): String\n}\nclass Member {\n  -memberId: String\n  -name: String\n  -email: String\n  +borrowBook(book: Book): Loan\n}\nclass Librarian {\n  -employeeId: String\n  -name: String\n  +addBook(book: Book): void\n  +removeBook(isbn: String): void\n}\nclass Loan {\n  -loanDate: Date\n  -dueDate: Date\n  -returnDate: Date\n  +isOverdue(): boolean\n}\nclass Reservation {\n  -reservationDate: Date\n  -status: String\n}\nMember "1" -- "0..*" Loan\nBook "1" -- "0..*" Loan\nMember "1" -- "0..*" Reservation\nBook "1" -- "0..*" Reservation\nLibrarian "1" -- "0..*" Book : manages\n@enduml' },
    rubric: { criteria: [
      { description: 'Correct classes with appropriate attributes and methods', maxPoints: 8 },
      { description: 'Proper relationships (association, inheritance, composition)', maxPoints: 7 },
      { description: 'Correct multiplicity and notation', maxPoints: 5 },
    ] } },
  { title: 'Class Diagram: Online Store', description: 'Design a class diagram for an online store', courseIdx: 0, points: 20, tags: ['uml', 'class-diagram'],
    content: { diagramType: 'class', prompt: 'Create a UML class diagram for an online store system. Include Product, Customer, Order, ShoppingCart, Payment, and Review classes with appropriate relationships.',
      modelAnswer: '@startuml\nclass Product {\n  -productId: String\n  -name: String\n  -price: double\n  -stock: int\n}\nclass Customer {\n  -customerId: String\n  -name: String\n  -email: String\n}\nclass Order {\n  -orderId: String\n  -orderDate: Date\n  -status: String\n  +getTotal(): double\n}\nclass ShoppingCart {\n  -items: List<CartItem>\n  +addItem(product: Product, qty: int): void\n  +checkout(): Order\n}\nclass Payment {\n  -paymentId: String\n  -amount: double\n  -method: String\n  -status: String\n}\nclass Review {\n  -rating: int\n  -comment: String\n  -date: Date\n}\nCustomer "1" -- "1" ShoppingCart\nCustomer "1" -- "0..*" Order\nOrder "1" -- "1" Payment\nOrder "1" *-- "1..*" Product\nCustomer "1" -- "0..*" Review\nProduct "1" -- "0..*" Review\n@enduml' },
    rubric: { criteria: [
      { description: 'Complete and accurate class definitions', maxPoints: 8 },
      { description: 'Correct relationships and multiplicities', maxPoints: 7 },
      { description: 'Proper UML notation', maxPoints: 5 },
    ] } },
  { title: 'Sequence Diagram: Login Flow', description: 'Draw a sequence diagram for user login', courseIdx: 0, points: 15, tags: ['uml', 'sequence-diagram'],
    content: { diagramType: 'sequence', prompt: 'Draw a UML sequence diagram showing the login process for a web application. Include the User, Browser, Web Server, Authentication Service, and Database as participants.',
      modelAnswer: '@startuml\nactor User\nparticipant Browser\nparticipant "Web Server" as WS\nparticipant "Auth Service" as Auth\ndatabase Database\n\nUser -> Browser: Enter credentials\nBrowser -> WS: POST /login (email, password)\nWS -> Auth: validateCredentials(email, password)\nAuth -> Database: SELECT user WHERE email = ?\nDatabase --> Auth: user record\nAuth -> Auth: verify password hash\nalt valid credentials\n  Auth --> WS: auth token\n  WS --> Browser: 200 OK + JWT\n  Browser --> User: Redirect to dashboard\nelse invalid credentials\n  Auth --> WS: authentication failed\n  WS --> Browser: 401 Unauthorized\n  Browser --> User: Show error message\nend\n@enduml' },
    rubric: { criteria: [
      { description: 'Correct participants and lifelines', maxPoints: 5 },
      { description: 'Proper message sequencing', maxPoints: 5 },
      { description: 'Correct notation (synchronous, asynchronous, return)', maxPoints: 5 },
    ] } },

  // SC3004
  { title: 'Architecture Diagram: Microservices', description: 'Design a component diagram for a microservices architecture', courseIdx: 1, points: 25, tags: ['uml', 'component-diagram', 'architecture'],
    content: { diagramType: 'component', prompt: 'Design a UML component diagram for a microservices-based e-commerce platform. Include API Gateway, User Service, Product Service, Order Service, Payment Service, and a Message Broker.',
      modelAnswer: '@startuml\npackage "E-Commerce Platform" {\n  [API Gateway] as GW\n  [User Service] as US\n  [Product Service] as PS\n  [Order Service] as OS\n  [Payment Service] as PAY\n  queue "Message Broker" as MQ\n  database "User DB" as UDB\n  database "Product DB" as PDB\n  database "Order DB" as ODB\n}\nGW --> US : REST\nGW --> PS : REST\nGW --> OS : REST\nUS --> UDB\nPS --> PDB\nOS --> ODB\nOS --> MQ : publish order events\nPAY --> MQ : subscribe to order events\nMQ --> US : notifications\n@enduml' },
    rubric: { criteria: [
      { description: 'Correct component identification and boundaries', maxPoints: 8 },
      { description: 'Proper interfaces and dependencies', maxPoints: 9 },
      { description: 'Communication patterns (sync/async)', maxPoints: 8 },
    ] } },
  { title: 'State Diagram: Order Lifecycle', description: 'Design a state diagram for order processing', courseIdx: 1, points: 20, tags: ['uml', 'state-diagram'],
    content: { diagramType: 'state', prompt: 'Create a UML state diagram showing the lifecycle of an order in an e-commerce system. Include states such as Created, Confirmed, Processing, Shipped, Delivered, Cancelled, and Returned.',
      modelAnswer: '@startuml\n[*] --> Created\nCreated --> Confirmed : payment received\nCreated --> Cancelled : user cancels\nConfirmed --> Processing : warehouse picks order\nProcessing --> Shipped : handed to courier\nShipped --> Delivered : delivery confirmed\nDelivered --> Returned : return requested\nReturned --> [*]\nDelivered --> [*]\nCancelled --> [*]\nConfirmed --> Cancelled : cancel before processing\n@enduml' },
    rubric: { criteria: [
      { description: 'Complete state identification', maxPoints: 7 },
      { description: 'Correct transitions and guards', maxPoints: 7 },
      { description: 'Initial/final states and proper notation', maxPoints: 6 },
    ] } },
  { title: 'Class Diagram: Design Patterns', description: 'Illustrate Observer and Strategy patterns in UML', courseIdx: 1, points: 25, tags: ['uml', 'class-diagram', 'design-patterns'],
    content: { diagramType: 'class', prompt: 'Create UML class diagrams illustrating both the Observer pattern and the Strategy pattern. For each, show the abstract classes/interfaces and at least two concrete implementations.',
      modelAnswer: '@startuml\ninterface Subject {\n  +attach(observer: Observer): void\n  +detach(observer: Observer): void\n  +notify(): void\n}\ninterface Observer {\n  +update(subject: Subject): void\n}\nclass ConcreteSubject implements Subject {\n  -state: String\n  -observers: List<Observer>\n}\nclass EmailObserver implements Observer {\n  +update(subject: Subject): void\n}\nclass LogObserver implements Observer {\n  +update(subject: Subject): void\n}\nSubject "1" --> "0..*" Observer\n\ninterface Strategy {\n  +execute(data: Object): Object\n}\nclass Context {\n  -strategy: Strategy\n  +setStrategy(s: Strategy): void\n  +doWork(): Object\n}\nclass ConcreteStrategyA implements Strategy {\n  +execute(data: Object): Object\n}\nclass ConcreteStrategyB implements Strategy {\n  +execute(data: Object): Object\n}\nContext --> Strategy\n@enduml' },
    rubric: { criteria: [
      { description: 'Correct Observer pattern structure', maxPoints: 10 },
      { description: 'Correct Strategy pattern structure', maxPoints: 10 },
      { description: 'Proper UML notation and relationships', maxPoints: 5 },
    ] } },

  // SC2007
  { title: 'Use Case Diagram: Student Portal', description: 'Design a use case diagram for a student portal', courseIdx: 2, points: 15, tags: ['uml', 'use-case-diagram'],
    content: { diagramType: 'usecase', prompt: 'Design a UML use case diagram for a university student portal. Include actors such as Student, Professor, and Admin. Include use cases for enrollment, grade viewing, course management, and assignment submission.',
      modelAnswer: '@startuml\nleft to right direction\nactor Student\nactor Professor\nactor Admin\nrectangle "Student Portal" {\n  usecase "Enroll in Course" as UC1\n  usecase "View Grades" as UC2\n  usecase "Submit Assignment" as UC3\n  usecase "Manage Courses" as UC4\n  usecase "Grade Assignments" as UC5\n  usecase "Manage Users" as UC6\n  usecase "Authenticate" as UC7\n}\nStudent --> UC1\nStudent --> UC2\nStudent --> UC3\nProfessor --> UC4\nProfessor --> UC5\nAdmin --> UC6\nStudent --> UC7\nProfessor --> UC7\nAdmin --> UC7\nUC3 ..> UC7 : <<include>>\nUC1 ..> UC7 : <<include>>\n@enduml' },
    rubric: { criteria: [
      { description: 'Correct actor identification', maxPoints: 5 },
      { description: 'Comprehensive use cases', maxPoints: 5 },
      { description: 'Proper relationships (include, extend, generalization)', maxPoints: 5 },
    ] } },
  { title: 'Activity Diagram: Bug Fix Process', description: 'Model the bug fix workflow as an activity diagram', courseIdx: 2, points: 15, tags: ['uml', 'activity-diagram'],
    content: { diagramType: 'activity', prompt: 'Create a UML activity diagram for the bug fix process in a software team. Include bug reporting, triage, assignment, fixing, code review, testing, and deployment stages. Show decision points and parallel activities.',
      modelAnswer: '@startuml\nstart\n:Report Bug;\n:Triage Bug;\nif (Severity?) then (Critical)\n  :Assign to Senior Dev;\nelse (Normal)\n  :Assign to Developer;\nendif\n:Fix Bug;\nfork\n  :Code Review;\nfork again\n  :Write Tests;\nend fork\nif (Review Passed?) then (Yes)\n  :Run Test Suite;\n  if (Tests Pass?) then (Yes)\n    :Deploy to Staging;\n    :Verify Fix;\n    :Deploy to Production;\n  else (No)\n    :Return to Developer;\n    :Fix Bug;\n  endif\nelse (No)\n  :Address Review Comments;\n  :Fix Bug;\nendif\nstop\n@enduml' },
    rubric: { criteria: [
      { description: 'Complete activity flow', maxPoints: 5 },
      { description: 'Correct decision points and forks/joins', maxPoints: 5 },
      { description: 'Proper UML notation', maxPoints: 5 },
    ] } },
  { title: 'Class Diagram: Hospital System', description: 'Design a class diagram for hospital management', courseIdx: 2, points: 20, tags: ['uml', 'class-diagram'],
    content: { diagramType: 'class', prompt: 'Design a UML class diagram for a hospital management system. Include Patient, Doctor, Nurse, Appointment, MedicalRecord, Ward, and Prescription classes. Show inheritance, composition, and association relationships.',
      modelAnswer: '@startuml\nabstract class Person {\n  -id: String\n  -name: String\n  -phone: String\n}\nclass Patient extends Person {\n  -patientId: String\n  -dateOfBirth: Date\n  -bloodType: String\n}\nclass Doctor extends Person {\n  -specialization: String\n  -licenseNo: String\n}\nclass Nurse extends Person {\n  -department: String\n  -shift: String\n}\nclass Appointment {\n  -dateTime: DateTime\n  -status: String\n}\nclass MedicalRecord {\n  -diagnosis: String\n  -treatment: String\n  -date: Date\n}\nclass Ward {\n  -wardNo: String\n  -capacity: int\n  -type: String\n}\nclass Prescription {\n  -medication: String\n  -dosage: String\n  -duration: String\n}\nPatient "1" -- "0..*" Appointment\nDoctor "1" -- "0..*" Appointment\nPatient "1" *-- "0..*" MedicalRecord\nDoctor "1" -- "0..*" MedicalRecord\nMedicalRecord "1" *-- "0..*" Prescription\nWard "1" -- "0..*" Patient\nWard "1" -- "0..*" Nurse\n@enduml' },
    rubric: { criteria: [
      { description: 'Complete class definitions with attributes and methods', maxPoints: 8 },
      { description: 'Correct relationships and multiplicities', maxPoints: 7 },
      { description: 'Proper use of inheritance and composition', maxPoints: 5 },
    ] } },
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  console.log('Seeding database...\n');

  // ── 1. Create admin ──
  const adminId = randomUUID();
  await sql`
    INSERT INTO users (id, email, name, role, password_hash)
    VALUES (${adminId}, 'admin@seed.local', 'Admin User', 'admin', ${passwordHash})
    ON CONFLICT (email) DO UPDATE SET password_hash = ${passwordHash}, name = 'Admin User', role = 'admin'
  `;
  console.log('Created admin: admin@seed.local');

  // ── 2. Create 15 staff ──
  const staffIds: string[] = [];
  for (let i = 0; i < 15; i++) {
    const id = randomUUID();
    staffIds.push(id);
    const email = `staff${String(i + 1).padStart(2, '0')}@seed.local`;
    await sql`
      INSERT INTO users (id, email, name, role, password_hash)
      VALUES (${id}, ${email}, ${STAFF_NAMES[i]}, 'staff', ${passwordHash})
      ON CONFLICT (email) DO UPDATE SET password_hash = ${passwordHash}, name = ${STAFF_NAMES[i]}, role = 'staff'
      RETURNING id
    `;
  }
  console.log('Created 15 staff members');

  // ── 3. Create 200 students ──
  const studentIds: string[] = [];
  for (let i = 0; i < 200; i++) {
    const id = randomUUID();
    studentIds.push(id);
    const name = generateStudentName(i);
    const email = `student${String(i + 1).padStart(3, '0')}@seed.local`;
    await sql`
      INSERT INTO users (id, email, name, role, password_hash)
      VALUES (${id}, ${email}, ${name}, 'student', ${passwordHash})
      ON CONFLICT (email) DO UPDATE SET password_hash = ${passwordHash}, name = ${name}, role = 'student'
    `;
  }
  console.log('Created 200 students');

  // ── 4. Create 3 courses ──
  const courseIds: string[] = [];
  for (const course of COURSES) {
    const id = randomUUID();
    courseIds.push(id);
    await sql`
      INSERT INTO courses (id, code, name, description, academic_year, semester, is_active)
      VALUES (${id}, ${course.code}, ${course.name}, ${course.description}, '2025/2026', 'Semester 2', true)
      ON CONFLICT (code) DO UPDATE SET
        name = ${course.name},
        description = ${course.description},
        academic_year = '2025/2026',
        semester = 'Semester 2',
        is_active = true
      RETURNING id
    `;
  }
  console.log('Created 3 courses: SC2000, SC3004, SC2007');

  // ── 5. Enroll staff (5 per course) ──
  // need to re-fetch course IDs since ON CONFLICT RETURNING might not return
  const courseRows = await sql`SELECT id, code FROM courses WHERE code IN ('SC2000', 'SC3004', 'SC2007') ORDER BY code`;
  const courseIdMap: Record<string, string> = {};
  for (const row of courseRows) {
    courseIdMap[row.code] = row.id;
  }
  const orderedCourseIds = [courseIdMap['SC2000'], courseIdMap['SC3004'], courseIdMap['SC2007']];

  // Re-fetch staff IDs by email
  const staffRows = await sql`SELECT id, email FROM users WHERE email LIKE 'staff%@seed.local' ORDER BY email`;
  const orderedStaffIds = staffRows.map(r => r.id);

  const courseRoles: Array<'lecturer' | 'ta' | 'ta' | 'lab_exec' | 'lab_exec'> = ['lecturer', 'ta', 'ta', 'lab_exec', 'lab_exec'];
  for (let courseIdx = 0; courseIdx < 3; courseIdx++) {
    for (let staffIdx = 0; staffIdx < 5; staffIdx++) {
      const globalIdx = courseIdx * 5 + staffIdx;
      await sql`
        INSERT INTO enrollments (user_id, course_id, role)
        VALUES (${orderedStaffIds[globalIdx]}, ${orderedCourseIds[courseIdx]}, ${courseRoles[staffIdx]})
        ON CONFLICT ON CONSTRAINT enrollments_user_id_course_id_unique DO NOTHING
      `;
    }
  }
  console.log('Enrolled staff in courses (1 lecturer, 2 TAs, 2 lab execs per course)');

  // ── 6. Enroll students ──
  // Distribute: ~80 per SC2000, ~60 per SC3004, ~60 per SC2007 (some overlap)
  const studentRows = await sql`SELECT id FROM users WHERE email LIKE 'student%@seed.local' ORDER BY email`;
  const orderedStudentIds = studentRows.map(r => r.id);

  // SC2000: students 0-79 (80 students)
  for (let i = 0; i < 80; i++) {
    await sql`
      INSERT INTO enrollments (user_id, course_id, role)
      VALUES (${orderedStudentIds[i]}, ${orderedCourseIds[0]}, 'student')
      ON CONFLICT ON CONSTRAINT enrollments_user_id_course_id_unique DO NOTHING
    `;
  }
  // SC3004: students 60-119 (60 students, 20 overlap with SC2000)
  for (let i = 60; i < 120; i++) {
    await sql`
      INSERT INTO enrollments (user_id, course_id, role)
      VALUES (${orderedStudentIds[i]}, ${orderedCourseIds[1]}, 'student')
      ON CONFLICT ON CONSTRAINT enrollments_user_id_course_id_unique DO NOTHING
    `;
  }
  // SC2007: students 140-199 (60 students)
  for (let i = 140; i < 200; i++) {
    await sql`
      INSERT INTO enrollments (user_id, course_id, role)
      VALUES (${orderedStudentIds[i]}, ${orderedCourseIds[2]}, 'student')
      ON CONFLICT ON CONSTRAINT enrollments_user_id_course_id_unique DO NOTHING
    `;
  }
  console.log('Enrolled students (80 in SC2000, 60 in SC3004, 60 in SC2007)');

  // ── 7. Create 50 questions ──
  // MCQ: 18, Written: 9, UML: 9 = 36... need 14 more MCQs
  const extraMCQs: typeof MCQ_QUESTIONS = [
    { title: 'Constructor Overloading', description: 'Understanding constructor overloading', courseIdx: 0, points: 5, tags: ['oop', 'constructor'],
      content: { options: [
        { id: 'a', text: 'Multiple constructors with different parameter lists', isCorrect: true },
        { id: 'b', text: 'A constructor that calls another constructor', isCorrect: false },
        { id: 'c', text: 'A constructor with no parameters', isCorrect: false },
        { id: 'd', text: 'A private constructor', isCorrect: false },
      ], question: 'What is constructor overloading?' } },
    { title: 'Factory Pattern', description: 'Factory design pattern purpose', courseIdx: 1, points: 5, tags: ['design-patterns', 'factory'],
      content: { options: [
        { id: 'a', text: 'Creates objects without specifying the exact class to create', isCorrect: true },
        { id: 'b', text: 'Ensures only one instance of a class exists', isCorrect: false },
        { id: 'c', text: 'Adds responsibilities to objects dynamically', isCorrect: false },
        { id: 'd', text: 'Provides a simplified interface to a complex system', isCorrect: false },
      ], question: 'What is the purpose of the Factory pattern?' } },
    { title: 'Scrum Roles', description: 'Roles in Scrum methodology', courseIdx: 2, points: 5, tags: ['agile', 'scrum'],
      content: { options: [
        { id: 'a', text: 'Product Owner, Scrum Master, Development Team', isCorrect: true },
        { id: 'b', text: 'Project Manager, Developer, Tester', isCorrect: false },
        { id: 'c', text: 'CEO, CTO, Developer', isCorrect: false },
        { id: 'd', text: 'Analyst, Designer, Programmer', isCorrect: false },
      ], question: 'What are the three roles in Scrum?' } },
    { title: 'Coupling and Cohesion', description: 'Understanding coupling and cohesion', courseIdx: 2, points: 5, tags: ['design', 'quality'],
      content: { options: [
        { id: 'a', text: 'Low coupling and high cohesion', isCorrect: true },
        { id: 'b', text: 'High coupling and low cohesion', isCorrect: false },
        { id: 'c', text: 'High coupling and high cohesion', isCorrect: false },
        { id: 'd', text: 'Low coupling and low cohesion', isCorrect: false },
      ], question: 'What is generally considered good software design?' } },
    { title: 'UML Diagram Types', description: 'Categories of UML diagrams', courseIdx: 1, points: 5, tags: ['uml', 'theory'],
      content: { options: [
        { id: 'a', text: 'Structure diagrams and Behavior diagrams', isCorrect: true },
        { id: 'b', text: 'Static diagrams and Dynamic diagrams', isCorrect: false },
        { id: 'c', text: 'Class diagrams and Sequence diagrams', isCorrect: false },
        { id: 'd', text: 'Design diagrams and Implementation diagrams', isCorrect: false },
      ], question: 'UML diagrams are broadly categorized into which two groups?' } },
    { title: 'Decorator Pattern', description: 'Decorator design pattern', courseIdx: 1, points: 5, tags: ['design-patterns', 'decorator'],
      content: { options: [
        { id: 'a', text: 'Attaches additional responsibilities to an object dynamically', isCorrect: true },
        { id: 'b', text: 'Creates a simplified interface to a complex subsystem', isCorrect: false },
        { id: 'c', text: 'Defines a skeleton of an algorithm in a method', isCorrect: false },
        { id: 'd', text: 'Separates construction from representation', isCorrect: false },
      ], question: 'What does the Decorator pattern do?' } },
    { title: 'Exception Handling', description: 'Exception handling concepts in OOP', courseIdx: 0, points: 5, tags: ['oop', 'exceptions'],
      content: { options: [
        { id: 'a', text: 'try-catch-finally', isCorrect: true },
        { id: 'b', text: 'if-else-then', isCorrect: false },
        { id: 'c', text: 'for-while-do', isCorrect: false },
        { id: 'd', text: 'switch-case-default', isCorrect: false },
      ], question: 'Which block structure is used for exception handling in Java?' } },
    { title: 'Generics', description: 'Understanding generics in OOP', courseIdx: 0, points: 5, tags: ['oop', 'generics'],
      content: { options: [
        { id: 'a', text: 'Type-safe data structures that work with any data type', isCorrect: true },
        { id: 'b', text: 'A way to create abstract classes', isCorrect: false },
        { id: 'c', text: 'A form of multiple inheritance', isCorrect: false },
        { id: 'd', text: 'A method of error handling', isCorrect: false },
      ], question: 'What are generics in programming?' } },
    { title: 'CI/CD Pipeline', description: 'Continuous Integration and Deployment', courseIdx: 2, points: 5, tags: ['devops', 'ci-cd'],
      content: { options: [
        { id: 'a', text: 'Automating the build, test, and deployment process', isCorrect: true },
        { id: 'b', text: 'Writing code continuously without breaks', isCorrect: false },
        { id: 'c', text: 'A version control branching strategy', isCorrect: false },
        { id: 'd', text: 'A project management methodology', isCorrect: false },
      ], question: 'What is CI/CD?' } },
    { title: 'Black Box vs White Box Testing', description: 'Testing approaches', courseIdx: 2, points: 5, tags: ['testing'],
      content: { options: [
        { id: 'a', text: 'Black box tests functionality without knowing internal structure; white box tests with knowledge of internal structure', isCorrect: true },
        { id: 'b', text: 'Black box is manual testing; white box is automated testing', isCorrect: false },
        { id: 'c', text: 'Black box is unit testing; white box is integration testing', isCorrect: false },
        { id: 'd', text: 'There is no difference', isCorrect: false },
      ], question: 'What is the difference between black box and white box testing?' } },
    { title: 'Facade Pattern', description: 'Facade design pattern', courseIdx: 1, points: 5, tags: ['design-patterns', 'facade'],
      content: { options: [
        { id: 'a', text: 'Provides a simplified interface to a complex subsystem', isCorrect: true },
        { id: 'b', text: 'Ensures a class has only one instance', isCorrect: false },
        { id: 'c', text: 'Defines a family of algorithms', isCorrect: false },
        { id: 'd', text: 'Creates objects without specifying the exact class', isCorrect: false },
      ], question: 'What is the Facade pattern?' } },
    { title: 'Dependency Injection', description: 'Understanding DI', courseIdx: 1, points: 5, tags: ['design-patterns', 'di'],
      content: { options: [
        { id: 'a', text: 'A technique where dependencies are provided to a class rather than created by it', isCorrect: true },
        { id: 'b', text: 'A way to inject code at runtime', isCorrect: false },
        { id: 'c', text: 'A form of multiple inheritance', isCorrect: false },
        { id: 'd', text: 'A database query technique', isCorrect: false },
      ], question: 'What is dependency injection?' } },
    { title: 'Object Cloning', description: 'Shallow vs deep copy', courseIdx: 0, points: 5, tags: ['oop', 'cloning'],
      content: { options: [
        { id: 'a', text: 'Shallow copy copies references; deep copy copies the actual objects recursively', isCorrect: true },
        { id: 'b', text: 'They are the same thing', isCorrect: false },
        { id: 'c', text: 'Shallow copy is faster so it copies more data', isCorrect: false },
        { id: 'd', text: 'Deep copy only works with primitive types', isCorrect: false },
      ], question: 'What is the difference between shallow copy and deep copy?' } },
    { title: 'Code Smells', description: 'Identifying code smells', courseIdx: 2, points: 5, tags: ['refactoring', 'quality'],
      content: { options: [
        { id: 'a', text: 'Indicators of potential problems in code that may need refactoring', isCorrect: true },
        { id: 'b', text: 'Syntax errors in code', isCorrect: false },
        { id: 'c', text: 'Security vulnerabilities', isCorrect: false },
        { id: 'd', text: 'Performance bottlenecks', isCorrect: false },
      ], question: 'What are code smells?' } },
  ];

  const allMCQs = [...MCQ_QUESTIONS, ...extraMCQs]; // 18 + 14 = 32
  // Total: 32 MCQ + 9 Written + 9 UML = 50

  // Get lecturer IDs for createdBy
  const lecturerIds = [orderedStaffIds[0], orderedStaffIds[5], orderedStaffIds[10]]; // index 0, 5, 10 are lecturers

  let questionCount = 0;

  // Insert MCQ questions
  for (const q of allMCQs) {
    await sql`
      INSERT INTO questions (course_id, type, title, description, content, points, tags, created_by)
      VALUES (${orderedCourseIds[q.courseIdx]}, 'mcq', ${q.title}, ${q.description}, ${JSON.stringify(q.content)}, ${q.points}, ${q.tags}, ${lecturerIds[q.courseIdx]})
      ON CONFLICT DO NOTHING
    `;
    questionCount++;
  }

  // Insert Written questions
  for (const q of WRITTEN_QUESTIONS) {
    await sql`
      INSERT INTO questions (course_id, type, title, description, content, rubric, points, tags, created_by)
      VALUES (${orderedCourseIds[q.courseIdx]}, 'written', ${q.title}, ${q.description}, ${JSON.stringify(q.content)}, ${JSON.stringify(q.rubric)}, ${q.points}, ${q.tags}, ${lecturerIds[q.courseIdx]})
      ON CONFLICT DO NOTHING
    `;
    questionCount++;
  }

  // Insert UML questions
  for (const q of UML_QUESTIONS) {
    await sql`
      INSERT INTO questions (course_id, type, title, description, content, rubric, points, tags, created_by)
      VALUES (${orderedCourseIds[q.courseIdx]}, 'uml', ${q.title}, ${q.description}, ${JSON.stringify(q.content)}, ${JSON.stringify(q.rubric)}, ${q.points}, ${q.tags}, ${lecturerIds[q.courseIdx]})
      ON CONFLICT DO NOTHING
    `;
    questionCount++;
  }

  console.log(`Created ${questionCount} questions (32 MCQ, 9 Written, 9 UML)`);

  // ── 8. Create assignments and attach questions ──
  // Fetch all questions grouped by course
  const allQuestions = await sql<Array<{ id: string; course_id: string; type: string; title: string }>>`
    SELECT id, course_id, type, title FROM questions
    WHERE course_id = ANY(${orderedCourseIds})
    ORDER BY course_id, type, title
  `;

  const questionsByCourse: Record<string, Array<{ id: string; type: string; title: string }>> = {};
  for (const cid of orderedCourseIds) {
    questionsByCourse[cid] = allQuestions
      .filter(q => q.course_id === cid)
      .map(q => ({ id: q.id as string, type: q.type as string, title: q.title as string }));
  }

  const assignmentDefs = [
    // SC2000
    { courseIdx: 0, title: 'OOP Fundamentals Quiz', description: 'MCQ quiz covering OOP concepts', types: ['mcq'], count: 6 },
    { courseIdx: 0, title: 'OOP Design Assignment', description: 'Written and UML assignment on OOP design', types: ['written', 'uml'], count: 4 },
    // SC3004
    { courseIdx: 1, title: 'Design Patterns Quiz', description: 'MCQ quiz on design patterns and principles', types: ['mcq'], count: 6 },
    { courseIdx: 1, title: 'Software Architecture Assignment', description: 'Written analysis and UML diagrams for architecture', types: ['written', 'uml'], count: 4 },
    // SC2007
    { courseIdx: 2, title: 'SE Fundamentals Quiz', description: 'MCQ quiz on software engineering basics', types: ['mcq'], count: 6 },
    { courseIdx: 2, title: 'SE Practice Assignment', description: 'Written and UML assignment on SE practices', types: ['written', 'uml'], count: 4 },
  ];

  for (const aDef of assignmentDefs) {
    const courseId = orderedCourseIds[aDef.courseIdx];
    const assignmentId = randomUUID();
    const dueDate = new Date('2026-04-15T23:59:59Z');
    const openDate = new Date('2026-03-01T00:00:00Z');

    await sql`
      INSERT INTO assignments (id, course_id, title, description, due_date, open_date, max_attempts, is_published, created_by)
      VALUES (${assignmentId}, ${courseId}, ${aDef.title}, ${aDef.description}, ${dueDate}, ${openDate}, 1, true, ${lecturerIds[aDef.courseIdx]})
    `;

    // Attach questions
    const courseQuestions = questionsByCourse[courseId];
    const matchingQuestions = courseQuestions.filter(q => aDef.types.includes(q.type));
    const selectedQuestions = matchingQuestions.slice(0, aDef.count);

    for (let i = 0; i < selectedQuestions.length; i++) {
      await sql`
        INSERT INTO assignment_questions (assignment_id, question_id, "order")
        VALUES (${assignmentId}, ${selectedQuestions[i].id}, ${i + 1})
        ON CONFLICT DO NOTHING
      `;
    }
  }
  console.log('Created 6 assignments (2 per course) with questions attached');

  // ── Done ──
  console.log('\nSeed complete!');
  console.log('─────────────────────────────────');
  console.log('All users have password: password123');
  console.log('Admin:    admin@seed.local');
  console.log('Staff:    staff01@seed.local ... staff15@seed.local');
  console.log('Students: student001@seed.local ... student200@seed.local');
  console.log('─────────────────────────────────');

  await sql.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
