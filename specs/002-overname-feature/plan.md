# Implementation Plan: Overname (Shift Takeover)

**Branch**: `002-overname-feature` | **Date**: 2026-03-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-overname-feature/spec.md`

## Summary

Build the overname (shift takeover) feature: doctors can propose full or partial shift takeovers to other doctors in their waarneemgroep. Proposals are stored as type=4 diensten with a new `status` column. Target doctors receive notifications in the header and can accept (→ type=6) or decline (→ status=declined). All states are visible on the /overnames calendar via ShiftBlock overlays using the `overnameType` prop.

## Technical Context

**Language/Version**: TypeScript 5 on Node.js (Next.js 16.1.6, Pages Router) + React 19
**Primary Dependencies**: Drizzle ORM 0.45.1, Better Auth 1.5.4, Tailwind CSS 4, react-icons
**Storage**: PostgreSQL via Drizzle ORM (diensten table + new `status` column)
**Testing**: Vitest (unit), Playwright (e2e), Storybook (component)
**Target Platform**: Web (desktop browsers)
**Project Type**: Web application (Next.js Pages Router)
**Performance Goals**: Page load < 5s, API responses < 3s (per success criteria)
**Constraints**: Must preserve legacy type 4/6 records (discriminated by `status IS NULL`)
**Scale/Scope**: Single waarneemgroep at a time, ~50 doctors max per group

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Diensten Type System Integrity | PASS | Type 4 repurposed for overname (as planned in constitution). Legacy type 4/6 discriminated by `status IS NULL`. |
| II. Legacy Compatibility | PASS | Legacy type 4/6 records with `status = NULL` continue to render as middle stripe. No existing behavior broken. |
| III. Three-Stripe Shift Block Model | PASS | Overname blocks are overlays on existing shift blocks, not new stripes. Uses `overnameType` prop on ShiftBlock. |
| IV. Preference-Assignment Separation | PASS | Overname is a new category (not preference, not standard assignment). Clearly separated via type + status. |
| V. Next.js Pages Router + Drizzle ORM Stack | PASS | All new routes use Pages Router API pattern. Schema change via Drizzle migration. |

No violations. Complexity Tracking section not needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-overname-feature/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Research decisions
├── data-model.md        # Entity definitions and state transitions
├── quickstart.md        # Development quickstart
├── contracts/
│   └── api-overnames.md # API endpoint contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── pages/
│   ├── overnames.tsx                    # MODIFY: add click handler, modal, fetch types 4/6
│   └── api/
│       └── overnames/
│           ├── propose.ts               # NEW: create overname voorstel
│           ├── respond.ts               # NEW: accept/decline overname
│           └── pending.ts               # NEW: fetch pending for header
├── components/
│   ├── OvernameModal.tsx                # NEW: proposal modal
│   ├── ShiftBlock/
│   │   └── ShiftBlock.tsx              # ALREADY DONE: overnameType prop
│   └── header/
│       └── DoktersdienstHeader.tsx      # MODIFY: replace dummy data
├── hooks/
│   └── useDienstenSchedule.ts           # MODIFY: handle overname in transformation
└── types/
    └── diensten.ts                      # MODIFY: add overnameType to ShiftBlockView

drizzle/
└── schema.ts                            # MODIFY: add status column to diensten
```

**Structure Decision**: Follows existing Next.js Pages Router structure. New API routes under `api/overnames/` namespace. New modal as standalone component.
