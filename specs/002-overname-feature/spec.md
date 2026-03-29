# Feature Specification: Overname (Shift Takeover)

**Feature Branch**: `002-overname-feature`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "Build the overname feature — propose, confirm, and decline shift takeovers between doctors within a waarneemgroep, with calendar overlay and header notifications."

## Clarifications

### Session 2026-03-29

- Q: How is the declined overname state stored? → A: Keep type=4, add a status field (e.g. `pending` / `declined`) to the diensten record.
- Q: How does a type=4 proposal reference the original dienst? → A: Use the purpose-built `iddienstovern` column to store the original dienst's ID, and `iddeelnovern` to store the target doctor's ID.
- Q: Who can initiate an overname proposal? → A: Any doctor in the waarneemgroep can propose an overname for any assigned shift (not limited to the assigned doctor).
- Q: Can multiple proposals exist simultaneously for the same shift? → A: Only one active proposal per shift at a time; it must be declined before a new one can be created.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Propose a Full Shift Takeover (Priority: P1)

A doctor navigates to the `/overnames` page and clicks on an **assigned** shift in the calendar. A modal opens showing the shift details and a dropdown to select another doctor from the waarneemgroep. The doctor submits the proposal, creating a new dienst record of type=4 (voorstel overname).

**Why this priority**: This is the core action that initiates the entire overname flow. Without the ability to propose a takeover, no other stories can function.

**Independent Test**: Can be fully tested by navigating to /overnames, clicking an assigned shift, selecting a target doctor, and submitting. Verify a type=4 dienst is created in the database with the correct time range and target doctor.

**Acceptance Scenarios**:

1. **Given** a doctor is on the /overnames page viewing assigned shifts, **When** they click an assigned shift block, **Then** a modal opens showing the proposal form with the shift details (date, time, label).
2. **Given** the proposal modal is open, **When** the doctor selects a target doctor from the waarneemgroep dropdown and submits, **Then** a type=4 dienst is created linking the proposing doctor, the target doctor, and the original shift's time range.
3. **Given** the proposal modal is open, **When** the doctor clicks an unassigned shift (type=1), **Then** the modal does not open (only assigned shifts are eligible for overname).
4. **Given** a proposal is submitted successfully, **When** the calendar refreshes, **Then** the new voorstel overname appears as a ShiftBlock overlay with the `voorstelOvername` visual state.

---

### User Story 2 - Propose a Partial Shift Takeover (Priority: P1)

Same as Story 1, but the doctor checks the "Deels overname" checkbox in the modal. This reveals time pickers that allow selecting a sub-window within the original shift's time range. The created type=4 dienst only covers the selected partial time window.

**Why this priority**: Partial takeover is a core variant of the proposal flow — it shares the same modal and is needed from day one.

**Independent Test**: Open the modal for a shift (e.g. 08:00-16:00), enable "Deels overname", set the time window to 10:00-14:00, submit. Verify the type=4 dienst has van/tot matching the partial window.

**Acceptance Scenarios**:

1. **Given** the proposal modal is open, **When** the doctor checks "Deels overname", **Then** start and end time pickers appear, pre-filled with the original shift's start and end times.
2. **Given** "Deels overname" is checked, **When** the doctor adjusts the time window to a sub-range (e.g. 10:00-14:00) and submits, **Then** the created type=4 dienst covers only the selected partial window.
3. **Given** "Deels overname" is checked, **When** the doctor sets a start time after the end time (invalid range), **Then** the form shows a validation error and prevents submission.
4. **Given** "Deels overname" is checked, **When** the doctor sets times outside the original shift boundaries, **Then** the form constrains the selection to the original shift's time range.

---

### User Story 3 - View Overname Proposals on the Calendar (Priority: P2)

All doctors in the waarneemgroep can see pending overname proposals overlaid on the calendar. These appear as ShiftBlock components with the `voorstelOvername` visual indicator (switch icon + orange question mark). Confirmed overnames display the `overname` indicator. Declined overnames with no replacement show the `vraagtekenOvername` indicator.

**Why this priority**: Visibility is essential for transparency but depends on proposals existing first (Story 1).

**Independent Test**: Create voorstel overname records in the database, load the /overnames page, and verify the overlay blocks appear with correct visual states.

**Acceptance Scenarios**:

1. **Given** a voorstel overname (type=4) exists for a shift, **When** any doctor in the waarneemgroep views the calendar, **Then** the shift block shows the `voorstelOvername` visual state overlaid on the original shift.
2. **Given** an accepted overname (type=6) exists, **When** any doctor views the calendar, **Then** the shift block shows the `overname` visual state.
3. **Given** a declined overname with no replacement, **When** any doctor views the calendar, **Then** the shift block shows the `vraagtekenOvername` visual state.

---

### User Story 4 - Receive and Respond to Overname Notifications (Priority: P2)

The target doctor (to whom the overname is proposed) sees a notification badge on the switch icon in the header. Clicking it opens the existing popover showing real pending proposals (replacing current dummy data). The doctor can accept or decline.

**Why this priority**: This completes the overname lifecycle but depends on proposals being created first.

**Independent Test**: Create a type=4 dienst targeting the logged-in doctor, verify the header badge appears with correct count, open the popover, and test accept/decline buttons.

**Acceptance Scenarios**:

1. **Given** a type=4 overname is proposed to the logged-in doctor, **When** the doctor views the header, **Then** the switch icon shows a notification badge with the count of pending proposals.
2. **Given** the doctor clicks the switch icon, **When** the popover opens, **Then** it shows the real pending overname details (date, time, proposing doctor, target doctor).
3. **Given** the doctor clicks "Accept" on a proposal, **When** the action completes, **Then** the dienst type changes from 4 to 6, and the calendar updates to show the `overname` state.
4. **Given** the doctor clicks "Decline" on a proposal, **When** the action completes, **Then** the dienst enters the `vraagtekenOvername` state, and the calendar updates accordingly.

---

### Edge Cases

- What happens when a doctor proposes an overname to a doctor who is already assigned to an overlapping shift? The system should warn the user but not block submission.
- What happens when an active proposal already exists for the same shift? The system should prevent creating a second proposal until the existing one is declined.
- What happens when the target doctor is the same as the proposing doctor? The system should prevent self-proposals.
- What happens when a partial overname time window results in uncovered gaps? The remaining time of the original shift stays with the original doctor.
- What happens when a shift spans midnight and a partial overname is proposed? The time pickers should handle overnight shifts correctly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow any doctor in the waarneemgroep to select an assigned shift (type=0) on the /overnames calendar to initiate an overname proposal.
- **FR-002**: System MUST display a modal with the shift details, a doctor selector (filtered to waarneemgroep members), and a submit button.
- **FR-003**: System MUST provide a "Deels overname" checkbox that reveals start/end time pickers bounded by the original shift's time range.
- **FR-004**: System MUST create a type=4 dienst record (status=pending) when a proposal is submitted, storing the target doctor in `iddeelnovern`, the time range, and a reference to the original shift via `iddienstovern`.
- **FR-005**: System MUST prevent proposals with invalid time ranges (start >= end, times outside original shift bounds).
- **FR-006**: System MUST prevent creating a new proposal for a shift that already has an active (pending) proposal. Only one active proposal per shift at a time.
- **FR-007**: System MUST prevent a doctor from proposing an overname to themselves.
- **FR-008**: System MUST display pending proposals (type=4) as `voorstelOvername` ShiftBlock overlays on the calendar for all waarneemgroep members.
- **FR-009**: System MUST show a notification badge on the header switch icon with the count of pending proposals for the logged-in doctor.
- **FR-010**: System MUST replace the header popover dummy data with real overname proposal data from the database.
- **FR-011**: System MUST allow the target doctor to accept a proposal, changing the dienst type from 4 to 6.
- **FR-012**: System MUST allow the target doctor to decline a proposal, setting the dienst status from `pending` to `declined` (type remains 4), which triggers the `vraagtekenOvername` visual state.
- **FR-013**: System MUST display accepted overnames (type=6) with the `overname` ShiftBlock visual state.
- **FR-014**: System MUST display declined overnames with the `vraagtekenOvername` ShiftBlock visual state.

### Key Entities

- **Overname Voorstel (type=4 dienst)**: A proposed shift takeover. Has a status field (`pending` or `declined`). Links a proposing doctor (`senderId`), a target doctor (`iddeelnovern`), and a time range (full or partial). References the original dienst via `iddienstovern`. Transitions to type=6 on acceptance; status changes to `declined` on decline.
- **Overname (type=6 dienst)**: A confirmed shift takeover. The accepting doctor is stored in `iddeelnovern`. References the original dienst via `iddienstovern`.
- **Original Dienst (type=0)**: The existing assigned shift that the overname refers to. Remains in place; the overname overlays it on the calendar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A doctor can propose a full or partial shift takeover in under 30 seconds (modal open to submission).
- **SC-002**: All waarneemgroep members see overname proposals on the calendar within 5 seconds of page load.
- **SC-003**: The target doctor sees a notification badge upon receiving a proposal (on next page load or refresh).
- **SC-004**: Accept/decline actions complete and update the calendar within 3 seconds.
- **SC-005**: 100% of invalid proposals (self-proposal, duplicate, invalid time range) are rejected with a clear user-facing error message.

## Assumptions

- Only doctors within the same waarneemgroep can be selected as overname targets.
- The existing header popover UI structure (navigation arrows, doctor display, accept/decline buttons) is reused — only the data source changes from dummy to real.
- Type=4 is used to mean "voorstel overname" and type=6 means "confirmed overname" in this feature context.
- The original shift remains visible on the calendar; the overname ShiftBlock overlays it (same position, higher z-index).
- The `vraagtekenOvername` state is a terminal state for now — re-proposing after decline is out of scope.
- Authentication and authorization use the existing Better Auth session; the logged-in user is the proposing doctor.
- The /overnames page calendar currently shows types [0, 1]; it will be extended to also fetch and display types 4 and 6.
