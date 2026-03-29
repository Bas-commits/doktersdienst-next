# Quickstart: Overname Feature

## Prerequisites

- PostgreSQL database running with existing schema
- Node.js with `npm install` completed
- Dev server: `npm run dev` (runs on port 3005)

## Database Migration

1. Add `status` column to diensten table in `drizzle/schema.ts`
2. Run `npx drizzle-kit generate` to create migration
3. Run `npx drizzle-kit migrate` to apply

## Key Files to Modify

| File | Change |
|------|--------|
| `drizzle/schema.ts` | Add `status` column to diensten |
| `src/types/diensten.ts` | Add `overnameType` to `ShiftBlockView` |
| `src/hooks/useDienstenSchedule.ts` | Handle overname records in transformation |
| `src/pages/overnames.tsx` | Add click handler, modal, fetch types 4/6 |
| `src/components/header/DoktersdienstHeader.tsx` | Replace dummy data with real API |
| `src/components/ShiftBlock/ShiftBlock.tsx` | Already done (overnameType prop) |

## New Files to Create

| File | Purpose |
|------|---------|
| `src/pages/api/overnames/propose.ts` | Create overname voorstel |
| `src/pages/api/overnames/respond.ts` | Accept/decline overname |
| `src/pages/api/overnames/pending.ts` | Fetch pending proposals for header |
| `src/components/OvernameModal.tsx` | Proposal modal component |

## Testing

- `npm test` — unit tests
- `npm run lint` — lint check
- Storybook: `npx storybook dev` — verify ShiftBlock overname stories
- Manual: navigate to localhost:3005/overnames
