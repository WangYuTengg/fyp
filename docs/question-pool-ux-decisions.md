# Question Pool UX Decisions and Tradeoffs

## Goal
Make question management intuitive for both:
- small pools (a few questions)
- large pools (1000+ questions)

## Decisions Made

### 1) Dedicated scalable question pool panel
Decision:
- Replaced direct render of all question cards with a dedicated panel component.
- Added sorting, pagination, result summary, and view mode toggles (`Cards` vs `Compact` table).

Tradeoff:
- More UI controls means slightly more complexity for first-time users.
- Benefit is much better navigation and reduced overload at high volume.

### 2) Keep all question data loaded once (client-side filtering)
Decision:
- Continued using a single fetched question list for the course.
- Applied filter/sort/pagination in the client.

Tradeoff:
- Initial load still includes all course questions.
- Avoids backend/API contract changes and keeps interaction very responsive once loaded.

### 3) Auto-bias to compact mode for large pools
Decision:
- Auto-switch initial question pool view to compact table when pool size is large (>80).

Tradeoff:
- Some users may prefer cards even with large pools.
- They can switch back manually; default is optimized for dense scanning.

### 4) Standardized question list controls
Decision:
- Added explicit controls for:
  - sort order
  - items per page
  - active filter visibility
  - page navigation (`First/Prev/Next/Last` + page buttons)

Tradeoff:
- Slightly denser toolbar.
- Major gain in predictability and discoverability for finding/editing specific questions quickly.

### 5) Assignment question picker scaled for large sets
Decision:
- Upgraded assignment creation step 3 question selector with:
  - search
  - `show selected only`
  - pagination
  - bulk actions (`select/clear page`, `select/clear filtered`)

Tradeoff:
- More interaction options than a plain checkbox list.
- Necessary to prevent unusable long scrolling when question counts are very high.

### 6) Preserve existing create/edit flows
Decision:
- Kept existing create-question modal and edit-question form behavior.
- Integrated them into new list modes instead of replacing form logic.

Tradeoff:
- Some technical duplication remains between card/table edit entry points.
- Lower regression risk and faster rollout without reworking stable form logic.

## Why this balances small and large pools
- Small pools remain simple: cards, minimal paging friction, easy visual scanning.
- Large pools gain structure: compact table, sorting, targeted filtering, and bounded page sizes.
- Assignment authoring no longer depends on long checkbox scrolls.
