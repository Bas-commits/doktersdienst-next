# Feature Specification: Fix Shift Block Doctor Assignment

**Feature Branch**: `001-fix-shift-assignment`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "create me e2e tests and unit test for the /rooster-maken-secretaris page. the user should be able to assign doctors to the top (achterwacht) middle (normal) and bottom (extra doctor) stripes of the shiftblock. and they need to be correctly reflected in the database. Currently this is not working properly. lets resolve the issues by first identifying where the issues are by creating unit and e2e tests and then resolve the issues so that we know what to resolve"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assign Doctor to Middle (Standaard) Stripe (Priority: P1)

A secretary selects a doctor from the sidebar and clicks the middle stripe of a shift block. The doctor is assigned to that shift and the assignment is persisted in the database with the correct type code and time window. The UI updates to show the doctor's initials and color in the middle stripe.

**Why this priority**: The middle stripe is the primary assignment — every shift needs a standard doctor. If this doesn't work, the scheduler is fundamentally broken.

**Independent Test**: Can be tested by selecting a doctor, clicking the middle stripe of an empty shift block, and verifying the database contains a record with the correct doctor ID, time window, waarneemgroep, and type (0/4/6). The UI should reflect the doctor's name and color.

**Acceptance Scenarios**:

1. **Given** a shift block with no middle assignment and a doctor selected in the sidebar, **When** the secretary clicks the middle stripe, **Then** a database record is created with the doctor's ID, correct van/tot timestamps, correct idwaarneemgroep, and appropriate type code, and the UI shows the doctor's initials and color in the middle stripe.
2. **Given** a shift block with an existing middle assignment and a different doctor selected, **When** the secretary clicks the middle stripe, **Then** the existing record is updated to the new doctor's ID, and the UI reflects the change.
3. **Given** a shift block with a middle assignment and delete mode is active, **When** the secretary clicks the middle stripe, **Then** the assignment record is removed from the database and the UI shows the middle stripe as empty.

---

### User Story 2 - Assign Doctor to Top (Achterwacht) Stripe (Priority: P1)

A secretary selects a doctor from the sidebar and clicks the top stripe of a shift block. The doctor is assigned as achterwacht (backup) for that shift. The assignment is persisted with type=5 and the UI shows the doctor's initials in the top stripe.

**Why this priority**: Achterwacht is a critical safety role — shifts without proper backup coverage are a compliance risk.

**Independent Test**: Can be tested by selecting a doctor, clicking the top stripe, and verifying the database record has type=5 with the correct doctor and time window.

**Acceptance Scenarios**:

1. **Given** a shift block with no top assignment and a doctor selected, **When** the secretary clicks the top stripe, **Then** a database record is created with type=5, the doctor's ID, and matching van/tot/idwaarneemgroep, and the UI shows the doctor's initials in the top stripe.
2. **Given** a shift block with an existing top assignment and a different doctor selected, **When** the secretary clicks the top stripe, **Then** the existing type=5 record is updated to the new doctor, and the UI reflects the change.
3. **Given** a shift block with a top assignment and delete mode is active, **When** the secretary clicks the top stripe, **Then** the type=5 record is removed and the top stripe appears empty.

---

### User Story 3 - Assign Doctor to Bottom (Extra Dokter) Stripe (Priority: P1)

A secretary selects a doctor from the sidebar and clicks the bottom stripe of a shift block. The doctor is assigned as the extra doctor for that shift. The assignment is persisted with type=9 and the UI shows the doctor's initials in the bottom stripe.

**Why this priority**: Extra doctor assignment is equally critical for proper shift coverage and must work reliably.

**Independent Test**: Can be tested by selecting a doctor, clicking the bottom stripe, and verifying the database record has type=9 with the correct doctor and time window.

**Acceptance Scenarios**:

1. **Given** a shift block with no bottom assignment and a doctor selected, **When** the secretary clicks the bottom stripe, **Then** a database record is created with type=9, the doctor's ID, and matching van/tot/idwaarneemgroep, and the UI shows the doctor's initials in the bottom stripe.
2. **Given** a shift block with an existing bottom assignment and a different doctor selected, **When** the secretary clicks the bottom stripe, **Then** the existing type=9 record is updated to the new doctor, and the UI reflects the change.
3. **Given** a shift block with a bottom assignment and delete mode is active, **When** the secretary clicks the bottom stripe, **Then** the type=9 record is removed and the bottom stripe appears empty.

---

### User Story 4 - Assign All Three Stripes Independently (Priority: P2)

A secretary assigns different doctors to all three stripes of the same shift block. Each assignment is stored as a separate database record with the correct type code, and all three are displayed correctly in the UI simultaneously.

**Why this priority**: The combined scenario validates that stripes don't interfere with each other — a common source of bugs.

**Independent Test**: Assign three different doctors to top, middle, and bottom of the same shift block, then verify all three database records exist independently and the UI shows all three correctly.

**Acceptance Scenarios**:

1. **Given** an empty shift block, **When** the secretary assigns Doctor A to middle, Doctor B to top, and Doctor C to bottom, **Then** three separate database records exist (one for middle, one with type=5 for top, one with type=9 for bottom) with correct doctor IDs, and the UI shows all three doctors simultaneously.
2. **Given** a fully assigned shift block, **When** the secretary deletes only the top assignment, **Then** only the top record is removed, the middle and bottom assignments remain intact in both the database and UI.

---

### User Story 5 - Database Consistency After Page Reload (Priority: P2)

After making assignments, when the secretary reloads the page or navigates away and back, all assignments are correctly loaded from the database and displayed in the correct stripes.

**Why this priority**: Persistence verification ensures assignments aren't just visual — they survive across sessions.

**Independent Test**: Make assignments, reload the page, and verify all three stripes show the correct doctors matching what's in the database.

**Acceptance Scenarios**:

1. **Given** a shift block with all three stripes assigned, **When** the page is reloaded, **Then** all three doctors appear in their correct stripes matching the database records.

---

### Edge Cases

- What happens when the same doctor is assigned to multiple stripes of the same shift block?
- What happens when the secretary double-clicks rapidly — does it create duplicate records?
- What happens when the base (type=1) record is missing for a shift time window?
- What happens when legacy type codes (4, 6, 11) exist in the database — are they correctly displayed and modifiable?
- What happens when the secretary tries to assign without selecting a doctor first?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow assigning a doctor to the middle (Standaard) stripe of a shift block, persisting the assignment with the correct type code and time window.
- **FR-002**: System MUST allow assigning a doctor to the top (Achterwacht) stripe of a shift block, persisting the assignment with type=5.
- **FR-003**: System MUST allow assigning a doctor to the bottom (Extra Dokter) stripe of a shift block, persisting the assignment with type=9.
- **FR-004**: System MUST allow removing (unassigning) a doctor from any stripe when delete mode is active.
- **FR-005**: System MUST allow reassigning a different doctor to an already-assigned stripe by updating the existing record.
- **FR-006**: System MUST correctly load and display all three stripe assignments from the database when the page loads.
- **FR-007**: System MUST prevent duplicate assignments from rapid clicking (double-click protection).
- **FR-008**: System MUST handle legacy type codes (4, 6 for middle; 11 for bottom) correctly when reading existing data.
- **FR-009**: System MUST correctly map the van/tot timestamps and idwaarneemgroep from the shift block to the database record.
- **FR-010**: System MUST use transactional database operations to prevent partial or inconsistent state.

### Key Entities

- **Dienst (Shift Record)**: A database record representing a time window assignment. Key attributes: idwaarneemgroep (group), van/tot (time window as Unix seconds), iddeelnemer (doctor ID), type (assignment category), idpraktijk (practice ID), idshift, currentDate, nextDate.
- **ShiftBlockView**: A UI representation grouping related dienst records into a single visual block with three stripes (top, middle, bottom), each holding a doctor reference or empty.
- **DoctorInfo**: Doctor display data (id, name, shortName/initials, color) derived from a shift record's linked doctor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All three stripe assignments (top, middle, bottom) are correctly persisted in the database after each assignment action — verified by automated tests.
- **SC-002**: Assignments survive page reload — the same doctors appear in the same stripes before and after refresh.
- **SC-003**: Unassigning a doctor from one stripe does not affect the other two stripes of the same shift block.
- **SC-004**: Unit tests cover the assign logic for all three sections (assign, reassign, unassign) with 100% of scenarios passing.
- **SC-005**: End-to-end tests cover the full user flow (select doctor, click stripe, verify UI update, verify database state) for all three stripes.
- **SC-006**: No duplicate records are created when rapidly clicking on the same stripe.

## Assumptions

- The existing database schema and type code conventions will be preserved — no schema migrations are planned.
- The secretary user is already authenticated and has access to the /rooster-maken-secretaris page.
- There is always a base (type=1) record present for each valid shift time window — the assign logic depends on it to derive practice ID, shift ID, etc.
- Legacy type codes (4, 6, 11) in existing data are treated as equivalent to their modern counterparts when reading.
- The test environment has access to the database for verifying persistence in e2e tests.
- The waarneemgroep context is correctly set before the secretary interacts with the scheduler.
