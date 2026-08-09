# Database

The single PostgreSQL database foundation is in `db/migrations/001_initial.sql`. It uses internal UUIDs for users and maps Telegram/web providers through `user_identities`. It includes rooms, members, sessions, commands, events, snapshots-by-state, prompts, flags, answers, saved prompts, and recaps. The authoritative reducer is not enabled yet.
