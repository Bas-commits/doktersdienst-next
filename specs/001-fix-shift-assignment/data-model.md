# Data Model: Fix Shift Block Doctor Assignment

**Branch**: `001-fix-shift-assignment` | **Date**: 2026-03-29

## Entities

### Dienst (Shift Record)

The central entity. Each row in the `diensten` table represents either a time slot definition or a doctor assignment.

| Field | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-increment primary key |
| idwaarneemgroep | integer | Which doctor group this shift belongs to |
| idpraktijk | integer | Practice/clinic ID (copied from base slot) |
| van | bigint | Shift start time (Unix seconds) |
| tot | bigint | Shift end time (Unix seconds) |
| iddeelnemer | integer | Doctor ID (0 = unassigned for type=1 base slots) |
| type | integer | Category code (see Type System below) |
| idshift | integer | Shift template ID (copied from base slot) |
| currentDate | date | Calendar date for shift start ("YYYY-MM-DD") |
| nextDate | date | Calendar date for shift end ("YYYY-MM-DD") |

**Index**: `diensten_list_idx` on (idwaarneemgroep, van, tot)

### Type System (Assignment Context)

| Type | Name | UI Position | Matching Strategy |
|------|------|-------------|-------------------|
| 1 | Base Slot | N/A (anchor) | Exact match on (van, tot, idwaarneemgroep) |
| 0 | Standaard | Middle stripe | Exact match first, then interval overlap |
| 4 | Standaard (legacy) | Middle stripe | Same as type 0 |
| 6 | Standaard (legacy) | Middle stripe | Same as type 0 |
| 5 | Achterwacht | Top stripe | Exact match on (van, tot, idwaarneemgroep) |
| 11 | Extra Dokter | Bottom stripe | Exact match on (van, tot, idwaarneemgroep) |

### ShiftBlockView (UI Model)

Derived from diensten records. One ShiftBlockView per type=1 base slot, with three optional doctor slots:

| Field | Source |
|-------|--------|
| middle: DoctorInfo | null | From type 0/4/6 records (same group, exact or overlapping time) |
| top: DoctorInfo | null | From type 5 record (same group, exact time) |
| bottom: DoctorInfo | null | From type 11 record (same group, exact time) |

### DoctorInfo (Display Model)

| Field | Source |
|-------|--------|
| id | diensten_deelnemers.id |
| name | "{voornaam} {achternaam}" |
| shortName | First letter of voornaam + first letter of achternaam |
| color | diensten_deelnemers.color (hex string) |

## State Transitions

### Assignment Lifecycle

```
Empty Slot (type=1 only)
  │
  ├─ Assign doctor → INSERT new record (type=0/5/11)
  │                   Copy idpraktijk, idshift, dates from type=1
  │
  ├─ Reassign doctor → UPDATE existing record's iddeelnemer
  │
  └─ Unassign doctor → DELETE assignment record
                        Type=1 base slot is never modified
```

### Matching Rules

- **Middle (Standaard)**: Assign uses exact match first, falls back to interval overlap. Unassign uses overlap to find all matching type 0/4/6 records.
- **Top (Achterwacht)**: Exact match on (van, tot, idwaarneemgroep, type=5).
- **Bottom (Extra Dokter)**: Exact match on (van, tot, idwaarneemgroep, type=11).

## Relationships

```
diensten.iddeelnemer → deelnemers.id (doctor)
diensten.idwaarneemgroep → waarneemgroepen.ID (doctor group)
diensten.idpraktijk → praktijken.id (practice)
```

## Validation Rules

- A shift block can have at most one doctor per stripe (one type=0/4/6, one type=5, one type=11).
- The type=1 base slot must exist before assignment records can be created (provides idpraktijk, idshift, dates).
- van < tot (shift start must be before shift end).
- iddeelnemer must reference a valid deelnemers record.
- idwaarneemgroep must reference a valid waarneemgroepen record.
