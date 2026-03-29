# Tasks: Overname (Shift Takeover)

**Input**: Design documents from `/specs/002-overname-feature/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Schema migration and shared type changes

- [x] T001 Add `status` column (varchar(20), nullable, default NULL) to diensten table in drizzle/schema.ts
- [x] T002 Run `npx drizzle-kit generate` and `npx drizzle-kit migrate` to apply the status column migration
- [x] T003 Add `overnameType` field to `ShiftBlockView` interface in src/types/diensten.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core transformation logic and API infrastructure that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Update `dienstenToShiftBlocks()` in src/hooks/useDienstenSchedule.ts to handle overname records: type=4 with status='pending' → `overnameType: 'voorstelOvername'`, type=4 with status='declined' → `overnameType: 'vraagtekenOvername'`, type=6 with status='accepted' → `overnameType: 'overname'`, type=4/6 with status=NULL → legacy middle stripe (unchanged). Overname records should produce separate overlay ShiftBlockView entries (not merge into existing stripes). Use `iddienstovern` to look up the original dienst for positioning.
- [x] T005 Update the /overnames page in src/pages/overnames.tsx to fetch diensten with types [0, 1, 4, 6] instead of [0, 1], so overname records appear on the calendar.
- [x] T006 Pass `overnameType` from ShiftBlockView through to the ShiftBlock component's `overnameType` prop wherever ShiftBlock is rendered in the /overnames page (src/pages/overnames.tsx).

**Checkpoint**: Calendar now shows overname overlays for any manually-seeded type=4/6 records with status set.

---

## Phase 3: User Story 1 & 2 - Propose Full/Partial Shift Takeover (Priority: P1)

**Goal**: A doctor can click an assigned shift on /overnames, open a modal, select a target doctor (optionally with partial time range), and submit a proposal that creates a type=4 dienst.

**Independent Test**: Navigate to /overnames, click an assigned shift, select a target doctor, submit. Verify type=4 dienst created in DB. Enable "Deels overname", set partial time range, submit. Verify van/tot match partial window.

### Implementation

- [x] T007 [P] [US1] Create POST /api/overnames/propose endpoint in src/pages/api/overnames/propose.ts per contracts/api-overnames.md. Validate: original dienst exists (type=0), target doctor in same waarneemgroep, no self-proposal (senderId != iddeelnovern), no existing pending proposal for same iddienstovern, van/tot within original shift bounds. On success insert type=4 dienst with status='pending', senderId=session user, iddeelnovern=target doctor, iddienstovern=original dienst ID, iddeelnemer=original shift's doctor, idwaarneemgroep=same group.
- [x] T008 [P] [US1] Create OvernameModal component in src/components/OvernameModal.tsx. Props: the selected shift block data (date, time, label, doctor), list of waarneemgroep doctors, onSubmit callback, onClose callback. UI: shift details display, doctor dropdown (exclude the proposing doctor from the list), "Deels overname" checkbox that reveals start/end time pickers (pre-filled with shift times, constrained to shift bounds), submit button. Validate: target doctor required, time range valid when partial.
- [x] T009 [US1] Wire OvernameModal into src/pages/overnames.tsx: on click of an assigned shift block (type=0, has middle doctor), open the modal. Fetch waarneemgroep doctors for the dropdown (reuse existing /api/waarneemgroepen or deelnemers data). On modal submit, call POST /api/overnames/propose. On success, close modal and refetch calendar data so the new voorstel overlay appears.

**Checkpoint**: Full and partial overname proposals can be created and appear on the calendar with voorstelOvername state.

---

## Phase 4: User Story 3 - View Overname Proposals on Calendar (Priority: P2)

**Goal**: All waarneemgroep members see pending/accepted/declined overname overlays on the calendar with correct visual states.

**Independent Test**: Seed type=4 (pending), type=4 (declined), and type=6 (accepted) records in DB. Load /overnames. Verify three distinct visual states render correctly.

### Implementation

- [x] T010 [US3] Verify and refine the overlay rendering in src/pages/overnames.tsx: ensure overname ShiftBlocks render at a higher z-index than the original shift they overlay. Confirm voorstelOvername, overname, and vraagtekenOvername visual states display correctly for all three overnameType values. Handle partial overnames (shorter time range than original shift) by rendering the overlay at the correct position/width.

**Checkpoint**: All three overname visual states render correctly on the calendar for all users in the waarneemgroep.

---

## Phase 5: User Story 4 - Notifications and Accept/Decline (Priority: P2)

**Goal**: Target doctor sees pending proposals in the header, can accept (type→6, status→accepted) or decline (status→declined), and the calendar updates.

**Independent Test**: Create a type=4 pending record targeting the logged-in doctor. Verify header badge shows count. Open popover, verify real data. Click accept → verify type=6. Click decline on another → verify status=declined. Calendar updates after each action.

### Implementation

- [x] T011 [P] [US4] Create GET /api/overnames/pending endpoint in src/pages/api/overnames/pending.ts per contracts/api-overnames.md. Query diensten where type=4, status='pending', iddeelnovern=session user's deelnemer ID. Join with deelnemers to get doctor names/initials for vanArts (senderId) and naarArts (iddeelnovern). Return response matching the existing OvernameVerzoek interface shape.
- [x] T012 [P] [US4] Create POST /api/overnames/respond endpoint in src/pages/api/overnames/respond.ts per contracts/api-overnames.md. Validate: proposal exists (type=4, status='pending'), logged-in user is the target doctor (iddeelnovern). On accept: update type→6, status→'accepted'. On decline: update status→'declined' (type stays 4).
- [x] T013 [US4] Replace DUMMY_VERZOEKEN in src/components/header/DoktersdienstHeader.tsx with real data from GET /api/overnames/pending. Fetch on component mount (or page load). Update badge count to use real data length. Wire accept button to POST /api/overnames/respond with action='accept'. Wire decline button to POST /api/overnames/respond with action='decline'. Refetch pending data after each action. Ensure popover navigation (prev/next arrows) works with real data.

**Checkpoint**: Full overname lifecycle works end-to-end: propose → notify → accept/decline → calendar updates.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T014 [P] Update constitution in .specify/memory/constitution.md: change type=4 from "NOT YET BUILT" to active overname feature with status discriminator, and type=6 from "legacy Standaard" to dual-purpose (legacy when status=NULL, confirmed overname when status='accepted').
- [x] T015 [P] Add Storybook stories for OvernameModal component in src/components/OvernameModal.stories.tsx (default state, with "Deels overname" enabled, validation error states).
- [x] T016 Verify existing pages (rooster-inzien, rooster-maken-secretaris) are not affected by the status column addition — legacy type=4/6 records with status=NULL should continue rendering as middle stripe in useDienstenSchedule.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema + types must exist)
- **US1/US2 (Phase 3)**: Depends on Phase 2 (transformation logic must handle overname records)
- **US3 (Phase 4)**: Depends on Phase 2 (overlay rendering). Can start in parallel with Phase 3 using seeded data.
- **US4 (Phase 5)**: Depends on Phase 2. API endpoints (T011, T012) can start in parallel with Phase 3. Header integration (T013) benefits from Phase 3 being done for end-to-end testing.
- **Polish (Phase 6)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1/US2 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US3 (P2)**: Can start after Phase 2 — can use seeded data, independent of US1
- **US4 (P2)**: API tasks can start after Phase 2 — header wiring benefits from US1 for end-to-end

### Parallel Opportunities

- T007 and T008 can run in parallel (API endpoint vs React component, different files)
- T011 and T012 can run in parallel (two independent API endpoints)
- T014 and T015 can run in parallel (docs vs Storybook)
- US3 (Phase 4) and US4 API tasks (T011, T012) can start in parallel with US1/US2 (Phase 3)

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T006)
3. Complete Phase 3: US1/US2 — Propose (T007–T009)
4. **STOP and VALIDATE**: Test proposing full and partial overnames
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Calendar ready for overname overlays
2. Add US1/US2 → Proposing works → MVP
3. Add US3 → All users see overname states on calendar
4. Add US4 → Accept/decline completes the lifecycle
5. Polish → Constitution updated, Storybook stories, regression check

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story
- ShiftBlock `overnameType` prop is already implemented (from prior work)
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
