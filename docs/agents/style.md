# Code Style Guide

This document outlines the coding conventions and style patterns used in the UML Assessment Platform codebase.

## Table of Contents

- [General Principles](#general-principles)
- [TypeScript Conventions](#typescript-conventions)
- [React Patterns](#react-patterns)
- [File Organization](#file-organization)
- [Naming Conventions](#naming-conventions)
- [API & Backend Patterns](#api--backend-patterns)
- [Error Handling](#error-handling)
- [Comments & Documentation](#comments--documentation)

## General Principles

### Consistency Over Preference
Follow existing patterns in the codebase. When adding new features, match the structure and style of similar existing features.

### Type Safety First
Leverage TypeScript's type system fully. Avoid `any` types; prefer `unknown` and proper type guards when dealing with uncertain types.

### Functional Approach
Prefer functional programming patterns with immutability. Use `const` over `let`, avoid mutations, and use array methods over imperative loops.

## TypeScript Conventions

### Type Definitions

**Use `type` for object shapes and unions:**
```typescript
export type StaffCourse = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  academicYear: string;
  semester: string;
  isActive?: boolean;
};
```

**Use `interface` sparingly, prefer `type`:**
The codebase predominantly uses `type` for consistency.

**Define types close to usage:**
- Feature-specific types go in `types.ts` within that feature directory
- Shared types go in appropriate shared locations (`lib/api.ts` for API types)

### Type Annotations

**Always annotate function parameters and return types:**
```typescript
export function useAnswerManagement(
  submission: Submission | null,
  questionsById: Map<string, AssignmentQuestion['question']>,
  isPastDue: boolean
) {
  // implementation
}
```


## File Organization

### Feature-Based Structure

Organize by feature, not by file type:

```
features/
  staff-dashboard/
    StaffDashboard.tsx       # Main component
    types.ts                 # Feature-specific types
    components/              # Sub-components
      DashboardHeader.tsx
      CreateCourseForm.tsx
      CourseGrid.tsx
    hooks/                   # Feature-specific hooks
      useStaffDashboard.ts
      useCourseForm.ts
```

## Key Takeaways

1. **Consistency is paramount** - follow existing patterns
2. **Type everything** - leverage TypeScript fully
3. **Organize by feature** - keep related code together
4. **Handle errors gracefully** - always type as `unknown`, then narrow
5. **Document the why** - not the what
6. **Prefer functional patterns** - immutability and pure functions
7. **Keep components focused** - single responsibility principle
