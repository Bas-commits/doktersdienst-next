# Implementation Plan: Fix Shift Block Doctor Assignment

**Branch**: `001-fix-shift-assignment` | **Date**: 2026-03-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-fix-shift-assignment/spec.md`

## Summary

The shift block doctor assignment on `/rooster-maken-secretaris` is not working correctly. The approach is test-first: create unit tests for the data transformation layer (`dienstenToShiftBlocks`) and the assign API handler, plus e2e tests for the full UI flow. Tests will expose the specific bugs, which will then be fixed. Vitest will be added for unit testing alongside the existing Playwright e2e setup.

## Technical Context

**Language/Version**: TypeScript 5 on Node.js (Next.js 16.1.6, Pages Router)
**Primary Dependencies**: React 19, Drizzle ORM 0.45.1, Better Auth 1.5.4, Tailwind CSS 4
**Storage**: PostgreSQL via Drizzle ORM (`pg` driver, pool of 20 connections)
**Testing**: Vitest (new, for unit tests) + Playwright 1.58.2 (existing, for e2e tests)
**Target Platform**: Web application (localhost:3005)
**Project Type**: Web service (Next.js Pages Router)
**Performance Goals**: N/A (correctness fix, not performance)
**Constraints**: Must preserve legacy type codes (0/4/5/6/11), with type 9 reserved for preferences; no schema migrations
**Scale/Scope**: Single page + 1 API endpoint + 1 data transformation hook

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Diensten Type System Integrity | PASS | Tests will validate correct type usage (0/4/6→middle, 5→top, 11→bottom). No new types introduced. |
| II. Legacy Compatibility | PASS | Tests will verify legacy types 4, 6, 11 are handled correctly. Overlap matching preserved. |
| III. Three-Stripe Shift Block Model | PASS | Tests validate all three stripes independently. |
| IV. Preference-Assignment Separation | PASS | Feature only touches assignments, not preferences. |
| V. Next.js Pages Router + Drizzle ORM Stack | PASS | Using existing patterns. Adding Vitest (test-only dependency). |

### Post-Phase 1 Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Diensten Type System Integrity | PASS | Data model document aligns with constitution type table. |
| II. Legacy Compatibility | PASS | Research R-006 identified type=11 gap in assign API — tests will catch this. |
| III. Three-Stripe Shift Block Model | PASS | Contract documents exact behavior per stripe. |
| IV. Preference-Assignment Separation | PASS | No preference logic touched. |
| V. Next.js Pages Router + Drizzle ORM Stack | PASS | Vitest is dev-only; no architectural changes. |

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-shift-assignment/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research findings
├── data-model.md        # Phase 1: data model documentation
├── quickstart.md        # Phase 1: setup instructions
├── contracts/
│   └── assign-api.md    # Phase 1: assign API contract
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── pages/
│   ├── api/diensten/
│   │   ├── assign.ts                    # API handler (to be fixed)
│   │   └── __tests__/
│   │       └── assign.test.ts           # NEW: unit tests for assign API
│   └── rooster-maken-secretaris.tsx     # Secretary page (may need fixes)
├── hooks/
│   ├── useDienstenSchedule.ts           # Data transformation (to be fixed)
│   └── __tests__/
│       └── useDienstenSchedule.test.ts  # NEW: unit tests for transformation
├── components/
│   └── ShiftBlock/
│       └── ShiftBlock.tsx               # UI component (may need fixes)
└── types/
    └── diensten.ts                      # Type definitions

e2e/
├── rooster-inzien.spec.ts              # Existing e2e tests
├── voorkeuren.spec.ts                  # Existing e2e tests
└── rooster-maken-secretaris.spec.ts    # NEW: e2e tests for assignment

vitest.config.ts                         # NEW: Vitest configuration
```

**Structure Decision**: Follows existing project conventions. Unit tests go in `__tests__/` directories adjacent to source files. E2E tests go in the `e2e/` directory. Vitest config at project root.

## Identified Bug Areas (from Research R-006)

These are the suspected issues based on code analysis. Tests will confirm which are actual bugs:

1. **Bottom type mismatch**: The assign API and schedule layer must consistently use type=11 for bottom assignments so type=9 remains preference-only.

2. **Missing base record**: If no type=1 record exists for a time window, the assign API inserts with null values for `idpraktijk`, `idshift`, `currentDate`, `nextDate`. The `dienstenToShiftBlocks` function skips groups without a base record entirely.

3. **Grouping key mismatch**: `dienstenToShiftBlocks` groups by exact `van-tot-wg` key. Type=5 and type=11 records must have exactly the same van/tot as the type=1 base to be grouped together. Any timestamp discrepancy (even 1 second) causes them to be in a separate group with no base, and they get skipped.

4. **Middle overlap fallback scope**: The fallback scan for middle stripe (lines 156-169 of useDienstenSchedule.ts) scans the entire response for overlapping type 0/4/6 records, but only the first match is used. If multiple overlapping records exist, only one doctor is shown.

## Implementation Phases

### Phase 1: Setup Testing Infrastructure

1. Add Vitest as dev dependency
2. Create `vitest.config.ts` with TypeScript and path alias support
3. Add `test:unit` script to package.json

### Phase 2: Unit Tests — Data Transformation

Create `src/hooks/__tests__/useDienstenSchedule.test.ts`:

- Test `dienstenToShiftBlocks` with synthetic data:
  - Single base slot (type=1) only → empty stripes
  - Base + type=0 → middle populated
  - Base + type=5 → top populated
  - Base + type=11 → bottom populated
  - Base + all three types → all stripes populated
  - Legacy types: type=4 → middle, type=6 → middle, type=11 → bottom
  - Wide Standaard row (type=0 with different van/tot) → middle via overlap
  - No base record → block skipped
  - Multiple base slots with independent assignments
- Test `intervalsOverlap` helper
- Test `toDoctorInfo` helper
- Test `groupShiftBlocksByWaarneemgroep`

### Phase 3: Unit Tests — Assign API

Create `src/pages/api/diensten/__tests__/assign.test.ts`:

- Mock Drizzle ORM `db.transaction`
- Test each section × operation:
  - middle assign (new) → INSERT type=0
  - middle assign (existing exact) → UPDATE
  - middle assign (existing overlap) → UPDATE
  - middle unassign → DELETE all overlapping 0/4/6
  - top assign (new) → INSERT type=5
  - top assign (existing) → UPDATE
  - top unassign → DELETE type=5
  - bottom assign (new) → INSERT type=11
  - bottom assign (existing) → UPDATE
  - bottom unassign → DELETE type=11
- Test validation: missing fields → 400
- Test auth: no session → 401
- Test method: GET → 405

### Phase 4: E2E Tests

Create `e2e/rooster-maken-secretaris.spec.ts`:

- Login and navigate to `/rooster-maken-secretaris`
- Test doctor sidebar: doctors listed, can select/deselect
- Test middle stripe assignment:
  - Select doctor → click middle stripe → verify UI update → verify API call succeeds
  - Reload → verify persistence
- Test top stripe assignment:
  - Select doctor → click top stripe → verify UI update
- Test bottom stripe assignment:
  - Select doctor → click bottom stripe → verify UI update
- Test delete mode:
  - Assign → enable delete → click assigned stripe → verify removal
- Test all three stripes on same block:
  - Assign different doctors to top, middle, bottom → verify all visible
  - Delete one → verify others remain
- Cleanup: unassign all test assignments in afterEach

### Phase 5: Bug Fixes

Based on test failures, fix the identified issues:

1. **If bottom assignment type mismatch exists**: Ensure assign.ts stores/deletes bottom assignments as type=11 only
2. **If grouping mismatches occur**: Use overlap matching in `dienstenToShiftBlocks` for top/bottom stripes (not just middle)
3. **If base record is missing**: Add error handling or graceful degradation in assign.ts
4. **Any other issues revealed by tests**

## Complexity Tracking

No constitution violations. No complexity justifications needed.
