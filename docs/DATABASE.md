# Database

Cribbit CHAOS uses one shared PostgreSQL database.

The current foundation lives in `db/migrations/001_initial.sql`.

The schema uses internal UUIDs for users and maps Telegram/web provider identities through `user_identities`.

Core domains include:

- users
- user_identities
- rooms
- room_members
- game_sessions
- game_players
- game_commands
- game_events
- session_snapshots
- prompts
- answers
- saved decks
- house decks
- moderation
- recaps

The authoritative reducer is not enabled yet.
