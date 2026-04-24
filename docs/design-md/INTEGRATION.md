# DESIGN.md Integration (Google design.md)

This repository vendors the upstream Google `design.md` project so Codra has a local, versioned design-system reference.

## Installed Sources

- Upstream README: `docs/design-md/README.upstream.md`
- Upstream spec: `docs/design-md/spec.md`
- Upstream examples: `docs/design-md/examples/*`
- Upstream license: `docs/design-md/LICENSE`

## Project-Level Design Brain

- Canonical local design system: `DESIGN.md` at repository root.
- Codra tooling can parse this file and surface tokens/rationale in desktop context panels.

## Commands

Run from repository root:

```bash
pnpm run design:lint
pnpm run design:spec
pnpm run design:export:tailwind
pnpm run design:export:dtcg
```

## Refresh Upstream Snapshot

To update vendored docs/examples:

```bash
git clone --depth 1 https://github.com/google-labs-code/design.md.git .tmp/design-md-upstream
```

Then copy updated `README.md`, `docs/spec.md`, and `examples/` into `docs/design-md/`.
