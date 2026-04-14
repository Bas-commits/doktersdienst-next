<!--
  Sync Impact Report
  ===================
  Version change: 0.0.0 (template) → 1.0.0
  Modified principles: N/A (initial population from template)
  Added sections:
    - Core Principles (5 principles populated)
    - Domain Model: Diensten Type System (new section)
    - Development Workflow (new section)
    - Governance (populated)
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no changes needed (generic)
    - .specify/templates/spec-template.md ✅ no changes needed (generic)
    - .specify/templates/tasks-template.md ✅ no changes needed (generic)
    - .specify/templates/commands/*.md — no command files exist
  Follow-up TODOs: None
-->

# Doktersdienst-Next Constitution

## Core Principles

### I. Diensten Type System Integrity

The `diensten` table is the central data model. Every feature that
reads or writes diensten MUST respect the type system exactly:

- **Type 1** — Base slot. Defines shift time boundaries (van/tot).
  Every shift MUST have a type=1 record. `iddeelnemer=0` when
  unassigned.
- **Type 0 (also legacy 4, 6)** — Standaard (regular doctor)
  assignment. Rendered in the middle stripe. Legacy types 4 and 6
  MUST be treated identically to type 0 when reading.
- **Type 5** — Achterwacht (on-call/backup doctor). Rendered in the
  top stripe. At most one per time slot.
- **Type 11 (assignment context)** — Extra Dokter. Rendered in the
  bottom stripe. At most one per time slot.
- **Types 2, 3, 9, 10, 5001** — Voorkeuren (preferences). These
  are doctor availability preferences, NOT assignments:
  - **2** = Liever niet (would rather not)
  - **3** = Liever wel (prefer to work)
  - **9** = Vakantie (vacation)
  - **10** = Nascholing (professional education)
  - **5001** = FTE adjustment
- **Type 4 (overname context)** — Overname Voorstel (shift takeover
  proposal). Discriminated from legacy type=4 by `status IS NOT NULL`.
  Uses `iddienstovern` to reference original dienst and `iddeelnovern`
  for the target doctor. Status: `pending` or `declined`.
- **Type 6 (overname context)** — Confirmed Overname. Discriminated
  from legacy type=6 by `status = 'accepted'`. Same column usage
  as type=4 overname.

Type 9 is reserved for "Vakantie" preference rows. Extra Dokter
assignments use type 11.

**Rationale**: Misinterpreting a dienst type leads to doctors being
double-booked, preferences being silently dropped, or UI rendering
incorrect shift blocks. This type system is inherited from the
legacy PHP system and MUST be preserved for data compatibility.

### II. Legacy Compatibility

The application migrates from a legacy PHP system. Data created by
the legacy system MUST render and behave correctly:

- Types 4 and 6 MUST be accepted as Standaard assignments.
- Type 11 MUST be merged into the bottom stripe when rendering.
- Standaard assignments MAY span wider intervals than the type=1
  slot; matching MUST use interval overlap, not exact match.
- Unix-second timestamps in `van` and `tot` MUST be preserved;
  no conversion to milliseconds or other formats in the database.

### III. Three-Stripe Shift Block Model

Every shift block in the UI consists of three visual stripes:

```
┌─────────────────┐
│  top stripe     │  ← Achterwacht (type 5)
├─────────────────┤
│  middle stripe  │  ← Standaard (types 0, 4, 6)
├─────────────────┤
│  bottom stripe  │  ← Extra Dokter (types 9, 11)
└─────────────────┘
```

Each stripe allows at most one assigned doctor. The base type=1
record anchors the slot. All UI features that display shifts MUST
use this three-stripe layout.

### IV. Preference-Assignment Separation

Preferences (voorkeuren) and assignments are fundamentally
different concepts and MUST NOT be conflated:

- Preferences express doctor availability/wishes. They do NOT
  guarantee or prevent assignment.
- Assignments are the actual scheduled doctors for a shift.
- A doctor MAY have a "Liever niet" preference AND still be
  assigned to that shift.
- The unique index enforces at most one preference per
  (slot, user). Attempting to add a second preference MUST
  replace or fail, not silently duplicate.

### V. Next.js Pages Router + Drizzle ORM Stack

- The application uses Next.js with the Pages Router (not App
  Router). New pages MUST use the Pages Router pattern.
- Database access uses Drizzle ORM with PostgreSQL. Schema
  changes MUST go through Drizzle migrations.
- UI components MAY use Storybook for isolated development.
- Authentication uses better-auth.

## Domain Model: Diensten Type System

This section provides the authoritative reference for dienst types.
All code that queries, inserts, or updates diensten MUST consult
this table:

| Type | Name | Category | UI Position | Notes |
|------|------|----------|-------------|-------|
| 1 | Base Slot | Slot | N/A | Defines time boundaries |
| 0 | Standaard | Assignment | Middle | Regular doctor |
| 4 | Standaard (legacy) / Overname Voorstel | Assignment / Overname | Middle / Overlay | Legacy PHP (status=NULL) or overname voorstel (status=pending/declined) |
| 6 | Standaard (legacy) / Overname Bevestigd | Assignment / Overname | Middle / Overlay | Legacy PHP (status=NULL) or confirmed overname (status=accepted) |
| 5 | Achterwacht | Assignment | Top | On-call doctor |
| 11 | Extra Dokter | Assignment | Bottom | Additional doctor |
| 2 | Liever niet | Preference | Chip | Would rather not |
| 3 | Liever wel | Preference | Chip | Prefer to work |
| 9 | Vakantie | Preference | Chip | Vacation |
| 10 | Nascholing | Preference | Chip | Education/training |
| 5001 | FTE | Preference | Chip | FTE adjustment |
| 4 | Overname Voorstel | Overname | Overlay | status=pending or declined; uses iddienstovern + iddeelnovern |
| 8 | Taak | Task | N/A | Legacy task type |

**Note on type 4 dual meaning**: Context (regular assignment vs
overname) determines interpretation. Code MUST use `status` and
query context to disambiguate.

## Development Workflow

- Features MUST be specified via the speckit workflow before
  implementation (spec → plan → tasks → implement).
- Database schema changes MUST use `drizzle-kit generate` and
  `drizzle-kit migrate`.
- The dev server runs on port 3005 (`next dev -p 3005`).

## Governance

This constitution is the authoritative source for project
principles and domain model rules. All feature specs, plans,
and implementations MUST comply.

- **Amendments**: Any change to principles or the diensten type
  table MUST be documented with a version bump and rationale.
- **Versioning**: MAJOR for principle removals/redefinitions,
  MINOR for additions/expansions, PATCH for clarifications.
- **Compliance**: Feature specs MUST reference relevant principles.
  Code reviews MUST verify diensten type usage matches this
  constitution.

**Version**: 1.0.0 | **Ratified**: 2026-03-29 | **Last Amended**: 2026-03-29
