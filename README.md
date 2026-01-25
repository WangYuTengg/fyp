# UML Assessment Platform

An automated assessment platform for UML diagrams with support for multiple assessment modes (currently MCQ and written; UML planned), designed for on-premise school deployment with LLM-assisted grading capabilities.

## 📚 Documentation

- **[Quick Start Guide](QUICK_START.md)** - Get up and running in minutes
- **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** - Current status, completed features, architecture
- **[Development Plan](DEVELOPMENT_PLAN.md)** - Full roadmap, phases, NFRs, timeline

## ✨ Features (Phase 1 Complete, Phase 2 In Progress)

### For Students
- 📚 View enrolled courses
- 📝 Browse and start assignments
- 💾 Submit answers
- 🔄 Silent auto-save for MCQ/written drafts
- 📊 Track submission status

### For Staff/Lecturers
- 🎓 Create and manage courses
- 📋 Create assignments (MCQ, written)
- 👥 View course enrollments
- ✅ Publish/unpublish assignments
- 📊 Manual grading interface

### Platform Features
- 🔐 Secure authentication via Supabase
- 👤 Role-based access control (admin, staff, student)
- 📱 Course-scoped roles (lecturer, TA, lab_exec)
- 🗄️ PostgreSQL database with Drizzle ORM
- 🎨 Modern UI with Tailwind CSS

## Tech Stack

### Frontend
- **Vite** - Fast build tool
- **React** - UI library
- **TypeScript** - Type safety
- **TanStack Router** - Type-safe routing
- **Tailwind CSS** - Utility-first CSS

### Backend
- **Hono** - Fast web framework for Node.js
- **Supabase** - Authentication
- **PostgreSQL** - Database
- **Drizzle ORM** - Type-safe SQL ORM

### DevOps
- **Docker** - Containerization
- **GitHub Actions** - CI/CD

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Supabase project

### Quick Setup

1. **Clone and install**:
```bash
git clone <your-repo-url>
cd fyp
npm install
```

2. **Configure environment** (`.env`):
```env
DATABASE_URL=postgresql://user:password@localhost:5432/fyp
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:5173  # Required for email OTP redirects
PORT=3000
```

> **Note**: For email OTP with magic links to work properly, see [SUPABASE_EMAIL_CONFIG.md](SUPABASE_EMAIL_CONFIG.md) for Supabase configuration steps.

3. **Apply database migrations**:
```bash
npm run db:generate  # Already generated
npm run db:push      # Or apply SQL manually
```

4. **Start development servers**:
```bash
# Terminal 1 - API server
npm run dev:server

# Terminal 2 - Vite dev server
npm run dev
```

Visit `http://localhost:5173`

For detailed setup instructions, see [QUICK_START.md](QUICK_START.md).

### Development

Run the frontend and backend in development mode:

```bash
# Terminal 1 - Frontend (Vite dev server)
npm run dev

# Terminal 2 - Backend (Hono server with hot reload)
npm run dev:server
```

The frontend will be available at `http://localhost:5173` and will proxy API requests to the backend at `http://localhost:3000`.

### Database

Generate migrations:
```bash
npm run db:generate
```

Run migrations:
```bash
npm run db:migrate
```

Open Drizzle Studio (database GUI):
```bash
npm run db:studio
```

### Building for Production

Build both client and server:
```bash
npm run build
```

Or build separately:
```bash
npm run build:client  # Build frontend only
npm run build:server  # Build backend only
```

Start the production server:
```bash
npm start
```

## Docker

### Build and run with Docker:
```bash
docker-compose up --build
```

### Build Docker image:
```bash
docker build -t fyp .
```

### Run Docker container:
```bash
docker run -p 3000:3000 --env-file .env fyp
```

## Project Structure

```
fyp/
├── .github/
│   ├── copilot-instructions.md    # Project setup instructions
│   └── workflows/
│       └── build-deploy.yml       # CI/CD workflow
│
├── dist/                          # Build output
│   ├── client/                    # Built frontend assets
│   └── server/                    # Built server code
│
├── public/                        # Static assets
│   └── vite.svg                   # Vite logo
│
├── src/
│   ├── client/                    # Frontend React application
│   │   ├── assets/                # Client assets
│   │   │   └── react.svg
│   │   ├── routes/                # TanStack Router routes
│   │   │   ├── __root.tsx         # Root layout component
│   │   │   └── index.tsx          # Home page route
│   │   ├── App.css                # App styles
│   │   ├── App.tsx                # Main App component
│   │   ├── index.css              # Tailwind CSS imports
│   │   ├── main.tsx               # Frontend entry point
│   │   └── routeTree.gen.ts       # Auto-generated route tree
│   │
│   ├── server/                    # Backend Hono application
│   │   ├── routes/                # API routes
│   │   │   └── auth.ts            # Supabase auth endpoints
│   │   ├── middleware/            # Custom middleware (empty)
│   │   └── index.ts               # Server entry point
│   │
│   ├── db/                        # Database schema and migrations
│   │   ├── migrations/            # Generated SQL migrations
│   │   ├── index.ts               # Drizzle database instance
│   │   └── schema.ts              # Database schema definitions
│   │
│   └── lib/                       # Shared utilities
│       └── supabase.ts            # Supabase client configuration
│
├── .dockerignore                  # Docker ignore file
├── .env                           # Environment variables (not in git)
├── .env.example                   # Environment variables template
├── .gitignore                     # Git ignore file
├── Dockerfile                     # Docker container configuration
├── docker-compose.yml             # Docker Compose setup
├── drizzle.config.ts              # Drizzle ORM configuration
├── eslint.config.js               # ESLint configuration
├── index.html                     # HTML entry point
├── package.json                   # NPM dependencies and scripts
├── postcss.config.js              # PostCSS configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript base config
├── tsconfig.app.json              # TypeScript client config
├── tsconfig.node.json             # TypeScript Node config
├── tsconfig.server.json           # TypeScript server config
└── vite.config.ts                 # Vite configuration
```

### Key Files Explained

- **`src/client/main.tsx`** - Frontend entry point that sets up TanStack Router
- **`src/client/routes/`** - File-based routing with TanStack Router
- **`src/server/index.ts`** - Hono server with API routes and static file serving
- **`src/server/routes/auth.ts`** - Authentication endpoints using Supabase
- **`src/db/schema.ts`** - Database schema using Drizzle ORM
- **`src/lib/supabase.ts`** - Supabase client initialization
- **`vite.config.ts`** - Vite config with TanStack Router plugin and proxy setup
- **`drizzle.config.ts`** - Database migration configuration

## Environment Variables

Create a `.env` file with the following variables:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
DATABASE_URL=your-database-url
PORT=3000
```

## Deployment

The project includes a GitHub Actions workflow that:
1. Builds a Docker image
2. Pushes it to GitHub Container Registry
3. Tags it appropriately

To deploy, push to the `main` branch. The workflow will automatically build and push the Docker image.

## License

MIT

import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
