# ExerciseFolks prototype

A clickable PWA prototype of ExerciseFolks, a cosy social fitness game for small private
friend groups. Static files only (served by GitHub Pages at `/exercisefolks/`). All data is
kept in the browser's localStorage, in tables that mirror the planned Supabase schema
(`users`, `groups`, `group_members`, `availability_blocks`, `sessions`,
`session_participants`, `workouts`, `points_ledger`, `placed_items`, `vouchers`,
`redemptions`). Balances are always summed from `points_ledger`.

## Testing with three people on one phone
1. Onboard, then pick **Start with demo friends** (Wei Ling and Michelle, with sample free hours).
2. Mark your free hours in **Plan → My week**, then invite from **Find a time**.
3. Tap your avatar (top right) to switch to each friend and accept.
4. **Me → Admin panel → Jump to next session** moves the test clock to the session start.
5. Check in as each person. When everyone who accepted checks in within 2 hours, all get 2x.

## Points rules
- minutes × intensity (Light 1x, Moderate 2x, Vigorous 3x)
- Buddy bonus 2x when 2+ people check in within 2h of start and nobody who accepted is missing
- Micro-workouts: 5–15 min, solo, same formula, no bonus
- Goal 2 workouts a week; streaks count weeks; crunch weeks (2 a month) pause the streak

## Not in the prototype
Real accounts and cross-device sync, Google Calendar import, push notifications while the
app is closed, and emailed reminders all need the Supabase + server build.
