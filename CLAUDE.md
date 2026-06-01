# HE Industry Tracker — Claude Code Guidelines

## Database schema changes

Whenever `src/db/schema.ts` is modified (tables added, columns added/removed/renamed, constraints changed), update `docs/DATABASE.md` to reflect the change before committing. The doc is the human-readable source of truth for the database structure.
