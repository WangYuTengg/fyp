# Shared Components

Reusable UI primitives used across multiple features — Modal, Sidebar, UML Editor, file handling, and error boundaries.

## Design Decisions

### Headless UI for Accessible Primitives

**Trade-off:** More markup than pre-styled components, but full control over appearance.

The Modal component uses Headless UI's Dialog/Transition for accessibility (focus trapping, escape key, screen reader support) while keeping all styling in Tailwind classes. This was chosen over a pre-styled library (e.g. Material UI) because the platform needs a clean, functional appearance — not a branded design system.

### UML Editor with Three Modes (Visual, Text, Preview)

**Trade-off:** Complex component with bidirectional sync, but supports diverse workflows.

The UML Editor supports:
- **Visual mode**: xyflow-based class diagram editor (drag-and-drop)
- **Text mode**: PlantUML syntax editing
- **Preview mode**: Rendered diagram preview

Bidirectional sync between visual and text modes means changes in one are reflected in the other. This is complex but necessary — some users prefer graphical editing, others prefer text. The editor exports both PlantUML text and JSON editor state, so the grading system can compare diagrams structurally (not just visually).

### Modal Size Variants (sm to screen)

**Trade-off:** More props to manage, but avoids one-size-fits-all.

The Modal component accepts a size prop (sm, md, lg, xl, 2xl, screen) because modals are used for everything from confirmation dialogs (sm) to question creation forms (lg) to the UML editor (screen). A single default size would either waste space for small dialogs or constrain large forms.

### Feature-Specific Components Stay in Features

Only truly shared components live here. Feature-specific components (e.g. `GradingPanel`, `QuestionPoolPanel`) stay in their feature directories even if they're large. This prevents the shared components folder from becoming a dumping ground.

## How This Helps the Platform

Consistent UI primitives (modals, sidebars, error handling) create a predictable experience across the platform. The UML Editor is the platform's differentiator — supporting multiple editing modes makes it accessible to students with different skill levels.
