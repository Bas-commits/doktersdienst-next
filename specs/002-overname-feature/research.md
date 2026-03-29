# Research: Overname Feature

**Date**: 2026-03-29 | **Branch**: `002-overname-feature`

## Decision 1: Distinguishing overname records from legacy type 4/6

**Decision**: Use the new `status` column as the discriminator. Legacy type=4/6 records will have `status = NULL`. New overname voorstel records will have `status = 'pending'` or `'declined'`. When accepted, type changes to 6 and status becomes `'accepted'`.

**Rationale**: The status column is being added specifically for overname state tracking. A NULL status clearly identifies legacy records. No existing code sets a status, so there's zero risk of collision.

**Alternatives considered**:
- Using `idshift > 0` as discriminator: Rejected because `idshift` may already have non-zero values in legacy data.
- Adding a boolean `is_overname` column: Unnecessary since status already implies it.

## Decision 2: Linking overname to original dienst

**Decision**: Use `iddienstovern` column to store the original dienst's ID, and `iddeelnovern` to store the target doctor's ID.

**Rationale**: These columns are purpose-built for the overname feature from the legacy PHP system. Using them preserves semantic clarity and avoids overloading `idshift` or `iddeelnemer` with overname-specific meaning.

**Alternatives considered**:
- Using `idshift`: Initially considered but rejected — `idshift` has its own meaning and may have non-zero values in legacy data.
- Using `iddeelnemer` for target doctor: Rejected — `iddeelnemer` represents the assigned doctor, which for an overname voorstel is ambiguous.

## Decision 3: Storing the target doctor and proposing doctor

**Decision**: Use `iddeelnovern` to store the target doctor (the one being proposed to). Use `senderId` to store the proposing doctor (who initiated the overname). `iddeelnemer` stores the original shift's doctor (the one whose shift is being taken over).

**Rationale**: `iddeelnovern` literally means "deelnemer overname" — the doctor involved in the overname. `senderId` already exists and semantically represents "who initiated this." `iddeelnemer` preserves the link to who originally owns the shift.

## Decision 4: Schema migration — adding status column

**Decision**: Add `status` column to diensten table as `varchar(20)`, nullable, default `NULL`.

**Rationale**: Keeps legacy records unaffected (NULL = not an overname). Values: `'pending'`, `'declined'`, `'accepted'`. VARCHAR(20) is sufficient and explicit.

## Decision 5: useDienstenSchedule transformation changes

**Decision**: Modify `dienstenToShiftBlocks()` to handle overname records differently:
- type=4 with `status = 'pending'` → separate overlay block with `overnameType: 'voorstelOvername'`
- type=4 with `status = 'declined'` → overlay block with `overnameType: 'vraagtekenOvername'`
- type=6 with `status = 'accepted'` → overlay block with `overnameType: 'overname'`
- type=4/6 with `status = NULL` → legacy behavior (middle stripe, same as type=0)

Uses `iddienstovern` to look up the original dienst for overlay positioning.

**Rationale**: This preserves backward compatibility while extending the ShiftBlockView to carry overname state.

## Decision 6: API routes structure

**Decision**: Create dedicated overname API routes:
- `POST /api/overnames/propose` — Create voorstel (type=4, status=pending)
- `POST /api/overnames/respond` — Accept or decline (type→6 or status→declined)
- `GET /api/overnames/pending` — Fetch pending proposals for the logged-in doctor (for header badge)

**Rationale**: Separate from `/api/diensten` to keep concerns clean. The existing `/api/diensten` GET endpoint already supports `typeIn` filtering, so calendar data can still come from there.

## Decision 7: Header popover data source

**Decision**: Replace `DUMMY_VERZOEKEN` with real data fetched from `/api/overnames/pending`. The existing `OvernameVerzoek` interface structure maps closely to the data we'll return.

**Rationale**: Minimal UI changes — the popover structure already displays the right fields.
