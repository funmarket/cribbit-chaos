# Architecture lock

```text
Telegram Mini App (Vercel) ----\
                                > Railway API + Socket.IO ---> Railway PostgreSQL
Web App (Vercel) --------------/
                 |
                 +---- shared TypeScript UI/contracts/game engine
```

## Non-negotiable boundaries

1. The web and Telegram clients share rules, UI packages and backend contracts.
2. Both clients use the same Railway API and same PostgreSQL database.
3. PostgreSQL is never reachable directly from browser code.
4. Telegram `initDataUnsafe` is display-only. Raw `initData` is validated on Railway before identity is trusted.
5. Telegram user IDs are provider identities linked to an internal Cribbit user UUID; they are not primary game-domain IDs.
6. Game state is server-authoritative: turn, hands, deck/discard, legal play, prompt selection, Nope windows, winner and revision.
7. Every mutating game command has `commandId` + `expectedRevision`; retries must be idempotent.
8. Roulette is presentation. Prompt/effect selection exists before animation starts.
9. Pass, Rewind, Nope and Flag remain different commands/code paths.
10. Client-only layout/navigation buttons are explicitly classified and never receive fake backend endpoints.

## Deployment units

- Vercel project 1: `apps/web`
- Vercel project 2: `apps/telegram`
- Railway service: `apps/server`
- Railway PostgreSQL service

## Migration sequence

1. Preserve V4 compatibility runtime.
2. Define complete action/backend ownership map.
3. Establish Telegram auth + platform adapter + Vercel/Railway boundaries.
4. Extract card/deck/session model to `packages/game-engine`.
5. Extract START/PLAY/DRAW/WILD/classic effects with deterministic tests.
6. Extract social flows + safety + reaction windows.
7. Add PostgreSQL transaction/idempotency repository.
8. Enable remote authoritative commands.
9. Remove legacy runtime.
