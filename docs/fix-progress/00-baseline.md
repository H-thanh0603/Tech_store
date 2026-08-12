# Phase 0 Baseline

- **Branch/Commit:** `fix/production-readiness` (or currently checked out branch)
- **Test Results:** 
  - `type-check`: Passed (with warnings to fix later)
  - `lint`: Failed (22364 warnings/errors, mostly `@ts-ignore` and unused vars, to be fixed in later phase)
  - `Vitest`: 50 failed, 462 passed (mainly UI Next.js App Router context issues)
- **Migration Count (Local):** 25 migrations
- **Local Table Count:** (Assuming approx 31 based on plan)
- **Cloud Migration Count:** 4 migrations (as per audit)
- **Cloud Table Count:** 16 empty tables (as per audit)
- **Known P0/P1 Issues:** 
  - Migration divergence
  - Rate limiting cookie bypass
  - Reservation expiry logic defect
  - Non-atomic admin operations
  - JSON-LD XSS vulnerability
