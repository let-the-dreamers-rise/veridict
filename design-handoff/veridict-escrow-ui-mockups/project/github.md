repo: let-the-dreamers-rise/veridict
branch: main

## Last sync

date: 2026-08-22T19:09:26Z

### Updated in this project

- Built a six-screen clickable UI mockup of Veridict on the Broadsheet design system.
- All hashes, addresses, amounts and scores come from `deployments/preprod*.json` — no invented chain data.
- Added an alternate-directions board: three landing heroes, three bounty-board treatments.

## Screen map

| Screen | Built from |
|---|---|
| Landing (front page) | `README.md`, `apps/web/src/app/page.tsx`, `deployments/preprod-oracle.json` |
| Bounty board | `apps/web/src/app/board/page.tsx`, `apps/web/src/lib/datum.ts`, `deployments/preprod.json` |
| Post a bounty | `apps/web/src/app/create/page.tsx`, `packages/verdict/src/compiler.ts` |
| Bounty detail | `packages/verdict/src/evaluator.ts` (criterion kinds), `deployments/preprod-oracle.json` (failing lifecycle) |
| Verify | `apps/web/src/app/verify/page.tsx`, `apps/web/src/lib/verify.ts`, `apps/web/src/lib/config.ts` |
| Submit work | `README.md` (commit-reveal), `apps/web/src/app/board/page.tsx` |

Screens live in `Veridict.dc.html`; alternates in `Veridict Directions.dc.html`.
