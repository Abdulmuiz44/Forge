# Agents Guidance

## Repo Purpose
This Monorepo houses Codra: an open-source, local-first Native AI coding agent equipped with custom routing, testing, and multi-file interaction workflows. 

## Canonical Docs to Read First
1. `docs/PLAN.md`: Ground truth for vision and goals.
2. `docs/ARCHITECTURE.md`: High-level system interaction graph.
3. `DESIGN.md`: Canonical design system tokens and rationale for UI/design work.

## Expectations for Agents
- When engaging with this repository, always align modifications with the core architecture laid out in `docs/ARCHITECTURE.md`.
- Be highly precise with modifications in `apps/desktop` vs crates. Do not mix system logic into pure UI implementations.
- For any design, UX, styling, component, layout, or visual-system task, read and apply `DESIGN.md` before making changes.

## Change Policy
- Feature work requires tests if extending Rust capabilities.
- UI changes require Tailwind adherence and Dark-mode-first CSS values.
- UI/design decisions must follow `DESIGN.md` tokens and rationale unless the user explicitly asks to deviate.

## Safety Constraints
- Only interact with paths mapped in `.codra` or configured user directories.
- Ignore paths globally `.gitignore`'d when performing contextual parses.

## Architecture Rules
1. Never import `apps/desktop` Types into `codra-core` Rust crates (use sharing abstractions like schemas or protocol maps).
2. The UI shell must remain completely isolated from real file manipulation except through dedicated Tauri commands.
3. No fake backend mocked states in the React application except inside explicit `__mocks__` or test files.

## Definition of Done
- Feature is complete.
- Rust tests compiled and passing locally.
- UI elements verify successfully on `npm run dev` with no console errors.
- Visual integration has been user-reviewed.
