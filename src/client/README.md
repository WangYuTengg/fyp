# Client — React SPA

Single-page application built with React 19, Vite 7, TanStack Router/Query, and Tailwind CSS 4.

## Architecture Decisions

### Client-Rendered SPA (No SSR)

**Trade-off:** No SEO or server-side rendering, but simpler deployment and no hydration complexity.

The entire platform is behind authentication — there are no public pages that benefit from server rendering. A client-rendered SPA avoids the complexity of SSR frameworks (Next.js, Remix) while keeping the build pipeline simple: Vite produces static files that any web server can host.

### Feature-Based Module Structure

**Trade-off:** Some code duplication across features vs. high cohesion within each feature.

Each feature (e.g. `staff-grading/`, `student-assignment/`) contains its own components, hooks, and types. This was chosen over a flat `components/` + `hooks/` structure because:

- A developer working on grading doesn't need to navigate through unrelated student submission code
- Feature-specific types stay close to where they're used
- Features can be understood in isolation

The downside is that similar patterns (loading states, error handling) are repeated across features rather than abstracted into shared utilities. This is an intentional choice — premature abstraction across features with different data shapes leads to leaky abstractions.

### Custom Hooks per Feature (Not a State Management Library)

**Trade-off:** More boilerplate per feature vs. simpler mental model.

Each feature has dedicated hooks (e.g. `useGrading`, `useAssignmentData`, `useAnswerManagement`) instead of a global state manager like Redux or Zustand. TanStack Query handles server state, and React Context handles auth — the remaining local state is UI-specific (selected tab, form values, modal open/close).

A global store would add indirection without clear benefit — features don't share mutable state with each other.

## Subfolders

- **`routes/`** — TanStack Router file-based routes with `beforeLoad` guards
- **`features/`** — Feature modules with self-contained components, hooks, and types
- **`components/`** — Shared UI primitives (Modal, Sidebar, UMLEditor, etc.)
- **`contexts/`** — React Context providers (auth state)
- **`lib/`** — API client and shared utilities
