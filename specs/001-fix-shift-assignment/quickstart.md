# Quickstart: Fix Shift Block Doctor Assignment

**Branch**: `001-fix-shift-assignment`

## Prerequisites

- Node.js (version compatible with Next.js 16)
- PostgreSQL database with existing schema
- `.env.local` with `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`

## Setup

```bash
# Install dependencies
npm install

# Install Vitest for unit tests (new dependency)
npm install -D vitest

# Install Playwright browsers (if not already done)
npx playwright install chromium
```

## Development

```bash
# Start dev server (required for e2e tests)
npm run dev

# Run unit tests
npx vitest run

# Run unit tests in watch mode
npx vitest

# Run e2e tests
npm run test:e2e

# Run e2e tests with UI
npm run test:e2e:ui
```

## Key Files

| File | Purpose |
|------|---------|
| `src/pages/api/diensten/assign.ts` | API handler for shift assignment |
| `src/hooks/useDienstenSchedule.ts` | Data transformation (diensten → ShiftBlockView) |
| `src/components/ShiftBlock/ShiftBlock.tsx` | Shift block UI component |
| `src/pages/rooster-maken-secretaris.tsx` | Secretary scheduler page |
| `src/types/diensten.ts` | TypeScript types |

## Test Files (to create)

| File | Purpose |
|------|---------|
| `src/hooks/__tests__/useDienstenSchedule.test.ts` | Unit tests for data transformation |
| `src/pages/api/diensten/__tests__/assign.test.ts` | Unit tests for assign API |
| `e2e/rooster-maken-secretaris.spec.ts` | E2E tests for full assignment flow |

## Test Database

Tests use the same database as development. E2E tests log in with the test user (`bartveltggdhvb@sivision.nl`) and clean up assignments after each test.
