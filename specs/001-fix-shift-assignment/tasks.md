# Tasks: Fix Shift Block Doctor Assignment

**Input**: Design documents from `/specs/001-fix-shift-assignment/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Tests are explicitly requested — this is a test-first (TDD) feature. Tests MUST be written before bug fixes.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Testing Infrastructure)

**Purpose**: Add Vitest for unit testing alongside existing Playwright e2e setup

- [ ] T001 Install Vitest as dev dependency: `npm install -D vitest`
- [ ] T002 Create Vitest configuration with TypeScript and `@/` path alias support in `vitest.config.ts`
- [ ] T003 Add `test:unit` script to `package.json` (`vitest run`) and `test:unit:watch` script (`vitest`)

**Checkpoint**: `npx vitest run` executes without errors (no tests yet)

---

## Phase 2: Foundational (Unit Test Helpers & Shared Fixtures)

**Purpose**: Create test fixtures and helpers that all test phases depend on

**CRITICAL**: No user story tests can begin until this phase is complete

- [ ] T004 Create shared test fixture factory for Dienst objects in `src/hooks/__tests__/fixtures.ts` — factory functions: `makeDienst(overrides)`, `makeBaseSlot(van, tot, wg)`, `makeStandaardAssignment(van, tot, wg, deelnemerId)`, `makeAchterwachtAssignment(...)`, `makeExtraDokterAssignment(...)`, `makeDienstenResponse(diensten[])`
- [ ] T005 [P] Create mock helpers for Drizzle ORM `db.transaction` and `auth.api.getSession` in `src/pages/api/diensten/__tests__/mocks.ts` — mock the `@/db` and `@/lib/auth` modules, provide `mockTransaction(callback)` that captures select/insert/update/delete calls

**Checkpoint**: Fixture and mock modules import cleanly in Vitest

---

## Phase 3: User Story 1 — Assign Doctor to Middle Stripe (Priority: P1) MVP

**Goal**: Verify and fix middle (Standaard) stripe assignment — assign, reassign, unassign

**Independent Test**: Select a doctor, click middle stripe, verify database record with correct type and UI update

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation fixes**

- [ ] T006 [P] [US1] Unit test `dienstenToShiftBlocks` — base slot only (type=1) produces block with null middle/top/bottom in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T007 [P] [US1] Unit test `dienstenToShiftBlocks` — base + type=0 record populates middle stripe with correct DoctorInfo in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T008 [P] [US1] Unit test `dienstenToShiftBlocks` — base + type=4 (legacy) populates middle stripe in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T009 [P] [US1] Unit test `dienstenToShiftBlocks` — base + type=6 (legacy) populates middle stripe in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T010 [P] [US1] Unit test `dienstenToShiftBlocks` — wide Standaard row (type=0 with wider van/tot) populates middle via overlap fallback in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T011 [P] [US1] Unit test `intervalsOverlap` helper — various overlap/non-overlap cases in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T012 [P] [US1] Unit test `toDoctorInfo` helper — valid dienst, null deelnemers, empty strings in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T013 [P] [US1] Unit test assign API — middle assign new (no existing record) inserts type=0 in `src/pages/api/diensten/__tests__/assign.test.ts`
- [ ] T014 [P] [US1] Unit test assign API — middle assign existing (exact match) updates iddeelnemer in `src/pages/api/diensten/__tests__/assign.test.ts`
- [ ] T015 [P] [US1] Unit test assign API — middle assign existing (overlap match) updates iddeelnemer in `src/pages/api/diensten/__tests__/assign.test.ts`
- [ ] T016 [P] [US1] Unit test assign API — middle unassign deletes all overlapping type 0/4/6 records in `src/pages/api/diensten/__tests__/assign.test.ts`
- [ ] T017 [P] [US1] Unit test assign API — validation: missing fields returns 400, no session returns 401, GET returns 405 in `src/pages/api/diensten/__tests__/assign.test.ts`
- [ ] T018 [US1] E2E test — login, navigate to `/rooster-maken-secretaris`, select doctor from sidebar, click middle stripe, verify API call succeeds and UI shows doctor initials in `e2e/rooster-maken-secretaris.spec.ts`
- [ ] T019 [US1] E2E test — middle stripe reassign: assign doctor A, then assign doctor B to same middle stripe, verify B replaces A in `e2e/rooster-maken-secretaris.spec.ts`
- [ ] T020 [US1] E2E test — middle stripe delete: assign doctor, enable delete mode, click middle stripe, verify removal in `e2e/rooster-maken-secretaris.spec.ts`

### Bug Fixes for User Story 1

- [ ] T021 [US1] Fix any failing unit tests in `src/hooks/useDienstenSchedule.ts` — adjust `dienstenToShiftBlocks` middle stripe logic if tests reveal issues
- [ ] T022 [US1] Fix any failing unit tests in `src/pages/api/diensten/assign.ts` — adjust middle section assign/unassign logic if tests reveal issues
- [ ] T023 [US1] Fix any failing e2e tests for middle stripe — debug UI interaction flow in `src/pages/rooster-maken-secretaris.tsx` if needed

**Checkpoint**: All middle stripe unit tests and e2e tests pass. Middle assignment works end-to-end.

---

## Phase 4: User Story 2 — Assign Doctor to Top (Achterwacht) Stripe (Priority: P1)

**Goal**: Verify and fix top (Achterwacht) stripe assignment — assign, reassign, unassign

**Independent Test**: Select a doctor, click top stripe, verify database record with type=5

### Tests for User Story 2

- [ ] T024 [P] [US2] Unit test `dienstenToShiftBlocks` — base + type=5 record populates top stripe with correct DoctorInfo in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T025 [P] [US2] Unit test assign API — top assign new inserts type=5 in `src/pages/api/diensten/__tests__/assign.test.ts`
- [ ] T026 [P] [US2] Unit test assign API — top assign existing updates iddeelnemer in `src/pages/api/diensten/__tests__/assign.test.ts`
- [ ] T027 [P] [US2] Unit test assign API — top unassign deletes type=5 record in `src/pages/api/diensten/__tests__/assign.test.ts`
- [ ] T028 [US2] E2E test — select doctor, click top stripe of shift block, verify API call and UI shows doctor initials in top stripe in `e2e/rooster-maken-secretaris.spec.ts`
- [ ] T029 [US2] E2E test — top stripe delete: assign doctor to top, enable delete mode, click top stripe, verify removal in `e2e/rooster-maken-secretaris.spec.ts`

### Bug Fixes for User Story 2

- [ ] T030 [US2] Fix any failing unit tests for top stripe in `src/hooks/useDienstenSchedule.ts` — ensure type=5 records are correctly grouped with base slot
- [ ] T031 [US2] Fix any failing unit tests for top section in `src/pages/api/diensten/assign.ts`
- [ ] T032 [US2] Fix any failing e2e tests for top stripe — check ShiftBlock click handler and data-testid attributes in `src/components/ShiftBlock/ShiftBlock.tsx`

**Checkpoint**: All top stripe unit tests and e2e tests pass. Achterwacht assignment works end-to-end.

---

## Phase 5: User Story 3 — Assign Doctor to Bottom (Extra Dokter) Stripe (Priority: P1)

**Goal**: Verify and fix bottom (Extra Dokter) stripe assignment — assign, reassign, unassign

**Independent Test**: Select a doctor, click bottom stripe, verify database record with type=9

### Tests for User Story 3

- [ ] T033 [P] [US3] Unit test `dienstenToShiftBlocks` — base + type=9 record populates bottom stripe in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T034 [P] [US3] Unit test `dienstenToShiftBlocks` — base + type=11 (deprecated) populates bottom stripe in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T035 [P] [US3] Unit test assign API — bottom assign new inserts type=9 in `src/pages/api/diensten/__tests__/assign.test.ts`
- [ ] T036 [P] [US3] Unit test assign API — bottom assign existing updates iddeelnemer in `src/pages/api/diensten/__tests__/assign.test.ts`
- [ ] T037 [P] [US3] Unit test assign API — bottom unassign deletes type=9 record in `src/pages/api/diensten/__tests__/assign.test.ts`
- [ ] T038 [P] [US3] Unit test assign API — bottom unassign with type=11 record also deletes it (suspected bug: currently only matches type=9) in `src/pages/api/diensten/__tests__/assign.test.ts`
- [ ] T039 [US3] E2E test — select doctor, click bottom stripe of shift block, verify API call and UI shows doctor initials in bottom stripe in `e2e/rooster-maken-secretaris.spec.ts`
- [ ] T040 [US3] E2E test — bottom stripe delete: assign doctor to bottom, enable delete mode, click bottom stripe, verify removal in `e2e/rooster-maken-secretaris.spec.ts`

### Bug Fixes for User Story 3

- [ ] T041 [US3] Fix type=11 unassign bug: add type=11 to bottom unassign query in `src/pages/api/diensten/assign.ts` (add 11 to the type match for bottom section deletion)
- [ ] T042 [US3] Fix any failing unit tests for bottom stripe in `src/hooks/useDienstenSchedule.ts`
- [ ] T043 [US3] Fix any failing e2e tests for bottom stripe — check ShiftBlock click handler in `src/components/ShiftBlock/ShiftBlock.tsx`

**Checkpoint**: All bottom stripe unit tests and e2e tests pass. Extra Dokter assignment works end-to-end.

---

## Phase 6: User Story 4 — All Three Stripes Independently (Priority: P2)

**Goal**: Verify that assigning/unassigning one stripe does not affect the other two

**Independent Test**: Assign three different doctors to top/middle/bottom of same block, delete one, verify others remain

### Tests for User Story 4

- [ ] T044 [P] [US4] Unit test `dienstenToShiftBlocks` — base + type=0 + type=5 + type=9 all populate their respective stripes simultaneously in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T045 [P] [US4] Unit test `groupShiftBlocksByWaarneemgroep` — blocks grouped correctly by idwaarneemgroep in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T046 [US4] E2E test — assign Doctor A to middle, Doctor B to top, Doctor C to bottom of same block, verify all three visible simultaneously in `e2e/rooster-maken-secretaris.spec.ts`
- [ ] T047 [US4] E2E test — with all three stripes assigned, delete only top stripe, verify middle and bottom remain in `e2e/rooster-maken-secretaris.spec.ts`

### Bug Fixes for User Story 4

- [ ] T048 [US4] Fix any cross-stripe interference bugs revealed by tests — likely in grouping logic in `src/hooks/useDienstenSchedule.ts` or API transaction isolation in `src/pages/api/diensten/assign.ts`

**Checkpoint**: Three independent stripe assignments coexist correctly. Deleting one doesn't affect others.

---

## Phase 7: User Story 5 — Database Consistency After Page Reload (Priority: P2)

**Goal**: Verify assignments persist across page reloads and are correctly loaded from database

**Independent Test**: Make assignments, reload page, verify all stripes match database state

### Tests for User Story 5

- [ ] T049 [US5] E2E test — assign doctor to all three stripes, reload page, verify all three doctors reappear in correct stripes in `e2e/rooster-maken-secretaris.spec.ts`
- [ ] T050 [US5] Unit test `dienstenToShiftBlocks` — no base record in group (type=1 missing) returns empty blocks in `src/hooks/__tests__/useDienstenSchedule.test.ts`
- [ ] T051 [US5] Unit test `dienstenToShiftBlocks` — multiple base slots with independent assignments produce correct separate blocks in `src/hooks/__tests__/useDienstenSchedule.test.ts`

### Bug Fixes for User Story 5

- [ ] T052 [US5] Fix any grouping key mismatch where type=5/9 records with slightly different van/tot are not grouped with base — may need overlap-based grouping in `src/hooks/useDienstenSchedule.ts`
- [ ] T053 [US5] Fix missing base record handling in `src/pages/api/diensten/assign.ts` — return 400 error instead of inserting with null metadata

**Checkpoint**: Assignments survive page reload. All stripes correctly loaded from database.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, cleanup, and test suite hardening

- [ ] T054 [P] E2E test — double-click protection: rapidly click same stripe twice, verify only one API call fires in `e2e/rooster-maken-secretaris.spec.ts`
- [ ] T055 [P] E2E test — clicking stripe without selecting doctor does nothing in `e2e/rooster-maken-secretaris.spec.ts`
- [ ] T056 [P] E2E test — same doctor assigned to multiple stripes of same block is allowed in `e2e/rooster-maken-secretaris.spec.ts`
- [ ] T057 E2E test cleanup — ensure all e2e tests clean up assignments in afterEach hooks in `e2e/rooster-maken-secretaris.spec.ts`
- [ ] T058 Run full test suite: `npx vitest run && npx playwright test` — all tests pass
- [ ] T059 Run quickstart.md validation — verify setup instructions are accurate

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all test phases
- **US1 (Phase 3)**: Depends on Phase 2 — MVP, start here
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1
- **US3 (Phase 5)**: Depends on Phase 2 — can run in parallel with US1/US2
- **US4 (Phase 6)**: Depends on US1 + US2 + US3 bug fixes (needs all three stripes working)
- **US5 (Phase 7)**: Depends on US1 + US2 + US3 bug fixes (needs assignments to verify persistence)
- **Polish (Phase 8)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (Middle)**: Independent after Phase 2
- **US2 (Top)**: Independent after Phase 2
- **US3 (Bottom)**: Independent after Phase 2
- **US4 (Combined)**: Requires US1 + US2 + US3 fixes complete
- **US5 (Persistence)**: Requires US1 + US2 + US3 fixes complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation fixes
- Unit tests before e2e tests (faster feedback loop)
- Bug fixes only after tests identify the failures
- Story complete before moving to dependent stories

### Parallel Opportunities

- **Phase 2**: T004 and T005 can run in parallel (different files)
- **Phase 3**: T006–T017 can all run in parallel (different test cases in different files)
- **Phase 4**: T024–T027 can run in parallel
- **Phase 5**: T033–T038 can run in parallel
- **Phase 6**: T044–T045 can run in parallel
- **US1, US2, US3**: Can run in parallel after Phase 2 (they test different stripes)

---

## Parallel Example: User Story 1

```bash
# Launch all unit tests for US1 together (different test cases, same test files):
Task: T006 — dienstenToShiftBlocks base-only test
Task: T007 — dienstenToShiftBlocks base + type=0 test
Task: T008 — dienstenToShiftBlocks base + type=4 legacy test
Task: T011 — intervalsOverlap helper tests
Task: T012 — toDoctorInfo helper tests
Task: T013 — assign API middle new test
Task: T014 — assign API middle existing test
Task: T016 — assign API middle unassign test
Task: T017 — assign API validation tests

# Then sequential: e2e tests (depend on unit tests passing to know what to fix)
Task: T018 — e2e middle stripe assign
Task: T019 — e2e middle stripe reassign
Task: T020 — e2e middle stripe delete

# Then sequential: bug fixes based on test failures
Task: T021 — fix useDienstenSchedule
Task: T022 — fix assign API
Task: T023 — fix UI
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup Vitest
2. Complete Phase 2: Test fixtures and mocks
3. Complete Phase 3: US1 tests → identify bugs → fix
4. **STOP and VALIDATE**: Middle stripe works end-to-end
5. Proceed to US2/US3

### Incremental Delivery

1. Setup + Foundational → Testing infrastructure ready
2. US1 (Middle stripe) → Test + Fix → Validate (MVP!)
3. US2 (Top stripe) → Test + Fix → Validate
4. US3 (Bottom stripe) → Test + Fix → Validate
5. US4 (Combined) → Integration test → Fix cross-stripe bugs
6. US5 (Persistence) → Reload test → Fix grouping bugs
7. Polish → Edge cases + cleanup

### Single Developer Strategy (Recommended)

Since US1/US2/US3 test similar code paths, the most efficient approach is:

1. Phase 1 + 2: Setup (fast)
2. Write ALL unit tests for US1+US2+US3 at once (they're in the same test files)
3. Run tests → identify all failures at once
4. Fix bugs systematically (transformation layer first, then API, then UI)
5. US4 + US5 integration tests to verify fixes hold
6. Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests are TDD: write first, ensure they fail, then fix
- E2E tests use test user `bartveltggdhvb@sivision.nl` and clean up after each test
- Commit after each phase or logical group
- Stop at any checkpoint to validate story independently
