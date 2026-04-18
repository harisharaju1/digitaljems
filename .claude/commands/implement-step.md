---
description: Implement a step from the system design learning roadmap — creates documentation, makes code changes, and updates status tracking.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

You are implementing a step from the DigitalJems system design learning roadmap. The user may pass a step number as an argument (e.g. `/implement-step 2`). If no argument is given, find the next step with status "Not Started" in `Documentation/README.md`.

## Key files to read first
- `Documentation/README.md` — progress table with step statuses
- `/Users/harisharaju/.claude/plans/thanks-i-m-using-this-merry-pond.md` — full plan with concept details, what to build, key files, and interview insight for each step
- `Documentation/step-01-cursor-based-pagination.md` — the reference template for how a step doc should look

---

## Phase 1 — Identify the step

Read `Documentation/README.md`. Find the step to work on:
- If the user passed a step number, use that step.
- Otherwise, use the first step with status "Not Started".

Then read the plan file and extract for that step:
- Concept name
- Why it matters
- What to build
- Key files
- Interview insight
- Difficulty

---

## Phase 2 — Explore the key files

Read every file listed under "Key files" in the plan for this step. Also read any other files that are clearly relevant based on what needs to change. Understand the current code before writing anything.

---

## Phase 3 — Create the documentation file

Create `Documentation/step-0N-<kebab-concept-name>.md` (e.g. `step-02-swr-caching.md`).

Use `Documentation/step-01-cursor-based-pagination.md` as the exact structural template. The doc must include all of these sections in this order:

### 1. Header block
```
# Step N — [Concept Name]

**System design concept:** [concept]
**Status:** Not Started
**Difficulty:** [Beginner / Intermediate / Advanced]
```

### 2. The Problem We're Solving
Explain concretely what is broken or missing in the current codebase. Include a one-line flow diagram showing the current bad path (like `User opens app → action → problem`). Use bullet points for consequences at scale.

### 3. Why Not [naive approach]? (with analogy)
Name the naive/common approach. Explain it with a plain-English analogy (physical object, everyday scenario — not technical). Explain the hidden bug or performance issue.

### 4. The Fix: [Concept Name]
Explain the solution. Use SQL or pseudocode to show the difference. Give a second analogy. Include a text-based performance comparison diagram.

### 5. What a "[Key Term]" Actually Is
Walk through a concrete example using the app's actual data (product timestamps, order IDs, etc.) to show how the core concept works end to end.

### 6. High-Level Code Blocks
For each major TypeScript/React construct used in this step's implementation, add a sub-section with:
- **What it is** — a one-sentence plain-English definition
- **Why it exists** — the problem it solves without jargon
- **In this step** — an annotated code snippet showing it being used

Choose from: `interface`, `type alias`, `async method`, `export const`, `let` vs `const`, Zustand store (`create<State>()()`), JSX conditional (`&&`), `useEffect`, `React hook`, Edge Function, SQL migration, and any others relevant to the step.

### 7. Coding Concepts Used
A table with three columns: **Concept | What it is | Where it appears**

List every language-level concept that appears in the new code: default parameters, optional chaining, destructuring, spread operator, ternary, method chaining, generics, etc.

### 8. How This Fits in the DigitalJems Codebase
Two sub-sections:

**Current code (the problem):** Show the exact current code from the files (with file path and line number), annotated with `// CONCEPT:` comments explaining what the problem is.

**What we'll add — annotated:** Show the new/changed code with detailed `// CONCEPT:` inline comments at every non-obvious line. Label each concept by name so the reader can connect it back to the tables above.

### 9. What You'll Learn
A table: **Concept | Why It Matters**

### 10. Interview Version
A single blockquoted paragraph the user can say in a system design interview to explain this concept. Should be 4–6 sentences, self-contained.

### 11. Files to Touch
A table: **File | Change**

---

## Phase 4 — Implement the code changes

Make all the code changes described in the plan for this step. Follow these rules:

- Add `// CONCEPT: [name]` comments at every line that introduces a concept listed in the doc. This connects the live code to the documentation.
- Do not add comments that just describe what the code does — only comments explaining WHY or labelling a concept.
- Do not refactor unrelated code. Only touch the files listed in the plan.
- After all changes, run `npm run build` and fix any TypeScript errors before proceeding.

---

## Phase 5 — Update status tracking

Update three places:

1. **`Documentation/step-0N-<name>.md`** — change `**Status:** Not Started` to `**Status:** Done`

2. **`Documentation/README.md`** — in the progress table:
   - Change the step's Status from `Not Started` to `Done`
   - Replace the `—` in the Doc column with `[step-0N](./step-0N-<name>.md)`

3. **Plan file** (`/Users/harisharaju/.claude/plans/thanks-i-m-using-this-merry-pond.md`) — update both occurrences of the step's status to `Done`.

---

## Phase 6 — Report back

Tell the user:
- Which step was implemented
- What files were changed
- That the build passes
- That they can commit with a short one-liner (suggest one)

Do NOT commit automatically — leave that to the user.
