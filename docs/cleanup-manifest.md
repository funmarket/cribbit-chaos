# Cleanup Manifest

This manifest classifies the repository cleanup targets that were present before the repository cleanup pass.

No entry below is marked `UNKNOWN`.

## Summary

- Historical production copies scheduled for deletion: `typescript/`, `webappchaos/`, `telegramchaos/`
- Empty legacy reference folder scheduled for deletion: `reference/legacy-migration/`
- Duplicate setup docs scheduled for deletion after folding useful content into canonical docs
- One useful reference file retained: `reference/approved-v4-template.html`

## Manifest

| Path | Classification | Equivalent production path | Imported by production code | package.json | tsconfig | Vite | CI | Docs | Unique code not elsewhere | Decision | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `typescript/` | `DUPLICATE_REFERENCE` | `apps/`, `packages/`, `db/`, `docs/`, `scripts/`, `.github/` | No | No | No | No | No | No | No | Delete | Historical migration archive fully superseded by the production monorepo and git history already preserves it. |
| `webappchaos/` | `OBSOLETE` | None | No | No | No | No | No | No | No | Delete | Empty legacy project shell with no production use. |
| `telegramchaos/` | `OBSOLETE` | None | No | No | No | No | No | No | No | Delete | Empty legacy project shell with no production use. |
| `reference/legacy-migration/` | `OBSOLETE` | `reference/approved-v4-template.html` | No | No | No | No | No | No | No | Delete | Empty placeholder folder after the useful reference asset was canonicalized elsewhere. |
| `docs/VERCEL_SETUP.md` | `DUPLICATE_REFERENCE` | `docs/DEPLOYMENT.md`, `README.md` | No | No | No | No | No | Yes | No | Delete | Its useful deployment notes were folded into the canonical deployment documentation. |
| `docs/RAILWAY_SETUP.md` | `DUPLICATE_REFERENCE` | `docs/DEPLOYMENT.md`, `docs/TESTING.md`, `README.md` | No | No | No | No | No | Yes | No | Delete | Its useful deployment notes were folded into the canonical deployment documentation. |
| `docs/TELEGRAM_SETUP.md` | `DUPLICATE_REFERENCE` | `docs/TELEGRAM.md`, `README.md` | No | No | No | No | No | Yes | No | Delete | Its useful Telegram security notes were folded into the canonical Telegram documentation. |
| `docs/GITHUB_SETUP.md` | `OBSOLETE` | `README.md`, `PLAN.md` | No | No | No | No | No | Yes | No | Delete | GitHub workflow guidance is now captured in the root governance docs and branch/PR workflow. |
| `docs/preflight-audit.md` | `OBSOLETE` | `README.md`, `PLAN.md` | No | No | No | No | No | Yes | No | Delete | Superseded by the final repository status in the root docs and commit history. |
| `docs/button-audit.md` | `DUPLICATE_REFERENCE` | `docs/BUTTON_MAP.md`, `docs/button-audit.json` | No | No | No | No | No | Yes | No | Delete | Replaced by the canonical button map doc while preserving the machine-readable audit JSON. |
| `reference/approved-v4-template.html` | `UNIQUE_REFERENCE` | None | No | No | No | No | No | No | Yes | Retain | Useful visual reference for the approved V4 design baseline. |
