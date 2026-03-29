# Research: Fix Shift Block Doctor Assignment

**Branch**: `001-fix-shift-assignment` | **Date**: 2026-03-29

## R-001: Unit Testing Framework

**Decision**: Add Vitest as the unit testing framework.

**Rationale**: The project currently only has Playwright for e2e tests. Vitest is the best fit because:
- Native TypeScript support without additional config
- Compatible with the existing Next.js/React setup
- Fast execution with watch mode
- Can test pure functions (like `dienstenToShiftBlocks`) and API handlers directly

**Alternatives considered**:
- Jest: Heavier setup, slower, requires ts-jest or babel config
- Playwright component testing: Overkill for testing pure transformation functions and API logic

## R-002: Testing the Assign API

**Decision**: Test the assign API handler directly by mocking the Drizzle ORM transaction.

**Rationale**: The assign.ts handler uses `db.transaction()` with Drizzle ORM. For unit tests:
- Mock the `db` module to intercept transaction calls
- Verify the correct SQL operations (select, insert, update, delete) are called with correct parameters
- Test each section (middle/top/bottom) × operation (assign/reassign/unassign) combination

For e2e tests:
- Call the actual API endpoint via Playwright and verify database state via a test-only query endpoint or direct DB connection

**Alternatives considered**:
- Integration tests with real database: Valuable but requires test database setup; better suited for e2e tests
- Testing via HTTP client only: Misses internal logic verification

## R-003: Testing `dienstenToShiftBlocks` Transformation

**Decision**: Test the pure function directly with synthetic input data.

**Rationale**: `dienstenToShiftBlocks` is a pure function that transforms API responses into UI models. It can be tested without any mocking by constructing `DienstenResponse` objects with known diensten records and asserting the resulting `ShiftBlockView[]`.

Key test scenarios:
- Type 0/4/6 → middle stripe
- Type 5 → top stripe
- Type 9/11 → bottom stripe
- Overlap matching for legacy wide Standaard rows
- Missing base (type=1) record → block skipped
- All three stripes populated simultaneously

## R-004: E2E Test Strategy for Shift Assignment

**Decision**: Use Playwright to test the full assignment flow on the `/rooster-maken-secretaris` page.

**Rationale**: E2E tests will:
1. Log in as a secretary/admin user
2. Navigate to `/rooster-maken-secretaris`
3. Select a doctor from the sidebar
4. Click on specific stripes (top/middle/bottom) of shift blocks
5. Wait for API response (`/api/diensten/assign`)
6. Verify UI updates (doctor initials appear in correct stripe)
7. Reload page and verify persistence

**Database verification**: Use a dedicated API endpoint or direct fetch to `/api/diensten` with type filters to verify the correct records exist after assignment.

## R-005: Test Data Identification

**Decision**: Use existing test user credentials and real database shifts.

**Rationale**: The existing e2e tests already use `bartveltggdhvb@sivision.nl` as the test user. The `/rooster-maken-secretaris` page requires authentication and an active waarneemgroep. Tests should:
- Use the same login flow as existing e2e tests
- Target shift blocks in the current month (dynamic, always available)
- Clean up after tests by unassigning any doctors that were assigned during the test

## R-006: Potential Bug Areas Identified

Based on code analysis, these areas are likely sources of the reported issues:

1. **Middle section overlap matching inconsistency**: The assign API uses overlap matching for middle unassign but tries exact match first for assign. If the existing record has different van/tot than the type=1 slot (legacy wide row), the exact match fails and falls through to overlap — but the overlap match may find a different row.

2. **Missing base record handling**: If no type=1 base record exists, the `base` variable is undefined. The insert still proceeds but with null values for `idpraktijk`, `idshift`, `currentDate`, `nextDate`. This may cause issues downstream.

3. **Type 11 not handled in assign API**: The bottom section only matches type=9 for unassign, but `dienstenToShiftBlocks` also shows type=11 in the bottom stripe. If a user tries to unassign a type=11 bottom entry via the UI, it won't find the record.

4. **Data transformation grouping**: `dienstenToShiftBlocks` groups by exact `van-tot` key. If a type=5 or type=9 record has slightly different van/tot from the type=1 base (e.g., off by a second), it won't be grouped together and will be lost.
