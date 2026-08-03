# Wits & Wagers — local multiplayer

A phone-and-TV adaptation of the North Star Games party game, for people in the
same room. Phones are controllers; a laptop on the TV is the board.

## Game night

```bash
npm start
```

Open `/board` on the TV laptop. It shows a QR code that drops phones straight
into the lobby, with the address and room code alongside for anyone who would
rather type.

Everyone must be on the same Wi-Fi. No internet needed.

The board is normally opened on the laptop as `localhost`, which no phone can
reach, so it asks the server via `/api/net` for an address that is actually
routable. Candidates are ranked in `src/server/network.ts` — VPN tunnels,
Docker bridges and unleased `169.254.*` interfaces all show up in
`os.networkInterfaces()` and would each produce a URL that silently fails on
every phone in the room.

> **Plain HTTP is not a secure context.** Phones connect over
> `http://<lan-ip>:8787`, where browser APIs gated on secure contexts —
> `crypto.randomUUID`, `crypto.subtle`, service workers — are undefined.
> `localhost` *is* a secure context, so this never reproduces in development.
> `src/client/id.ts` exists for exactly this reason. Anything added to the
> client must be checked over the LAN IP, not just on localhost.

## Development

```bash
npm run dev
```

Vite on `:5173` with the game server on `:8787`. Other useful scripts:

```bash
npm test          # rules engine, 57 tests
npm run typecheck
```

## How it plays

Seven questions, each with a numeric answer. Everyone guesses in secret; the
guesses sort onto the betting mat; everyone places two chips on whichever slot
they think will win — **closest without going over**. Payouts follow the printed
board exactly:

| Slot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| | All Answers Too High | | | | | | | |
| **Pays** | 6:1 | 5:1 | 4:1 | 3:1 | **2:1** | 3:1 | 4:1 | 5:1 |

Guesses are centred on the mat, skipping the 2:1 centre when the count is even —
which reduces to `payout = 2 + distance from centre`. Winning bets are paid
stake × odds with the stake returned, and everyone whose guess landed in the
winning slot takes a 3-point bonus.

Both surfaces draw all eight slots, empty ones included. Seeing the full range
is part of reading the odds — a guess sitting on the 2:1 centre feels different
when the 5:1 wings beside it are visibly empty.

## What differs from the cardboard

- **Chips are points, not denominations.** The red/blue poker chips exist so a
  human banker can count. Each of your two chips still carries a free 1-point
  stake that is never lost, so nobody is knocked out.
- **Guesses stay attributed.** They are secret until the sort, then they carry
  names — betting on who you think knows sports is half the game.
- **No reader or banker role.** The board shows the question; scoring is
  automatic.
- **Timers are a backstop.** Rounds end the moment everyone is in. Default 45s
  to guess, 30s to bet, both host-configurable, and switchable off entirely.
- **Ties go to sudden death** rather than the rulebook's "youngest player wins".
- **More than seven unique guesses** cannot happen on cardboard (large groups are
  told to form seven teams). Here the closest pair merges into a shared slot.

## Layout

```
src/
├─ shared/   game logic — mat, scoring, phase machine. Pure, no I/O.
├─ server/   WebSocket adapter + room lifecycle
└─ client/   React: player/ is the phone, board/ is the TV
questions/   the question bank
```

`shared/` never imports from `server/` or `client/`. All the rules live there
and are unit-tested against the rulebook — including all four of its mat
diagrams and every row of its payout table — without a browser.

`Room` in `src/server/room.ts` takes a `send` callback and holds no transport
detail, so the same class backs the local WebSocket server and can move to
Cloudflare Durable Objects behind a different adapter.

## Question rotation

Two layers, guarding different things:

- **Per room** — a room never repeats a question. Tracked in game state and
  carried across restarts and rematches, so restarting mid-game does not hand
  back the question you just abandoned.
- **Across rooms** — every question drawn anywhere rests for 24 hours, so
  starting a fresh room after a game does not serve up what everyone just heard.

The 24-hour ledger is written to `.data/recent-questions.json` (gitignored).
It has to survive a process restart, since relaunching the server is exactly
when a new room gets started — the case it exists for. Delete the file to
un-retire everything.

Room uniqueness outranks the global rest period: hearing a question twice in
one sitting is far worse than hearing one that came up yesterday, so if the
only unused questions are resting ones, they get used anyway. Only a room that
has exhausted all 122 will repeat.

## Adding questions

Append to `questions/questions.json`. Answers must be numeric; `format` is one of
`plain`, `year`, `money`, `percent`, and an optional `note` shows on the reveal.

```json
{ "id": "x01", "category": "Science", "format": "plain",
  "text": "How many hearts does an octopus have?", "answer": 3,
  "note": "Two pump blood to the gills, one to the rest of the body." }
```

The server validates every answer is a real number at boot and will not start
otherwise. Questions do not repeat within a session.
