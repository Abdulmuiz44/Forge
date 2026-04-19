# Agents Guidance

## Repo Purpose
This Monorepo houses Forge: an open-source, local-first Native AI coding agent equipped with custom routing, testing, and multi-file interaction workflows. 

## Canonical Docs to Read First
1. `docs/PLAN.md`: Ground truth for vision and goals.
2. `docs/ARCHITECTURE.md`: High-level system interaction graph.

## Expectations for Agents
- When engaging with this repository, always align modifications with the core architecture laid out in `docs/ARCHITECTURE.md`.
- Be highly precise with modifications in `apps/desktop` vs crates. Do not mix system logic into pure UI implementations.

## Change Policy
- Feature work requires tests if extending Rust capabilities.
- UI changes require Tailwind adherence and Dark-mode-first CSS values.

## Safety Constraints
- Only interact with paths mapped in `.forge` or configured user directories.
- Ignore paths globally `.gitignore`'d when performing contextual parses.

## Architecture Rules
1. Never import `apps/desktop` Types into `forge-core` Rust crates (use sharing abstractions like schemas or protocol maps).
2. The UI shell must remain completely isolated from real file manipulation except through dedicated Tauri commands.
3. No fake backend mocked states in the React application except inside explicit `__mocks__` or test files.

## Definition of Done
- Feature is complete.
- Rust tests compiled and passing locally.
- UI elements verify successfully on `npm run dev` with no console errors.
- Visual integration has been user-reviewed.
