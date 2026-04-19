---
description: Execute a step from any phase-by-phase plan file — discovers structure, creates docs, implements code, and updates status tracking.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

Execute a step from a plan file. Usage: `/execute-plan-step <plan-file-path> [step-number]`

**Arguments:**
- `$ARGUMENTS` — first token is the plan file path; optional second token is the step number to execute.

Parse `$ARGUMENTS`: split on whitespace. First token = plan file path, second token (if present) = step number.

---

## Phase 1 — Load the plan

Read the plan file at the path provided. Understand its structure:
- How are steps or phases numbered/named?
- What fields does each step have? (concept, what to build, key files, difficulty, why it matters, etc.)
- What status values does it use? (e.g. "Not Started", "In Progress", "Done")
- Does it reference a progress-tracking file (README, index, status table)?

Then determine which step to work on:
- If a step number was passed as the second argument, use that step.
- Otherwise, find the first step whose status is not "Done" (or equivalent).

Extract all available metadata for the chosen step: name, description, what to build, key files, difficulty, interview insight, or any other fields present.

---

## Phase 2 — Discover the workspace

Search for a progress-tracking file. Check in this order:
1. Any file explicitly referenced in the plan (e.g. `Documentation/README.md`, `PLAN_STATUS.md`)
2. A `README.md` in the same directory as the plan file
3. A `README.md` in any `Documentation/`, `docs/`, or `notes/` folder near the plan

If a progress-tracking file exists, read it to understand the current state.

Search for an existing completed step doc to use as a structural template:
- Look for files matching `step-*.md`, `phase-*.md`, or similar patterns near the plan or in a docs folder
- If one exists, read it — use it as the exact structural template for the new doc
- If none exists, infer a reasonable structure from the plan's own fields (see Phase 3 fallback below)

---

## Phase 3 — Read key files

Read every file listed under "key files" (or equivalent) in the plan for this step. Also read any other files that are clearly relevant based on what needs to change. Understand the current code before writing anything.

---

## Phase 4 — Create the documentation file

Determine the output directory for docs (same directory as any existing step docs, or `Documentation/` if none found, or adjacent to the plan file).

Name the file: `step-<NN>-<kebab-step-name>.md` (zero-padded step number, concept name in kebab-case).

**If a template doc was found in Phase 2:** replicate its exact section structure, filling in the new step's content.

**If no template exists (fallback structure):** use the following sections:

```
# Step N — [Step Name]

**Status:** Not Started
**Difficulty:** [if available]

## Problem / Goal
[What is broken or missing? What does this step accomplish?]

## The Solution
[Explain the approach. Include diagrams, pseudocode, or SQL where helpful.]

## Key Concepts
[For each major concept introduced: what it is, why it exists, how it appears in this step's code.]

## Coding Concepts Used
| Concept | What it is | Where it appears |

## Changes Made
[Annotated before/after code snippets with file paths and line numbers.]

## What You'll Learn
| Concept | Why It Matters |

## Interview Answer
> [A 4–6 sentence self-contained answer the user could give in an interview or design review.]

## Files Changed
| File | Change |
```

Add `// CONCEPT: [name]` comments in code snippets at every line that introduces a non-obvious concept, so readers can trace from docs back to code.

---

## Phase 5 — Implement the code changes

Make all code changes described in the plan for this step:
- Add `// CONCEPT: [name]` inline comments only where they label a concept from the doc — not to narrate what the code does.
- Only touch files relevant to this step. Do not refactor unrelated code.

After all changes, detect the build command:
1. Check for a `package.json` with a `build` script → run `npm run build`
2. Check for a `Makefile` with a `build` target → run `make build`
3. Check `CLAUDE.md` for the build command
4. If no build system is found, skip this substep and note it in the report.

Fix any compile/type errors before proceeding.

---

## Phase 6 — Update status tracking

Update status in every applicable place:

1. **Step doc** — change `**Status:** Not Started` (or equivalent) to `**Status:** Done`

2. **Progress-tracking file** (if found in Phase 2):
   - Mark the step as Done in its status column/field
   - Add a link to the new doc if there is a Doc column

3. **Plan file itself** — update the step's status field to Done (both places if it appears twice)

---

## Phase 7 — Report back

Tell the user:
- Which step was executed and from which plan
- What files were created or changed (list them)
- Whether the build passed or was skipped (and why)
- A suggested one-line commit message

Do NOT commit automatically — leave that to the user.
