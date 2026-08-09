# Telegram setup

The Telegram adapter calls `ready`, expands the app, tracks viewport and safe-area changes, supports fullscreen, BackButton, close confirmation, haptics, start parameters, and raw `initData`. `initDataUnsafe` is display-only and is never an authentication credential. The API validates raw initData before issuing a session.
