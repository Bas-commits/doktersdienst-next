# Data Model: Overname Feature

**Date**: 2026-03-29 | **Branch**: `002-overname-feature`

## Schema Changes

### diensten table — add `status` column

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| status | varchar(20) | YES | NULL | Overname lifecycle state: `'pending'`, `'declined'`, `'accepted'`. NULL for all non-overname records. |

**Migration**: Add column via Drizzle schema update + `drizzle-kit generate` + `drizzle-kit migrate`.

## Entity Definitions

### Overname Voorstel (type=4 dienst with status)

| Field | Source Column | Value | Description |
|-------|-------------|-------|-------------|
| type | type | 4 | Identifies as overname voorstel |
| status | status | `'pending'` or `'declined'` | Lifecycle state |
| target doctor | iddeelnovern | doctor ID | Who the overname is proposed to |
| original doctor | iddeelnemer | doctor ID | Who currently owns the shift |
| proposing doctor | senderId | doctor ID | Who created the proposal |
| original dienst | iddienstovern | dienst ID | Which shift is being taken over |
| time range | van, tot | Unix seconds | Full or partial shift time window |
| group | idwaarneemgroep | group ID | Same as original dienst |

### Overname (type=6 dienst with status='accepted')

| Field | Source Column | Value | Description |
|-------|-------------|-------|-------------|
| type | type | 6 | Confirmed overname |
| status | status | `'accepted'` | Lifecycle state |
| target doctor | iddeelnovern | doctor ID | Doctor who accepted the takeover |
| original doctor | iddeelnemer | doctor ID | Who originally owned the shift |
| original proposer | senderId | doctor ID | Who initiated the overname |
| original dienst | iddienstovern | dienst ID | Which shift was taken over |

## State Transitions

```
                    ┌─────────────────┐
   propose          │  type=4          │
   ──────────────▶  │  status=pending  │
                    └────────┬────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
              accept                decline
                  │                     │
                  ▼                     ▼
        ┌─────────────────┐   ┌─────────────────┐
        │  type=6          │   │  type=4          │
        │  status=accepted │   │  status=declined │
        └─────────────────┘   └─────────────────┘
              overname          vraagtekenOvername
```

## Discriminating Legacy vs Overname Records

| Record Type | type | status | iddienstovern | iddeelnovern |
|-------------|------|--------|---------------|--------------|
| Legacy Standaard | 4 or 6 | NULL | 0 | 0 |
| Overname Voorstel (pending) | 4 | `'pending'` | original dienst ID | target doctor ID |
| Overname Voorstel (declined) | 4 | `'declined'` | original dienst ID | target doctor ID |
| Confirmed Overname | 6 | `'accepted'` | original dienst ID | accepting doctor ID |

**Rule**: `status IS NOT NULL` → overname record. `status IS NULL` → legacy behavior.

## Uniqueness Constraint

Only one active (pending) proposal per original dienst at a time:

- Before creating a type=4 record, check: no existing `type=4, status='pending'` record with the same `iddienstovern` value.
- This is enforced at the application level (not a DB constraint), since the constraint is conditional.

## ShiftBlockView Extension

The `ShiftBlockView` type gains an optional field:

| Field | Type | Description |
|-------|------|-------------|
| overnameType | `'overname' \| 'voorstelOvername' \| 'vraagtekenOvername'` \| undefined | Set when the block represents an overname record |

This maps to the `overnameType` prop already added to the ShiftBlock component.
