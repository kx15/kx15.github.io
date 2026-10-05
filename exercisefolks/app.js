// ExerciseFolks: clickable prototype.
// Everything lives in this browser's localStorage, in tables shaped like the
// planned Supabase schema, so the logic can move to a real backend later.
(function () {
  'use strict';
  const { VILLAGE_ITEMS, LEVELS, villageSVG, itemIcon } = window.EFArt;

  // ------------------------------------------------------------------
  // Constants
  // ------------------------------------------------------------------
  const DB_KEY = 'exercisefolks-v1';
  const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const CHECKIN_OPENS = 30 * MIN;      // check-in opens 30 min before start
  const BONUS_WINDOW = 2 * HOUR;       // must check in within 2h of start
  const REMIND_BEFORE = 2 * HOUR;
  const WEEKLY_GOAL = 2;
  const CRUNCH_PER_MONTH = 2;
  const GRID_HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am..9pm starts
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const INTENSITY = {
    1: { label: 'Light', mult: 1, eg: 'stroll, stretching' },
    2: { label: 'Moderate', mult: 2, eg: 'brisk walk, Pilates, yoga flow' },
    3: { label: 'Vigorous', mult: 3, eg: 'run, spin, HIIT' },
  };
  const ACTIVITIES = {
    walk: { label: 'Walk', icon: '🚶‍♀️', intensity: 2, verb: 'walked' },
    run: { label: 'Run', icon: '🏃‍♀️', intensity: 3, verb: 'ran' },
    pilates: { label: 'Pilates', icon: '🧘‍♀️', intensity: 2, verb: 'did Pilates' },
    gym: { label: 'Gym', icon: '🏋️‍♀️', intensity: 3, verb: 'hit the gym' },
    home: { label: 'Home workout', icon: '🏠', intensity: 2, verb: 'did a home workout' },
    swim: { label: 'Swim', icon: '🏊‍♀️', intensity: 2, verb: 'swam' },
  };
  const MICRO_PRESETS = [
    { label: '10 flights of office stairs', activity: 'home', minutes: 10, intensity: 3 },
    { label: '10-min home circuit', activity: 'home', minutes: 10, intensity: 3 },
    { label: 'Lunchtime brisk walk', activity: 'walk', minutes: 15, intensity: 2 },
    { label: 'Desk stretch break', activity: 'home', minutes: 5, intensity: 1 },
  ];
  const COLORS = ['#F4A6B7', '#A9D3A0', '#BFDDF2', '#CDB8EE', '#FFC6A8', '#FFE39A'];

  // ------------------------------------------------------------------
  // Store
  // ------------------------------------------------------------------
  const TABLES = ['users', 'groups', 'group_members', 'availability_blocks', 'sessions', 'session_participants',
    'workouts', 'points_ledger', 'placed_items', 'vouchers', 'redemptions', 'feed', 'crunch_weeks', 'reminders_sent', 'sim_filled'];

  function blankState() {
    const s = { version: 1, offsetMs: 0, currentUserId: null, settings: { sound: true, reminders: false } };
    TABLES.forEach((t) => (s[t] = []));
    s.vouchers = [
      { id: uid(), name: 'Coffee on us', desc: 'A café drink of your choice', price: 800, active: true },
      { id: uid(), name: 'Activewear 15% off', desc: 'Discount code for a partner store', price: 2000, active: true },
      { id: uid(), name: 'Free fitness class', desc: 'One drop-in class at a partner studio', price: 3000, active: true },
    ];
    return s;
  }
  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        TABLES.forEach((t) => (s[t] = s[t] || []));
        s.settings = s.settings || { sound: true, reminders: false };
        return s;
      }
    } catch (e) { /* storage unavailable: start fresh in memory */ }
    return blankState();
  }
  let S = load();
  function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(S)); } catch (e) { /* in-memory only */ } }

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ------------------------------------------------------------------
  // Time (the admin panel can shift "now" to test sessions without waiting)
  // ------------------------------------------------------------------
  const now = () => new Date(Date.now() + S.offsetMs);
  const nowMs = () => Date.now() + S.offsetMs;
  function weekStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  const pad = (n) => String(n).padStart(2, '0');
  const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const wkey = (d) => dkey(weekStart(d));
  function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  const dayIdx = (d) => (d.getDay() + 6) % 7;
  const fmtDay = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = (d) => { const h = d.getHours(), m = d.getMinutes(); return `${h % 12 || 12}${m ? ':' + pad(m) : ''}${h < 12 ? 'am' : 'pm'}`; };
  const fmtWhen = (d) => `${fmtDay(d)}, ${fmtTime(d)}`;
  const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
  function fmtDur(ms) {
    const m = Math.round(Math.abs(ms) / MIN);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    if (h < 48) return r ? `${h}h ${r}m` : `${h}h`;
    return `${Math.round(h / 24)} days`;
  }
  function relDay(d) {
    const t = weekStart(now()), diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(now()).setHours(0, 0, 0, 0)) / DAY);
    if (diff === 0) return 'Today'; if (diff === 1) return 'Tomorrow'; if (diff === -1) return 'Yesterday';
    return d >= t && d < addDays(t, 7) ? d.toLocaleDateString('en-GB', { weekday: 'long' }) : fmtDay(d);
  }

  // ------------------------------------------------------------------
  // Getters
  // ------------------------------------------------------------------
  const user = (id) => S.users.find((u) => u.id === id);
  const me = () => user(S.currentUserId);
  const groupOf = (userId) => { const m = S.group_members.find((g) => g.user_id === userId); return m && S.groups.find((g) => g.id === m.group_id); };
  const myGroup = () => groupOf(S.currentUserId);
  const members = (groupId) => S.group_members.filter((m) => m.group_id === groupId).map((m) => user(m.user_id)).filter(Boolean);
  const nameOf = (id) => (user(id) || { name: 'Someone' }).name;
  const youOr = (id) => (id === S.currentUserId ? 'You' : nameOf(id));
  const parts = (sessionId) => S.session_participants.filter((p) => p.session_id === sessionId);
  const part = (sessionId, userId) => S.session_participants.find((p) => p.session_id === sessionId && p.user_id === userId);
  const balance = (userId) => S.points_ledger.filter((l) => l.user_id === userId).reduce((a, l) => a + l.amount, 0);
  const earned = (userId) => S.points_ledger.filter((l) => l.user_id === userId && l.amount > 0).reduce((a, l) => a + l.amount, 0);
  const groupEarned = (groupId) => S.points_ledger.filter((l) => l.group_id === groupId && l.amount > 0).reduce((a, l) => a + l.amount, 0);
  function villageLevel(groupId) {
    const e = groupEarned(groupId);
    let lvl = 1; LEVELS.forEach((t, i) => { if (e >= t) lvl = i + 1; });
    return { level: lvl, earned: e, next: LEVELS[lvl] ?? null, prev: LEVELS[lvl - 1], size: 5 + lvl };
  }
  const sessionStart = (s) => new Date(s.start);
  const points = (minutes, intensity) => Math.round(minutes) * INTENSITY[intensity].mult;

  function joinList(names) {
    if (names.length <= 1) return names.join('');
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  // ------------------------------------------------------------------
  // Availability
  // ------------------------------------------------------------------
  function ensureSimWeek(u, wk) {
    if (!u.simulated || !u.template) return;
    const k = `${u.id}|${wk}`;
    if (S.sim_filled.includes(k)) return;
    S.sim_filled.push(k);
    u.template.forEach(([day, hour]) => S.availability_blocks.push({ id: uid(), user_id: u.id, week_start: wk, day, hour }));
  }
  function freeIndex(userIds, weeks) {
    userIds.forEach((id) => weeks.forEach((wk) => ensureSimWeek(user(id), wk)));
    const set = new Set();
    S.availability_blocks.forEach((b) => set.add(`${b.user_id}|${b.week_start}|${b.day}|${b.hour}`));
    return (id, d) => set.has(`${id}|${wkey(d)}|${dayIdx(d)}|${d.getHours()}`);
  }
  function toggleFree(userId, wk, day, hour, value) {
    const i = S.availability_blocks.findIndex((b) => b.user_id === userId && b.week_start === wk && b.day === day && b.hour === hour);
    const on = value ?? i < 0;
    if (on && i < 0) S.availability_blocks.push({ id: uid(), user_id: userId, week_start: wk, day, hour });
    if (!on && i >= 0) S.availability_blocks.splice(i, 1);
  }

  // Overlapping free slots for the current user and her group in the next 14 days.
  function suggestions(groupId, forUserId) {
    const mem = members(groupId).map((u) => u.id);
    const start = new Date(nowMs() + 30 * MIN); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1);
    const weeks = [0, 1, 2].map((i) => wkey(addDays(now(), i * 7)));
    const isFree = freeIndex(mem, weeks);
    const busy = (id, t) => S.session_participants.some((p) => p.user_id === id && ['accepted', 'invited'].includes(p.status) && (() => {
      const s = S.sessions.find((x) => x.id === p.session_id); if (!s || s.closed) return false;
      const a = sessionStart(s).getTime(); return t >= a - HOUR + 1 && t < a + s.minutes * MIN;
    })());
    const out = [];
    let run = null;
    for (let t = start.getTime(); t < start.getTime() + 14 * DAY; t += HOUR) {
      const d = new Date(t);
      const inGrid = GRID_HOURS.includes(d.getHours());
      const who = inGrid ? mem.filter((id) => isFree(id, d) && !busy(id, t)) : [];
      const ok = who.includes(forUserId) && who.length >= 2;
      const sig = ok ? who.slice().sort().join(',') : null;
      if (run && run.sig === sig) { run.hours++; continue; }
      if (run) out.push(run);
      run = ok ? { sig, start: d, hours: 1, who } : null;
    }
    if (run) out.push(run);
    return out
      .sort((a, b) => b.who.length - a.who.length || a.start - b.start)
      .slice(0, 8)
      .map((r) => ({ ...r, activity: suggestActivity(r.start) }));
  }
  function suggestActivity(d) {
    const h = d.getHours(), weekend = dayIdx(d) >= 5;
    const pool = weekend ? ['walk', 'swim', 'run', 'pilates'] : h < 10 ? ['run', 'swim', 'walk'] : h < 15 ? ['walk', 'pilates'] : ['pilates', 'gym', 'home', 'walk'];
    return pool[(d.getDate() + h) % pool.length];
  }

  // ------------------------------------------------------------------
  // Feed
  // ------------------------------------------------------------------
  function post(groupId, text, opts = {}) {
    S.feed.push({ id: uid(), group_id: groupId, at: new Date(nowMs()).toISOString(), text, icon: opts.icon || '🌿', user_ids: opts.user_ids || [] });
  }

  // ------------------------------------------------------------------
  // Points engine
  // ------------------------------------------------------------------
  function ledger(userId, groupId, amount, reason, ref, note) {
    S.points_ledger.push({ id: uid(), user_id: userId, group_id: groupId, amount, reason, ref: ref || null, note: note || '', at: new Date(nowMs()).toISOString() });
  }

  function createSession({ groupId, start, minutes, activity, intensity, createdBy, invitees, source = 'app' }) {
    const s = {
      id: uid(), group_id: groupId, start: new Date(start).toISOString(), minutes, activity,
      intensity: intensity || ACTIVITIES[activity].intensity, created_by: createdBy, source,
      created_at: new Date(nowMs()).toISOString(), bonus_awarded: false, closed: false,
    };
    S.sessions.push(s);
    const ids = new Set(invitees);
    if (createdBy !== 'admin') ids.add(createdBy);
    ids.forEach((id) => S.session_participants.push({
      id: uid(), session_id: s.id, user_id: id,
      status: id === createdBy ? 'accepted' : 'invited',
      responded_at: id === createdBy ? s.created_at : null, checked_in_at: null, workout_id: null,
    }));
    const a = ACTIVITIES[activity];
    post(groupId, source === 'admin'
      ? `New session idea: ${a.label.toLowerCase()} on ${fmtWhen(sessionStart(s))}. Who's in?`
      : `${nameOf(createdBy)} suggested a ${a.label.toLowerCase()} on ${fmtWhen(sessionStart(s))}.`, { icon: '💌', user_ids: [...ids] });
    return s;
  }

  function respond(sessionId, userId, accept) {
    const p = part(sessionId, userId), s = S.sessions.find((x) => x.id === sessionId);
    if (!p || !s || nowMs() >= sessionStart(s).getTime()) return;
    p.status = accept ? 'accepted' : 'declined';
    p.responded_at = new Date(nowMs()).toISOString();
  }

  function checkinWindow(s) {
    const a = sessionStart(s).getTime();
    return { opens: a - CHECKIN_OPENS, closes: a + BONUS_WINDOW };
  }
  function canCheckIn(s, userId) {
    const p = part(s.id, userId); if (!p || p.status !== 'accepted' || p.checked_in_at || s.closed) return false;
    const w = checkinWindow(s), t = nowMs();
    return t >= w.opens && t <= w.closes;
  }

  // Award the 2x buddy bonus once everyone who said yes has checked in (2+ people).
  function tryAward(s) {
    if (s.bonus_awarded || s.closed) return false;
    const ps = parts(s.id);
    if (ps.some((p) => p.status === 'invited') && nowMs() < sessionStart(s).getTime()) return false;
    const acc = ps.filter((p) => p.status === 'accepted');
    const done = acc.filter((p) => p.checked_in_at);
    if (done.length < 2 || done.length !== acc.length) return false;
    let each = [];
    done.forEach((p) => {
      const w = S.workouts.find((x) => x.id === p.workout_id);
      ledger(p.user_id, s.group_id, w.base_points, 'buddy_bonus', s.id, 'Buddy bonus (2x)');
      each.push(w.base_points * 2);
    });
    s.bonus_awarded = true;
    const pts = each.every((v) => v === each[0]) ? `+${each[0]} pts each` : `up to +${Math.max(...each)} pts`;
    post(s.group_id, `${joinList(done.map((p) => nameOf(p.user_id)))} ${ACTIVITIES[s.activity].verb} together! ${pts} (2x)`, { icon: '🎉', user_ids: done.map((p) => p.user_id) });
    return true;
  }

  function checkIn(sessionId, userId, { activity, minutes, intensity }) {
    const s = S.sessions.find((x) => x.id === sessionId);
    if (!s || !canCheckIn(s, userId)) return null;
    const base = points(minutes, intensity);
    const w = { id: uid(), user_id: userId, group_id: s.group_id, session_id: s.id, kind: 'session', activity, label: ACTIVITIES[activity].label, minutes, intensity, base_points: base, at: new Date(nowMs()).toISOString() };
    S.workouts.push(w);
    ledger(userId, s.group_id, base, 'workout', w.id, `${ACTIVITIES[activity].label} · ${minutes} min · ${INTENSITY[intensity].label}`);
    const p = part(s.id, userId); p.checked_in_at = w.at; p.workout_id = w.id;
    const bonus = tryAward(s);
    const waiting = parts(s.id).filter((x) => x.status === 'accepted' && !x.checked_in_at).map((x) => x.user_id);
    return { base, bonus, waiting, workout: w };
  }

  function logMicro(userId, { label, activity, minutes, intensity }) {
    minutes = Math.max(5, Math.min(15, Math.round(minutes)));
    const g = groupOf(userId);
    const base = points(minutes, intensity);
    const w = { id: uid(), user_id: userId, group_id: g?.id || null, session_id: null, kind: 'micro', activity, label, minutes, intensity, base_points: base, at: new Date(nowMs()).toISOString() };
    S.workouts.push(w);
    ledger(userId, w.group_id, base, 'micro', w.id, `${label} · ${minutes} min · ${INTENSITY[intensity].label}`);
    if (g) post(g.id, `${nameOf(userId)} squeezed in a micro-workout: ${label.toLowerCase()}. +${base} pts`, { icon: '⚡', user_ids: [userId] });
    return { base, workout: w };
  }

  // Close sessions whose check-in window has passed; expire unanswered invites at start.
  function resolveSessions() {
    let changed = false;
    S.sessions.forEach((s) => {
      if (s.closed) return;
      const t = nowMs(), a = sessionStart(s).getTime();
      if (t >= a) parts(s.id).forEach((p) => { if (p.status === 'invited') { p.status = 'expired'; changed = true; } });
      if (t >= a && tryAward(s)) changed = true;
      if (t > a + BONUS_WINDOW) {
        s.closed = true; changed = true;
        if (s.bonus_awarded) return;
        const acc = parts(s.id).filter((p) => p.status === 'accepted');
        const came = acc.filter((p) => p.checked_in_at).map((p) => p.user_id);
        const missed = acc.filter((p) => !p.checked_in_at).map((p) => p.user_id);
        const label = ACTIVITIES[s.activity].label.toLowerCase();
        if (came.length && missed.length) {
          post(s.group_id, `${joinList(missed.map(nameOf))} couldn't make the ${label} this time, so the 2x bonus is resting until next session. ${joinList(came.map(nameOf))} still earned their points. 🌱`, { icon: '🍃', user_ids: [...came, ...missed] });
        } else if (came.length === 1) {
          post(s.group_id, `${nameOf(came[0])} went for the ${label} solo. Lovely effort!`, { icon: '🌤', user_ids: came });
        } else if (!came.length && acc.length) {
          post(s.group_id, `The ${label} on ${fmtDay(sessionStart(s))} didn't happen. No worries, busy weeks happen. Find a new time when you're ready.`, { icon: '☁️', user_ids: acc.map((p) => p.user_id) });
        }
      }
    });
    if (changed) save();
    return changed;
  }

  // ------------------------------------------------------------------
  // Streaks (weeks with 2+ workouts; crunch weeks pause instead of breaking)
  // ------------------------------------------------------------------
  const workoutsInWeek = (userId, wk) => S.workouts.filter((w) => w.user_id === userId && wkey(new Date(w.at)) === wk);
  const isCrunch = (userId, wk) => S.crunch_weeks.some((c) => c.user_id === userId && c.week_start === wk);
  function crunchUsed(userId, wk) {
    const m = wk.slice(0, 7);
    return S.crunch_weeks.filter((c) => c.user_id === userId && c.week_start.slice(0, 7) === m).length;
  }
  function streak(userId) {
    const u = user(userId); if (!u) return 0;
    const first = weekStart(new Date(u.created_at));
    let wk = weekStart(now()), n = 0;
    // The current week only counts once it's met; it never breaks the streak while in progress.
    if (workoutsInWeek(userId, dkey(wk)).length >= WEEKLY_GOAL) n++;
    wk = addDays(wk, -7);
    while (wk >= first) {
      const k = dkey(wk);
      if (workoutsInWeek(userId, k).length >= WEEKLY_GOAL) n++;
      else if (!isCrunch(userId, k)) break;
      wk = addDays(wk, -7);
    }
    return n;
  }

  // ------------------------------------------------------------------
  // Village + rewards
  // ------------------------------------------------------------------
  function buyItem(userId, itemId) {
    const g = groupOf(userId), it = VILLAGE_ITEMS.find((i) => i.id === itemId);
    if (!g || !it) return null;
    if (villageLevel(g.id).level < it.level || balance(userId) < it.price) return null;
    ledger(userId, g.id, -it.price, 'village_item', it.id, it.name);
    const p = { id: uid(), group_id: g.id, item_id: it.id, x: null, y: null, bought_by: userId, at: new Date(nowMs()).toISOString() };
    S.placed_items.push(p);
    post(g.id, `${nameOf(userId)} bought a ${it.name.toLowerCase()} for the village.`, { icon: '🏡', user_ids: [userId] });
    return p;
  }
  function occupied(groupId, x, y, exceptId) {
    return S.placed_items.some((p) => p.group_id === groupId && p.x === x && p.y === y && p.id !== exceptId);
  }
  function redeem(userId, voucherId) {
    const v = S.vouchers.find((x) => x.id === voucherId), g = groupOf(userId);
    if (!v || !v.active || balance(userId) < v.price) return null;
    ledger(userId, g?.id || null, -v.price, 'redemption', v.id, v.name);
    const r = { id: uid(), user_id: userId, group_id: g?.id || null, voucher_id: v.id, voucher_name: v.name, price: v.price, status: 'pending', at: new Date(nowMs()).toISOString(), sent_at: null };
    S.redemptions.push(r);
    return r;
  }

  // ------------------------------------------------------------------
  // Groups, users, demo seed
  // ------------------------------------------------------------------
  const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();
  function addUser(name, opts = {}) {
    const u = { id: uid(), name: name.trim(), color: opts.color || COLORS[S.users.length % COLORS.length], created_at: new Date(nowMs()).toISOString(), simulated: !!opts.simulated, template: opts.template || null, consent_at: opts.consent ? new Date(nowMs()).toISOString() : null };
    S.users.push(u);
    return u;
  }
  function joinGroup(userId, groupId) {
    S.group_members = S.group_members.filter((m) => m.user_id !== userId);
    S.group_members.push({ group_id: groupId, user_id: userId, joined_at: new Date(nowMs()).toISOString() });
  }
  function createGroup(name, ownerId) {
    const g = { id: uid(), name: name.trim() || 'Our little group', code: code(), created_at: new Date(nowMs()).toISOString() };
    S.groups.push(g);
    joinGroup(ownerId, g.id);
    // every village starts with one cottage, so it never looks empty
    const v = villageLevel(g.id);
    S.placed_items.push({ id: uid(), group_id: g.id, item_id: 'cottage', x: Math.floor(v.size / 2) - 1, y: Math.floor(v.size / 2) - 1, bought_by: null, at: g.created_at });
    post(g.id, `${nameOf(ownerId)} started ${g.name}. Welcome to your village!`, { icon: '🏡', user_ids: [ownerId] });
    return g;
  }
  const DEMO_FRIENDS = [
    { name: 'Wei Ling', template: [[0, 12], [1, 7], [1, 8], [3, 19], [3, 20], [5, 8], [5, 9], [5, 10], [5, 11]] },
    { name: 'Michelle', template: [[1, 7], [2, 12], [3, 19], [3, 20], [5, 9], [5, 10], [6, 16], [6, 17]] },
  ];
  function addTestFriend(groupId, name, template) {
    const tpl = template || randomTemplate();
    const u = addUser(name, { simulated: true, template: tpl, consent: true });
    joinGroup(u.id, groupId);
    post(groupId, `${u.name} joined the group.`, { icon: '👋', user_ids: [u.id] });
    return u;
  }
  function randomTemplate() {
    const t = [];
    [[1, 7], [1, 8], [3, 19], [3, 20], [5, 9], [5, 10], [6, 16], [2, 12], [0, 18], [4, 7]].forEach((c) => { if (Math.random() < 0.6) t.push(c); });
    return t.length ? t : [[5, 9], [5, 10]];
  }

  // ------------------------------------------------------------------
  // Sound (soft WebAudio chimes, toggleable)
  // ------------------------------------------------------------------
  let actx = null;
  function chime(kind = 'tap') {
    if (!S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = { tap: [880], success: [523.25, 659.25, 783.99], big: [523.25, 659.25, 783.99, 1046.5], soft: [440, 554.37] }[kind] || [660];
      notes.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.11;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(kind === 'tap' ? 0.05 : 0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.65);
      });
    } catch (e) { /* audio unavailable */ }
  }

  // ------------------------------------------------------------------
  // UI state
  // ------------------------------------------------------------------
  const ui = { tab: 'home', plan: 'week', weekOffset: 0, modal: null, sel: null, placing: null, toast: null, onboard: null, admin: 'overview' };
  try { const t = sessionStorage.getItem('ef-tab'); if (t) ui.tab = t; } catch (e) { /* ignore */ }

  const $app = document.getElementById('app');
  function setTab(t) { ui.tab = t; ui.sel = null; ui.placing = null; try { sessionStorage.setItem('ef-tab', t); } catch (e) { /* ignore */ } render(); window.scrollTo(0, 0); }
  let toastTimer;
  function toast(msg) { ui.toast = msg; renderToast(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast = null; renderToast(); }, 2600); }
  function openModal(m) { ui.modal = m; renderModal(); }
  function closeModal() { ui.modal = null; renderModal(); }

  // ------------------------------------------------------------------
  // Small view helpers
  // ------------------------------------------------------------------
  const avatar = (u, size = 32) => u ? `<span class="avatar" style="--c:${u.color};--s:${size}px" title="${esc(u.name)}">${esc(u.name.trim()[0] || '?').toUpperCase()}</span>` : '';
  const pill = (txt, cls = '') => `<span class="pill ${cls}">${txt}</span>`;
  const STATUS = { invited: ['Invited', 'wait'], accepted: ['Going', 'ok'], declined: ['Can\'t make it', 'no'], expired: ['No reply', 'no'] };
  function partChips(s) {
    return `<div class="chips">${parts(s.id).map((p) => {
      const u = user(p.user_id); if (!u) return '';
      const [label, cls] = p.checked_in_at ? ['Checked in', 'done'] : STATUS[p.status];
      return `<span class="chip ${cls}">${avatar(u, 22)}<span>${esc(youOr(u.id))}</span><small>${label}</small></span>`;
    }).join('')}</div>`;
  }
  const actLabel = (s) => `${ACTIVITIES[s.activity].icon} ${ACTIVITIES[s.activity].label}`;
  function intensityPicker(name, value) {
    return `<div class="seg intensity" role="radiogroup" aria-label="Intensity">${[1, 2, 3].map((i) =>
      `<label class="seg-opt"><input type="radio" name="${name}" value="${i}" ${+value === i ? 'checked' : ''}><span><b>${INTENSITY[i].label}</b><small>${INTENSITY[i].mult}x · ${INTENSITY[i].eg}</small></span></label>`).join('')}</div>`;
  }
  function activitySelect(name, value) {
    return `<select name="${name}">${Object.entries(ACTIVITIES).map(([k, a]) => `<option value="${k}" ${k === value ? 'selected' : ''}>${a.icon} ${a.label}</option>`).join('')}</select>`;
  }

  // ------------------------------------------------------------------
  // Render: shell
  // ------------------------------------------------------------------
  function render() {
    resolveSessions();
    if (!S.currentUserId || !me() || ui.onboard) { renderOnboarding(); renderModal(); return; }
    if (!myGroup()) { ui.onboard = { step: 'group' }; renderOnboarding(); return; }
    const u = me();
    const offset = S.offsetMs !== 0;
    const main = { home: viewHome, plan: viewPlan, village: viewVillage, rewards: viewRewards, me: viewMe, admin: viewAdmin }[ui.tab] || viewHome;
    $app.innerHTML = `
      <header class="topbar">
        <div class="logo"><svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><use href="#logo"/></svg><span>ExerciseFolks</span></div>
        <div class="top-right">
          ${offset ? `<button class="clock-chip" data-act="tab" data-tab="admin" title="Simulated time (admin)">🕰 ${esc(fmtDay(now()))} ${esc(fmtTime(now()))}</button>` : ''}
          <button class="who" data-act="switcher" aria-label="Switch test user">${avatar(u, 34)}</button>
        </div>
      </header>
      <main class="view view-${ui.tab}">${main()}</main>
      ${ui.tab === 'admin' ? '' : tabbar()}
      <div id="toast" class="toast" role="status" aria-live="polite"></div>`;
    renderToast();
    renderModal();
  }
  function tabbar() {
    const pending = S.session_participants.filter((p) => p.user_id === S.currentUserId && p.status === 'invited').length;
    const tabs = [['home', 'Home', 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z'], ['plan', 'Plan', 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M9 3v4M15 3v4'], ['village', 'Village', 'M3 20h18M5 20v-7l5-4 5 4v7M15 20v-5l3-2 3 2v5'], ['rewards', 'Rewards', 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0'], ['me', 'Me', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6']];
    return `<nav class="tabbar">${tabs.map(([k, l, d]) => `<button class="${ui.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}" aria-label="${l}"><svg viewBox="0 0 24 24" width="24" height="24"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${l}</span>${k === 'plan' && pending ? `<i class="dot">${pending}</i>` : ''}</button>`).join('')}</nav>`;
  }
  function renderToast() { const t = document.getElementById('toast'); if (!t) return; t.textContent = ui.toast || ''; t.classList.toggle('show', !!ui.toast); }

  // ------------------------------------------------------------------
  // Onboarding
  // ------------------------------------------------------------------
  function renderOnboarding() {
    const o = ui.onboard || (ui.onboard = { step: 'welcome' });
    const joinCode = new URLSearchParams(location.search).get('join');
    const joinable = joinCode && S.groups.find((g) => g.code === joinCode.toUpperCase());
    let body = '';
    if (o.step === 'welcome') {
      body = `
        <div class="hero-village">${villageSVG({ size: 4, placed: [
          { id: 'a', item_id: 'cottage', x: 1, y: 1 }, { id: 'b', item_id: 'tree', x: 0, y: 2 }, { id: 'c', item_id: 'lantern', x: 2, y: 0 },
          { id: 'd', item_id: 'flowers', x: 2, y: 2 }, { id: 'e', item_id: 'cat', x: 3, y: 2 }, { id: 'f', item_id: 'pond', x: 1, y: 3 }], interactive: false })}</div>
        <h1 class="display">Move with<br>your people.</h1>
        <p class="lede">ExerciseFolks finds the hours you and your friends are all free, nudges you to move together, and grows a cosy village with every workout.</p>
        ${joinable ? `<p class="note">You've been invited to <b>${esc(joinable.name)}</b>.</p>` : ''}
        <button class="btn primary big" data-act="ob" data-step="consent">Get started</button>
        ${S.users.length ? `<button class="btn ghost" data-act="switcher">I'm already here</button>` : ''}
        <p class="fine">Prototype: everything stays in this browser. Test friends live on this device, and you can switch between them.</p>`;
    } else if (o.step === 'consent') {
      body = `
        <h2 class="display sm">Before we start</h2>
        <div class="card soft">
          <h3>What ExerciseFolks stores</h3>
          <ul class="ticks">
            <li><b>Free/busy blocks only.</b> The hours you mark as free. Never calendar event titles, places or people.</li>
            <li><b>Your workouts.</b> Activity, minutes and the intensity you pick.</li>
            <li><b>Your points</b>, village items and reward requests.</li>
            <li><b>Your first name</b>, shown only to your private group.</li>
          </ul>
          <h3>What we never do</h3>
          <ul class="ticks no">
            <li>Show you to strangers or make public profiles.</li>
            <li>Read your calendar's event details.</li>
            <li>Sell your data.</li>
          </ul>
          <p class="fine">You can delete your account and all its data from <b>Me → Privacy</b> at any time. In this prototype, data is saved in this browser only.</p>
        </div>
        <label class="check"><input type="checkbox" id="consent"> I understand and agree</label>
        <button class="btn primary big" data-act="ob-consent">Continue</button>`;
    } else if (o.step === 'name') {
      body = `
        <h2 class="display sm">What should friends call you?</h2>
        <form data-form="ob-name" class="stack">
          <input name="name" placeholder="First name" maxlength="24" required autocomplete="given-name" autofocus>
          <button class="btn primary big">Next</button>
        </form>`;
    } else if (o.step === 'group') {
      body = `
        <h2 class="display sm">Your friend group</h2>
        <p class="lede">Groups are private, 2 to 5 friends you already know.</p>
        ${joinable ? `<button class="btn primary big" data-act="ob-join" data-code="${esc(joinable.code)}">Join ${esc(joinable.name)}</button>` : ''}
        <div class="card soft stack">
          <h3>Try it with demo friends</h3>
          <p class="fine">Creates <b>Sunday Strollers</b> with Wei Ling and Michelle (with sample free times). Switch to them from your avatar to accept invites and check in.</p>
          <button class="btn ${joinable ? '' : 'primary'}" data-act="ob-demo">Start with demo friends</button>
        </div>
        <form class="card soft stack" data-form="ob-create">
          <h3>Create a new group</h3>
          <input name="gname" placeholder="Group name, e.g. Lunchtime Walkers" maxlength="40" required>
          <button class="btn">Create group</button>
        </form>
        <form class="card soft stack" data-form="ob-joincode">
          <h3>Join with a code</h3>
          <input name="code" placeholder="6-letter code" maxlength="6" required style="text-transform:uppercase">
          <button class="btn">Join</button>
        </form>`;
    }
    $app.innerHTML = `<main class="onboard">${body}</main><div id="toast" class="toast" role="status" aria-live="polite"></div>`;
    renderToast();
  }

  // ------------------------------------------------------------------
  // Home
  // ------------------------------------------------------------------
  function mySessions(userId, filter) {
    return S.sessions.filter((s) => { const p = part(s.id, userId); return p && filter(s, p); })
      .sort((a, b) => sessionStart(a) - sessionStart(b));
  }
  function nextSession(userId) {
    return mySessions(userId, (s, p) => !s.closed && p.status === 'accepted' && !p.checked_in_at)[0]
      || mySessions(userId, (s, p) => !s.closed && p.status === 'accepted')[0];
  }
  function sessionCard(s, opts = {}) {
    const u = me(), p = part(s.id, u.id), t = nowMs(), a = sessionStart(s).getTime(), w = checkinWindow(s);
    let action = '';
    if (p?.status === 'invited' && t < a) {
      action = `<div class="row"><button class="btn primary" data-act="respond" data-id="${s.id}" data-yes="1">I'm in</button><button class="btn ghost" data-act="respond" data-id="${s.id}" data-yes="0">Can't make it</button></div>`;
    } else if (p?.status === 'accepted' && !p.checked_in_at && !s.closed) {
      if (canCheckIn(s, u.id)) action = `<button class="btn primary big" data-act="checkin" data-id="${s.id}">Check in &amp; log workout</button><p class="fine">Check in by ${fmtTime(new Date(w.closes))} to keep the 2x buddy bonus.</p>`;
      else if (t < w.opens) action = `<div class="row between"><p class="fine">Check-in opens ${fmtTime(new Date(w.opens))}, ${fmtDur(w.opens - t)} from now.</p><button class="btn ghost sm" data-act="respond" data-id="${s.id}" data-yes="0">Can't make it</button></div>`;
    } else if (p?.checked_in_at) {
      const waiting = parts(s.id).filter((x) => x.status === 'accepted' && !x.checked_in_at);
      action = s.bonus_awarded ? `<p class="good">2x buddy bonus earned 🎉</p>` : waiting.length && !s.closed ? `<p class="fine">You're checked in. 2x bonus unlocks when ${joinList(waiting.map((x) => youOr(x.user_id)))} check${waiting.length > 1 ? '' : 's'} in.</p>` : '';
    }
    const status = s.closed ? (s.bonus_awarded ? pill('2x earned', 'ok') : pill('Finished', '')) : t >= a ? pill('Happening now', 'live') : pill(relDay(new Date(a)), 'soft');
    return `<article class="card session ${opts.big ? 'big' : ''}">
      <div class="row between"><h3>${actLabel(s)}</h3>${status}</div>
      <p class="when">${esc(fmtWhen(new Date(a)))} · ${s.minutes} min · ${INTENSITY[s.intensity].label}${s.source === 'admin' ? ' · <span class="fine">suggested for you</span>' : ''}</p>
      ${partChips(s)}
      ${action}
    </article>`;
  }
  function viewHome() {
    const u = me(), g = myGroup(), t = nowMs();
    const hr = now().getHours();
    const hello = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const invites = mySessions(u.id, (s, p) => p.status === 'invited' && t < sessionStart(s).getTime());
    const next = nextSession(u.id);
    const wk = wkey(now());
    const count = workoutsInWeek(u.id, wk).length;
    const st = streak(u.id);
    const crunch = isCrunch(u.id, wk);
    const v = villageLevel(g.id);
    const reminders = mySessions(u.id, (s, p) => p.status === 'accepted' && !s.closed && !p.checked_in_at && sessionStart(s).getTime() > t && sessionStart(s).getTime() - t <= REMIND_BEFORE);
    const feed = S.feed.filter((f) => f.group_id === g.id).slice(-12).reverse();
    return `
      <section class="greet"><p class="fine">${esc(fmtDay(now()))}</p><h1 class="display sm">${hello}, ${esc(u.name)}</h1></section>
      ${reminders.map((s) => `<div class="banner">⏰ Your ${ACTIVITIES[s.activity].label.toLowerCase()} starts at ${fmtTime(sessionStart(s))}, in ${fmtDur(sessionStart(s).getTime() - t)}.</div>`).join('')}
      ${invites.length ? `<h2 class="h2">Invites for you</h2>${invites.map((s) => sessionCard(s)).join('')}` : ''}
      <h2 class="h2">Next session</h2>
      ${next ? sessionCard(next, { big: true }) : `<article class="card empty"><p>Nothing planned yet.</p><button class="btn primary" data-act="plan" data-plan="find">Find a time with friends</button></article>`}
      <div class="grid2">
        <article class="card goal">
          <h3>This week</h3>
          <div class="goal-dots">${Array.from({ length: Math.max(WEEKLY_GOAL, count) }, (_, i) => `<span class="${i < count ? 'on' : ''}"></span>`).join('')}</div>
          <p class="fine">${count >= WEEKLY_GOAL ? 'Weekly goal met. Lovely.' : crunch ? 'Crunch week: streak paused, no pressure.' : `${WEEKLY_GOAL - count} more to reach your goal`}</p>
        </article>
        <article class="card goal">
          <h3>Streak</h3>
          <p class="big-num">${st}<small> week${st === 1 ? '' : 's'}</small></p>
          <p class="fine">${crunch ? '⏸ paused this week' : 'Weeks with 2+ workouts'}</p>
        </article>
      </div>
      <button class="btn block micro" data-act="micro">⚡ Squeeze in a micro-workout <small>5–15 min</small></button>
      <article class="card village-peek" data-act="tab" data-tab="village">
        <div class="row between"><h3>Your village</h3>${pill('Level ' + v.level, 'soft')}</div>
        ${villageSVG({ size: v.size, placed: S.placed_items.filter((p) => p.group_id === g.id), interactive: false })}
        <p class="fine">You have <b>${balance(u.id)}</b> pts to spend. Tap to decorate.</p>
      </article>
      <h2 class="h2">Group feed</h2>
      <ul class="feed">${feed.map((f) => `<li><span class="ficon">${f.icon}</span><div><p>${esc(f.text)}</p><small>${esc(relDay(new Date(f.at)))} · ${fmtTime(new Date(f.at))}</small></div></li>`).join('') || '<li class="fine">Nothing yet. Your first session will show up here.</li>'}</ul>`;
  }

  // ------------------------------------------------------------------
  // Plan: availability, suggestions, sessions
  // ------------------------------------------------------------------
  function viewPlan() {
    const tabs = [['week', 'My week'], ['find', 'Find a time'], ['sessions', 'Sessions']];
    const body = ui.plan === 'find' ? planFind() : ui.plan === 'sessions' ? planSessions() : planWeek();
    return `<div class="seg tabs">${tabs.map(([k, l]) => `<button class="${ui.plan === k ? 'on' : ''}" data-act="plan" data-plan="${k}">${l}</button>`).join('')}</div>${body}`;
  }
  function planWeek() {
    const u = me(), g = myGroup();
    const ws = addDays(weekStart(now()), ui.weekOffset * 7), wk = dkey(ws);
    const others = members(g.id).filter((m) => m.id !== u.id);
    const isFree = freeIndex(members(g.id).map((m) => m.id), [wk]);
    const t = nowMs();
    let cells = '';
    GRID_HOURS.forEach((h) => {
      cells += `<div class="hl">${hourLabel(h)}</div>`;
      DAYS.forEach((_, d) => {
        const at = addDays(ws, d); at.setHours(h);
        const mine = isFree(u.id, at);
        const n = others.filter((o) => isFree(o.id, at)).length;
        const past = at.getTime() + HOUR <= t;
        cells += `<button class="cell${mine ? ' on' : ''}${past ? ' past' : ''}${mine && n ? ' match' : ''}" data-act="cell" data-day="${d}" data-hour="${h}" aria-pressed="${mine}" aria-label="${DAYS[d]} ${hourLabel(h)}${mine ? ', free' : ''}${n ? `, ${n} friend${n > 1 ? 's' : ''} free` : ''}">${n ? `<i>${'•'.repeat(n)}</i>` : ''}</button>`;
      });
    });
    const count = S.availability_blocks.filter((b) => b.user_id === u.id && b.week_start === wk).length;
    return `
      <div class="row between week-nav">
        <button class="btn ghost sm" data-act="week" data-d="-1" ${ui.weekOffset <= 0 ? 'disabled' : ''} aria-label="Previous week">‹</button>
        <h2 class="h2 flat">${ui.weekOffset === 0 ? 'This week' : ui.weekOffset === 1 ? 'Next week' : 'Week of'} · ${esc(fmtDay(ws))}</h2>
        <button class="btn ghost sm" data-act="week" data-d="1" ${ui.weekOffset >= 2 ? 'disabled' : ''} aria-label="Next week">›</button>
      </div>
      <p class="fine">Tap the hours you're free. Dots show how many friends are free then.</p>
      <div class="avail" style="--cols:7">
        <div></div>${DAYS.map((d, i) => `<div class="dh">${d}<small>${addDays(ws, i).getDate()}</small></div>`).join('')}
        ${cells}
      </div>
      <div class="row wrap">
        <button class="btn sm" data-act="copy-week">Copy last week</button>
        <button class="btn sm ghost" data-act="clear-week" ${count ? '' : 'disabled'}>Clear</button>
        <button class="btn sm primary" data-act="plan" data-plan="find">See overlapping times →</button>
      </div>
      <div class="card soft gcal">
        <h3>Google Calendar (read-only free/busy)</h3>
        <p class="fine">In the full build you can import busy blocks from Google Calendar. Only "busy from–to" is read, never event titles or details. Manual entry for now.</p>
        <button class="btn sm" disabled>Connect Google Calendar</button>
      </div>`;
  }
  function planFind() {
    const u = me(), g = myGroup();
    const sug = suggestions(g.id, u.id);
    const size = members(g.id).length;
    if (size < 2) return `<article class="card empty"><p>Invite at least one friend to find shared times.</p><button class="btn primary" data-act="tab" data-tab="me">Invite friends</button></article>`;
    if (!sug.length) return `<article class="card empty"><p>No overlapping free hours in the next two weeks yet.</p><p class="fine">Mark more free hours in <b>My week</b>, or nudge a friend to fill theirs in.</p><button class="btn" data-act="plan" data-plan="week">Edit my week</button></article>`;
    return `<p class="fine">Times when you and at least one friend are free, best matches first.</p>
      ${sug.map((s, i) => {
        const end = new Date(s.start.getTime() + s.hours * HOUR);
        const a = ACTIVITIES[s.activity];
        return `<article class="card slot">
          <div class="row between"><h3>${esc(relDay(s.start))}, ${fmtTime(s.start)}–${fmtTime(end)}</h3>${s.who.length === size ? pill('Everyone free', 'ok') : pill(`${s.who.length} of ${size} free`, 'soft')}</div>
          <div class="chips">${s.who.map((id) => `<span class="chip">${avatar(user(id), 22)}<span>${esc(youOr(id))}</span></span>`).join('')}</div>
          <div class="row between"><p class="suggest">${a.icon} How about a <b>${a.label.toLowerCase()}</b>?</p><button class="btn primary" data-act="invite" data-i="${i}">Invite</button></div>
        </article>`;
      }).join('')}`;
  }
  function planSessions() {
    const u = me(), t = nowMs();
    const upcoming = mySessions(u.id, (s) => !s.closed);
    const past = mySessions(u.id, (s) => s.closed).reverse().slice(0, 10);
    return `<h2 class="h2">Upcoming</h2>
      ${upcoming.map((s) => sessionCard(s)).join('') || '<p class="fine">No upcoming sessions.</p>'}
      <h2 class="h2">Past</h2>
      ${past.map((s) => sessionCard(s)).join('') || '<p class="fine">Past sessions will appear here.</p>'}`;
  }

  // ------------------------------------------------------------------
  // Village
  // ------------------------------------------------------------------
  function viewVillage() {
    const u = me(), g = myGroup(), v = villageLevel(g.id);
    const placed = S.placed_items.filter((p) => p.group_id === g.id);
    const stored = placed.filter((p) => p.x == null || p.x >= v.size || p.y >= v.size);
    const bal = balance(u.id);
    const pct = v.next ? Math.round(((v.earned - v.prev) / (v.next - v.prev)) * 100) : 100;
    const selItem = ui.sel && placed.find((p) => p.id === ui.sel);
    const placingItem = ui.placing && placed.find((p) => p.id === ui.placing);
    return `
      <section class="row between"><div><h1 class="display sm">${esc(g.name)}</h1><p class="fine">Level ${v.level} village · ${v.size}×${v.size}</p></div><div class="balance"><b>${bal}</b><small>your pts</small></div></section>
      <div class="levelbar" aria-label="Village level progress"><span style="width:${pct}%"></span></div>
      <p class="fine">${v.next ? `${v.next - v.earned} more group points to reach level ${v.level + 1} and unlock new items.` : 'Top level reached. Your village is in full bloom.'}</p>
      <div class="village-wrap ${placingItem ? 'is-placing' : ''}">
        ${villageSVG({ size: v.size, placed, sel: ui.sel, placing: !!placingItem })}
      </div>
      ${placingItem ? `<div class="toolbar"><span>Tap a free tile to place your <b>${esc(itemName(placingItem.item_id))}</b>.</span><button class="btn sm ghost" data-act="cancel-place">Later</button></div>`
        : selItem ? `<div class="toolbar"><span><b>${esc(itemName(selItem.item_id))}</b> selected. Tap an empty tile to move it.</span><button class="btn sm" data-act="store-item">Put away</button><button class="btn sm ghost" data-act="deselect">Done</button></div>`
        : `<p class="fine center">Tap an item to move it.</p>`}
      ${stored.length ? `<h2 class="h2">In storage</h2><div class="shop">${stored.map((p) => `<button class="shop-item" data-act="place" data-id="${p.id}">${itemIcon(p.item_id, 56)}<span>${esc(itemName(p.item_id))}</span><small>Place</small></button>`).join('')}</div>` : ''}
      <h2 class="h2">Village shop</h2>
      <div class="shop">${VILLAGE_ITEMS.map((it) => {
        const locked = v.level < it.level, poor = bal < it.price;
        return `<button class="shop-item${locked ? ' locked' : ''}" data-act="buy" data-item="${it.id}" ${locked || poor ? 'aria-disabled="true"' : ''}>${itemIcon(it.id, 56)}<span>${esc(it.name)}</span><small>${locked ? `🔒 Level ${it.level}` : `${it.price} pts`}</small></button>`;
      }).join('')}</div>`;
  }
  const itemName = (id) => (VILLAGE_ITEMS.find((i) => i.id === id) || { name: id }).name;

  // ------------------------------------------------------------------
  // Rewards
  // ------------------------------------------------------------------
  function viewRewards() {
    const u = me(), bal = balance(u.id);
    const mine = S.redemptions.filter((r) => r.user_id === u.id).slice().reverse();
    return `
      <section class="row between"><h1 class="display sm">Rewards</h1><div class="balance"><b>${bal}</b><small>your pts</small></div></section>
      <p class="fine">Swap points for real treats. We send vouchers by email within a few days.</p>
      ${S.vouchers.filter((v) => v.active).map((v) => `
        <article class="card voucher">
          <div class="vicon">🎁</div>
          <div class="grow"><h3>${esc(v.name)}</h3><p class="fine">${esc(v.desc)}</p></div>
          <div class="vprice"><b>${v.price}</b><small>pts</small>
            <button class="btn sm ${bal >= v.price ? 'primary' : ''}" data-act="redeem" data-id="${v.id}" ${bal >= v.price ? '' : 'disabled'}>${bal >= v.price ? 'Redeem' : `${v.price - bal} to go`}</button></div>
        </article>`).join('') || '<p class="fine">No rewards available right now.</p>'}
      <h2 class="h2">Your requests</h2>
      <ul class="list">${mine.map((r) => `<li><span>${esc(r.voucher_name)}</span><small>${esc(fmtDay(new Date(r.at)))} · ${r.price} pts</small>${r.status === 'sent' ? pill('Sent', 'ok') : pill('Pending', 'wait')}</li>`).join('') || '<li class="fine">Nothing redeemed yet.</li>'}</ul>`;
  }

  // ------------------------------------------------------------------
  // Me
  // ------------------------------------------------------------------
  function viewMe() {
    const u = me(), g = myGroup(), wk = wkey(now());
    const crunch = isCrunch(u.id, wk), used = crunchUsed(u.id, wk);
    const history = Array.from({ length: 8 }, (_, i) => {
      const ws = addDays(weekStart(now()), -7 * (7 - i)), k = dkey(ws);
      return { k, n: workoutsInWeek(u.id, k).length, c: isCrunch(u.id, k), current: i === 7 };
    });
    const link = `${location.origin}${location.pathname}?join=${g.code}`;
    return `
      <section class="profile">${avatar(u, 64)}<div><h1 class="display sm">${esc(u.name)}</h1><p class="fine">${esc(g.name)} · ${earned(u.id)} pts earned all-time</p></div></section>
      <article class="card">
        <div class="row between"><h3>Streak</h3><p class="big-num sm">${streak(u.id)}<small> weeks</small></p></div>
        <div class="weeks">${history.map((h) => `<div class="wk${h.n >= WEEKLY_GOAL ? ' met' : ''}${h.c ? ' crunch' : ''}${h.current ? ' now' : ''}" title="Week of ${h.k}: ${h.n} workouts${h.c ? ' (crunch)' : ''}"><span style="height:${Math.min(h.n, 4) * 25}%"></span></div>`).join('')}</div>
        <p class="fine">Last 8 weeks. Goal: ${WEEKLY_GOAL} workouts a week. Crunch weeks (striped) pause your streak.</p>
      </article>
      <article class="card">
        <div class="row between"><div><h3>Crunch week</h3><p class="fine">Deadline week? Pause your streak instead of breaking it. ${CRUNCH_PER_MONTH - used} of ${CRUNCH_PER_MONTH} left this month.</p></div>
        <label class="switch"><input type="checkbox" data-act="crunch" ${crunch ? 'checked' : ''} ${!crunch && used >= CRUNCH_PER_MONTH ? 'disabled' : ''}><span></span></label></div>
      </article>
      <article class="card stack">
        <h3>${esc(g.name)}</h3>
        <div class="chips">${members(g.id).map((m) => `<span class="chip">${avatar(m, 22)}<span>${esc(youOr(m.id))}</span></span>`).join('')}</div>
        <p class="fine">Invite code <b class="code">${esc(g.code)}</b>. In this prototype, the link only works in this browser.</p>
        <div class="row wrap"><button class="btn sm" data-act="copy-link" data-link="${esc(link)}">Copy invite link</button>
        ${members(g.id).length < 5 ? `<button class="btn sm" data-act="add-friend">Add a test friend</button>` : ''}</div>
      </article>
      <article class="card stack">
        <h3>Settings</h3>
        <label class="row between"><span>Calm sounds</span><span class="switch"><input type="checkbox" data-act="setting" data-key="sound" ${S.settings.sound ? 'checked' : ''}><span></span></span></label>
        <label class="row between"><span>Session reminders <small class="fine">2h before</small></span><span class="switch"><input type="checkbox" data-act="setting" data-key="reminders" ${S.settings.reminders ? 'checked' : ''}><span></span></span></label>
        <label class="row between"><span>First name</span><input class="inline" data-act="rename" value="${esc(u.name)}" maxlength="24"></label>
      </article>
      <article class="card stack">
        <h3>Privacy</h3>
        <p class="fine">We store only your free/busy hours, workouts, points and rewards. Never calendar event content.</p>
        <div class="row wrap"><button class="btn sm" data-act="export-me">Download my data</button><button class="btn sm danger" data-act="delete-me">Delete my account &amp; data</button></div>
      </article>
      <div class="row wrap center"><button class="btn ghost sm" data-act="switcher">Switch test user</button><button class="btn ghost sm" data-act="tab" data-tab="admin">Admin panel</button></div>`;
  }

  // ------------------------------------------------------------------
  // Admin
  // ------------------------------------------------------------------
  function viewAdmin() {
    const tabs = [['overview', 'Overview'], ['sessions', 'Sessions'], ['points', 'Points'], ['vouchers', 'Rewards'], ['data', 'Export']];
    const body = { overview: adminOverview, sessions: adminSessions, points: adminPoints, vouchers: adminVouchers, data: adminData }[ui.admin]();
    return `<section class="row between"><button class="btn ghost sm" data-act="tab" data-tab="me">‹ Back</button><h1 class="display sm">Admin</h1><span></span></section>
      ${adminClock()}
      <div class="seg tabs scroll">${tabs.map(([k, l]) => `<button class="${ui.admin === k ? 'on' : ''}" data-act="admin-tab" data-k="${k}">${l}</button>`).join('')}</div>
      ${body}`;
  }
  function adminClock() {
    const upcoming = S.sessions.filter((s) => !s.closed).sort((a, b) => sessionStart(a) - sessionStart(b))[0];
    return `<article class="card soft clock">
      <div class="row between"><div><h3>Test clock</h3><p class="fine">${S.offsetMs ? 'Simulated' : 'Real'} time: <b>${esc(fmtWhen(now()))}</b></p></div>${S.offsetMs ? `<button class="btn sm ghost" data-act="time" data-v="reset">Reset</button>` : ''}</div>
      <div class="row wrap"><button class="btn sm" data-act="time" data-v="1h">+1 hour</button><button class="btn sm" data-act="time" data-v="3h">+3 hours</button><button class="btn sm" data-act="time" data-v="1d">+1 day</button><button class="btn sm" data-act="time" data-v="7d">+1 week</button>
      ${upcoming ? `<button class="btn sm primary" data-act="time" data-v="next">Jump to next session</button>` : ''}</div>
    </article>`;
  }
  function table(head, rows) {
    return `<div class="tablewrap"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}" class="fine">Nothing yet</td></tr>`}</tbody></table></div>`;
  }
  function adminOverview() {
    const wk = wkey(now());
    return `<div class="stats">
        <div><b>${S.groups.length}</b><small>groups</small></div><div><b>${S.users.length}</b><small>users</small></div>
        <div><b>${S.sessions.length}</b><small>sessions</small></div><div><b>${S.workouts.length}</b><small>workouts</small></div>
      </div>
      <h2 class="h2">Groups</h2>
      ${table(['Group', 'Code', 'Members', 'Village', 'Group pts'], S.groups.map((g) => [esc(g.name), esc(g.code), members(g.id).length, 'L' + villageLevel(g.id).level, groupEarned(g.id)]))}
      <h2 class="h2">Users</h2>
      ${table(['User', 'Group', 'This wk', 'Streak', 'Balance', 'Earned'], S.users.map((u) => [esc(u.name) + (u.simulated ? ' <small class="fine">test</small>' : ''), esc(groupOf(u.id)?.name || '–'), workoutsInWeek(u.id, wk).length + (isCrunch(u.id, wk) ? ' ⏸' : ''), streak(u.id), balance(u.id), earned(u.id)]))}
      <h2 class="h2">Pending redemptions</h2>
      ${adminRedemptions(true)}`;
  }
  function adminSessions() {
    const today = dkey(now());
    return `<form class="card stack" data-form="admin-session">
        <h3>Create a suggested session</h3>
        <p class="fine">Do the matching by hand: everyone in the group gets an invite.</p>
        <label>Group<select name="group">${S.groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></label>
        <div class="grid2"><label>Date<input type="date" name="date" value="${today}" min="${today}" required></label>
        <label>Start<select name="hour">${GRID_HOURS.map((h) => `<option value="${h}" ${h === 19 ? 'selected' : ''}>${hourLabel(h)}m</option>`).join('')}</select></label></div>
        <div class="grid2"><label>Activity${activitySelect('activity', 'walk')}</label>
        <label>Minutes<select name="minutes">${[20, 30, 45, 60, 90].map((m) => `<option ${m === 45 ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
        <button class="btn primary">Send invites</button>
      </form>
      <h2 class="h2">All sessions</h2>
      ${table(['When', 'Group', 'Activity', 'Source', 'People', 'Bonus'], S.sessions.slice().sort((a, b) => sessionStart(b) - sessionStart(a)).map((s) => [
        esc(fmtWhen(sessionStart(s))), esc(S.groups.find((g) => g.id === s.group_id)?.name || '–'), esc(ACTIVITIES[s.activity].label) + ` <small class="fine">${s.minutes}m</small>`, s.source,
        parts(s.id).map((p) => `${esc(nameOf(p.user_id))}: ${p.checked_in_at ? '✔ in' : p.status}`).join('<br>'),
        s.bonus_awarded ? '2x' : s.closed ? 'no' : 'open',
      ]))}
      <h2 class="h2">Check-ins &amp; workouts</h2>
      ${table(['When', 'User', 'Type', 'Workout', 'Base pts'], S.workouts.slice().reverse().slice(0, 60).map((w) => [esc(fmtWhen(new Date(w.at))), esc(nameOf(w.user_id)), w.kind, esc(w.label) + ` · ${w.minutes}m · ${INTENSITY[w.intensity].label}`, w.base_points]))}`;
  }
  function adminPoints() {
    return table(['When', 'User', 'Pts', 'Reason', 'Note'], S.points_ledger.slice().reverse().slice(0, 100).map((l) => [esc(fmtWhen(new Date(l.at))), esc(nameOf(l.user_id)), `<b class="${l.amount < 0 ? 'neg' : 'pos'}">${l.amount > 0 ? '+' : ''}${l.amount}</b>`, l.reason, esc(l.note)]));
  }
  function adminRedemptions(pendingOnly) {
    const rs = S.redemptions.filter((r) => !pendingOnly || r.status === 'pending').slice().reverse();
    return table(['When', 'User', 'Reward', 'Pts', 'Status'], rs.map((r) => [esc(fmtDay(new Date(r.at))), esc(nameOf(r.user_id)), esc(r.voucher_name), r.price, r.status === 'pending' ? `<button class="btn sm primary" data-act="fulfil" data-id="${r.id}">Mark sent</button>` : `sent ${esc(fmtDay(new Date(r.sent_at)))}`]));
  }
  function adminVouchers() {
    return `<h2 class="h2">Voucher catalogue</h2>
      ${S.vouchers.map((v) => `<form class="card voucher-edit" data-form="voucher" data-id="${v.id}">
        <input name="name" value="${esc(v.name)}" required aria-label="Name">
        <input name="desc" value="${esc(v.desc)}" aria-label="Description">
        <div class="row"><input name="price" type="number" min="1" value="${v.price}" required aria-label="Price in points"><label class="check"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> Active</label><button class="btn sm">Save</button><button type="button" class="btn sm ghost danger" data-act="del-voucher" data-id="${v.id}">Delete</button></div>
      </form>`).join('')}
      <form class="card voucher-edit" data-form="voucher" data-id="">
        <h3>Add a reward</h3>
        <input name="name" placeholder="Name, e.g. Smoothie voucher" required>
        <input name="desc" placeholder="Short description">
        <div class="row"><input name="price" type="number" min="1" placeholder="Points" required><label class="check"><input type="checkbox" name="active" checked> Active</label><button class="btn sm primary">Add</button></div>
      </form>
      <h2 class="h2">Redemptions</h2>
      ${adminRedemptions(false)}`;
  }
  function adminData() {
    return `<article class="card stack">
        <h3>Experiment metrics (CSV)</h3>
        <button class="btn" data-act="csv" data-k="workouts">Workouts per user per week</button>
        <button class="btn" data-act="csv" data-k="invites">Invite acceptance rate</button>
        <button class="btn" data-act="csv" data-k="showup">Show-up rate</button>
        <button class="btn" data-act="csv" data-k="retention">Retention by week</button>
        <p class="fine">Covers data in this browser. To combine testers' phones, ask each for a JSON backup.</p>
      </article>
      <article class="card stack">
        <h3>Backup</h3>
        <div class="row wrap"><button class="btn sm" data-act="export-all">Download JSON backup</button>
        <label class="btn sm">Restore from JSON<input type="file" accept="application/json" data-act="import" hidden></label></div>
      </article>
      <article class="card stack">
        <h3>Reset</h3>
        <p class="fine">Wipes every user, group and point in this browser.</p>
        <button class="btn sm danger" data-act="reset-all">Reset prototype</button>
      </article>`;
  }

  // ------------------------------------------------------------------
  // CSV exports
  // ------------------------------------------------------------------
  function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
  function download(name, text, type = 'text/csv') {
    const blob = new Blob([text], { type }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function weeksBetween(a, b) { const out = []; for (let w = weekStart(a); w <= b; w = addDays(w, 7)) out.push(dkey(w)); return out; }
  const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : '');

  const CSV = {
    workouts() {
      const rows = [['week_start', 'user', 'group', 'workouts', 'session_workouts', 'micro_workouts', 'met_goal', 'crunch_week', 'points_earned']];
      S.users.forEach((u) => weeksBetween(new Date(u.created_at), now()).forEach((wk) => {
        const ws = workoutsInWeek(u.id, wk);
        const pts = S.points_ledger.filter((l) => l.user_id === u.id && l.amount > 0 && wkey(new Date(l.at)) === wk).reduce((a, l) => a + l.amount, 0);
        rows.push([wk, u.name, groupOf(u.id)?.name || '', ws.length, ws.filter((w) => w.kind === 'session').length, ws.filter((w) => w.kind === 'micro').length, ws.length >= WEEKLY_GOAL ? 1 : 0, isCrunch(u.id, wk) ? 1 : 0, pts]);
      }));
      return rows;
    },
    invites() {
      const rows = [['week_start', 'user', 'invites_received', 'accepted', 'declined', 'no_response', 'acceptance_rate_pct']];
      const inv = S.session_participants.map((p) => ({ p, s: S.sessions.find((s) => s.id === p.session_id) })).filter(({ p, s }) => s && s.created_by !== p.user_id && p.status !== 'invited');
      const add = (wk, name, list) => {
        const acc = list.filter(({ p }) => p.status === 'accepted').length, dec = list.filter(({ p }) => p.status === 'declined').length, no = list.filter(({ p }) => p.status === 'expired').length;
        rows.push([wk, name, list.length, acc, dec, no, pct(acc, list.length)]);
      };
      [...new Set(inv.map(({ s }) => wkey(sessionStart(s))))].sort().forEach((wk) => {
        const w = inv.filter(({ s }) => wkey(sessionStart(s)) === wk);
        S.users.forEach((u) => { const l = w.filter(({ p }) => p.user_id === u.id); if (l.length) add(wk, u.name, l); });
        add(wk, 'ALL', w);
      });
      add('ALL', 'ALL', inv);
      return rows;
    },
    showup() {
      const rows = [['week_start', 'user', 'accepted_sessions', 'showed_up', 'show_up_rate_pct', 'buddy_bonus_sessions']];
      const acc = S.session_participants.map((p) => ({ p, s: S.sessions.find((s) => s.id === p.session_id) })).filter(({ p, s }) => s && p.status === 'accepted' && (s.closed || p.checked_in_at));
      const add = (wk, name, list) => {
        const came = list.filter(({ p }) => p.checked_in_at).length;
        rows.push([wk, name, list.length, came, pct(came, list.length), list.filter(({ s }) => s.bonus_awarded).length]);
      };
      [...new Set(acc.map(({ s }) => wkey(sessionStart(s))))].sort().forEach((wk) => {
        const w = acc.filter(({ s }) => wkey(sessionStart(s)) === wk);
        S.users.forEach((u) => { const l = w.filter(({ p }) => p.user_id === u.id); if (l.length) add(wk, u.name, l); });
        add(wk, 'ALL', w);
      });
      add('ALL', 'ALL', acc);
      return rows;
    },
    retention() {
      const rows = [['cohort_week', 'week_offset', 'week_start', 'cohort_size', 'active_users', 'retention_pct']];
      const cohorts = {};
      S.users.forEach((u) => { const k = wkey(new Date(u.created_at)); (cohorts[k] = cohorts[k] || []).push(u); });
      Object.keys(cohorts).sort().forEach((ck) => {
        weeksBetween(parseKey(ck), now()).forEach((wk, i) => {
          const active = cohorts[ck].filter((u) => workoutsInWeek(u.id, wk).length > 0).length;
          rows.push([ck, i, wk, cohorts[ck].length, active, pct(active, cohorts[ck].length)]);
        });
      });
      return rows;
    },
  };

  // ------------------------------------------------------------------
  // Modals
  // ------------------------------------------------------------------
  function renderModal() {
    let root = document.getElementById('modal');
    if (!root) { root = document.createElement('div'); root.id = 'modal'; document.body.appendChild(root); }
    const m = ui.modal;
    if (!m) { root.innerHTML = ''; document.body.classList.remove('modal-open'); return; }
    document.body.classList.add('modal-open');
    root.innerHTML = `<div class="scrim" data-act="close"></div><div class="sheet ${m.kind}" role="dialog" aria-modal="true">${modalBody(m)}</div>`;
    const f = root.querySelector('[autofocus]'); if (f) f.focus();
    const calc = root.querySelector('form[data-form="checkin"], form[data-form="micro"]'); if (calc) updateCalc(calc);
  }
  function modalBody(m) {
    if (m.kind === 'celebrate') {
      return `<div class="confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i};--x:${(i * 37) % 100}%;--c:${COLORS[i % COLORS.length]}"></i>`).join('')}</div>
        <div class="celebrate-body">
          <p class="cele-icon">${m.icon || '🌟'}</p>
          <h2 class="display sm">${esc(m.title)}</h2>
          ${m.points != null ? `<p class="cele-pts">+${m.points}<small> pts</small></p>` : ''}
          ${(m.lines || []).map((l) => `<p class="fine">${l}</p>`).join('')}
          <button class="btn primary big" data-act="close" autofocus>${esc(m.cta || 'Lovely')}</button>
        </div>`;
    }
    if (m.kind === 'checkin') {
      const s = S.sessions.find((x) => x.id === m.id);
      return `<h2 class="display sm">Check in</h2>
        <p class="fine">${actLabel(s)} · ${esc(fmtWhen(sessionStart(s)))}</p>
        <form data-form="checkin" data-id="${s.id}" class="stack">
          <label>What did you do?${activitySelect('activity', s.activity)}</label>
          <label>Minutes<input type="number" name="minutes" min="5" max="240" value="${s.minutes}" required></label>
          <fieldset><legend>How hard did it feel?</legend>${intensityPicker('intensity', s.intensity)}</fieldset>
          <p class="fine calc" data-calc></p>
          <button class="btn primary big">Check in</button>
        </form>`;
    }
    if (m.kind === 'micro') {
      return `<h2 class="display sm">Micro-workout</h2>
        <p class="fine">Five to fifteen minutes counts. Same points formula, no buddy bonus.</p>
        <div class="presets">${MICRO_PRESETS.map((p, i) => `<button class="btn sm ${i === (m.preset ?? 0) ? 'primary' : ''}" data-act="micro-preset" data-i="${i}">${esc(p.label)}</button>`).join('')}</div>
        ${(() => {
          const p = MICRO_PRESETS[m.preset ?? 0];
          return `<form data-form="micro" class="stack">
            <label>What was it?<input name="label" value="${esc(p.label)}" maxlength="60" required></label>
            <input type="hidden" name="activity" value="${p.activity}">
            <label>Minutes <small class="fine">(5–15)</small><input type="number" name="minutes" min="5" max="15" value="${p.minutes}" required></label>
            <fieldset><legend>Intensity</legend>${intensityPicker('intensity', p.intensity)}</fieldset>
            <p class="fine calc" data-calc></p>
            <button class="btn primary big">Log it</button>
          </form>`;
        })()}`;
    }
    if (m.kind === 'invite') {
      const s = m.slot, g = myGroup(), size = members(g.id).length;
      const maxMin = Math.min(90, s.hours * 60);
      return `<h2 class="display sm">Invite friends</h2>
        <p class="fine">${esc(fmtWhen(s.start))}</p>
        <form data-form="invite" class="stack">
          <label>Activity${activitySelect('activity', s.activity)}</label>
          <label>Minutes<select name="minutes">${[30, 45, 60, 90].filter((x) => x <= maxMin).map((x) => `<option ${x === Math.min(45, maxMin) ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <fieldset><legend>Who's invited</legend>${members(g.id).filter((u) => u.id !== S.currentUserId).map((u) => `<label class="check">${avatar(u, 22)}<input type="checkbox" name="who" value="${u.id}" ${s.who.includes(u.id) ? 'checked' : ''}> ${esc(u.name)} <small class="fine">${s.who.includes(u.id) ? 'free' : 'may be busy'}</small></label>`).join('')}</fieldset>
          <button class="btn primary big">Send invite</button>
        </form>`;
    }
    if (m.kind === 'switcher') {
      const g = myGroup();
      return `<h2 class="display sm">Who's using the app?</h2>
        <p class="fine">Prototype: test friends live on this device. Switch to accept invites and check in as them.</p>
        <ul class="list pick">${S.users.map((u) => `<li><button data-act="switch" data-id="${u.id}" class="${u.id === S.currentUserId ? 'on' : ''}">${avatar(u, 36)}<span>${esc(u.name)}<small>${esc(groupOf(u.id)?.name || 'No group')}</small></span>${u.id === S.currentUserId ? pill('Current', 'ok') : ''}</button></li>`).join('')}</ul>
        <div class="row wrap">${g && members(g.id).length < 5 ? `<button class="btn sm" data-act="add-friend">Add a test friend</button>` : ''}<button class="btn sm ghost" data-act="new-user">New person on this device</button></div>`;
    }
    if (m.kind === 'add-friend') {
      return `<h2 class="display sm">Add a test friend</h2>
        <p class="fine">They'll get a few random free hours you can edit by switching to them.</p>
        <form data-form="add-friend" class="stack"><input name="name" placeholder="Friend's first name" maxlength="24" required autofocus><button class="btn primary big">Add to group</button></form>`;
    }
    if (m.kind === 'confirm') {
      return `<h2 class="display sm">${esc(m.title)}</h2><p>${m.text}</p>
        <div class="row"><button class="btn ${m.danger ? 'danger' : 'primary'}" data-act="confirm-yes">${esc(m.yes || 'Yes')}</button><button class="btn ghost" data-act="close">Cancel</button></div>`;
    }
    return '';
  }

  function celebrate(opts) { chime(opts.sound || 'success'); openModal({ kind: 'celebrate', ...opts }); }

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------
  const A = {
    tab: (d) => { closeModal(); setTab(d.tab); },
    plan: (d) => { ui.tab = 'plan'; ui.plan = d.plan; render(); window.scrollTo(0, 0); },
    week: (d) => { ui.weekOffset = Math.max(0, Math.min(2, ui.weekOffset + +d.d)); render(); },
    'admin-tab': (d) => { ui.admin = d.k; render(); },
    close: () => closeModal(),
    ob: (d) => { ui.onboard = { step: d.step }; render(); },
    'ob-consent': () => {
      if (!document.getElementById('consent').checked) return toast('Please tick the box to continue.');
      ui.onboard = { step: 'name', consent: true }; render();
    },
    'ob-demo': () => {
      const g = createGroup('Sunday Strollers', S.currentUserId);
      DEMO_FRIENDS.forEach((f) => addTestFriend(g.id, f.name, f.template));
      finishOnboarding();
    },
    'ob-join': (d) => { const g = S.groups.find((x) => x.code === d.code); if (g) { joinGroup(S.currentUserId, g.id); post(g.id, `${me().name} joined the group.`, { icon: '👋' }); finishOnboarding(); } },
    switcher: () => openModal({ kind: 'switcher' }),
    switch: (d) => { S.currentUserId = d.id; ui.onboard = null; save(); closeModal(); chime('tap'); toast(`Now using the app as ${me().name}`); setTab('home'); },
    'new-user': () => { closeModal(); ui.onboard = { step: 'consent', newUser: true }; render(); },
    'add-friend': () => openModal({ kind: 'add-friend' }),
    respond: (d) => {
      respond(d.id, S.currentUserId, d.yes === '1'); save(); chime(d.yes === '1' ? 'success' : 'soft');
      toast(d.yes === '1' ? "You're in! We'll remind you 2 hours before." : 'No problem. Maybe next time.'); render();
    },
    checkin: (d) => openModal({ kind: 'checkin', id: d.id }),
    micro: () => openModal({ kind: 'micro', preset: 0 }),
    'micro-preset': (d) => openModal({ kind: 'micro', preset: +d.i }),
    invite: (d) => { const sug = suggestions(myGroup().id, S.currentUserId); if (sug[+d.i]) openModal({ kind: 'invite', slot: sug[+d.i] }); },
    cell: (d) => {
      const ws = addDays(weekStart(now()), ui.weekOffset * 7);
      toggleFree(S.currentUserId, dkey(ws), +d.day, +d.hour); save(); chime('tap'); render();
    },
    'copy-week': () => {
      const ws = addDays(weekStart(now()), ui.weekOffset * 7), prev = dkey(addDays(ws, -7)), cur = dkey(ws);
      const src = S.availability_blocks.filter((b) => b.user_id === S.currentUserId && b.week_start === prev);
      if (!src.length) return toast('Nothing to copy from last week.');
      src.forEach((b) => toggleFree(S.currentUserId, cur, b.day, b.hour, true)); save(); render(); toast('Copied last week\'s free hours.');
    },
    'clear-week': () => {
      const wk = dkey(addDays(weekStart(now()), ui.weekOffset * 7));
      S.availability_blocks = S.availability_blocks.filter((b) => !(b.user_id === S.currentUserId && b.week_start === wk)); save(); render();
    },
    buy: (d) => {
      const it = VILLAGE_ITEMS.find((i) => i.id === d.item), g = myGroup();
      if (villageLevel(g.id).level < it.level) return toast(`Unlocks at village level ${it.level}.`);
      if (balance(S.currentUserId) < it.price) return toast(`You need ${it.price - balance(S.currentUserId)} more points.`);
      const p = buyItem(S.currentUserId, it.id); save();
      ui.placing = p.id; ui.sel = null; chime('success'); render(); toast(`Tap a tile to place your ${it.name.toLowerCase()}.`);
    },
    place: (d) => { ui.placing = d.id; ui.sel = null; render(); },
    'cancel-place': () => { ui.placing = null; render(); },
    deselect: () => { ui.sel = null; render(); },
    'store-item': () => { const p = S.placed_items.find((x) => x.id === ui.sel); if (p) { p.x = p.y = null; save(); } ui.sel = null; render(); },
    redeem: (d) => {
      const v = S.vouchers.find((x) => x.id === d.id);
      openModal({ kind: 'confirm', title: `Redeem ${v.name}?`, text: `This uses <b>${v.price}</b> of your ${balance(S.currentUserId)} points. We'll email your voucher once it's sent.`, yes: 'Redeem', run: () => {
        if (redeem(S.currentUserId, v.id)) { save(); render(); celebrate({ title: 'Request sent!', icon: '🎁', lines: [`${esc(v.name)} is on its way. You'll see it marked "Sent" here.`] }); }
      } });
    },
    'confirm-yes': () => { const run = ui.modal?.run; closeModal(); if (run) run(); },
    crunch: (d, el) => {
      const wk = wkey(now());
      if (el.checked) {
        if (crunchUsed(S.currentUserId, wk) >= CRUNCH_PER_MONTH) { el.checked = false; return toast('You\'ve used both crunch weeks this month.'); }
        S.crunch_weeks.push({ user_id: S.currentUserId, week_start: wk }); toast('Crunch week on. Your streak is paused, not broken. Look after yourself.');
      } else S.crunch_weeks = S.crunch_weeks.filter((c) => !(c.user_id === S.currentUserId && c.week_start === wk));
      save(); render();
    },
    setting: (d, el) => {
      S.settings[d.key] = el.checked; save();
      if (d.key === 'reminders' && el.checked && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      if (d.key === 'sound' && el.checked) chime('tap');
    },
    'copy-link': (d) => { navigator.clipboard?.writeText(d.link).then(() => toast('Invite link copied.'), () => toast(d.link)); },
    'export-me': () => {
      const id = S.currentUserId, out = { user: me() };
      ['availability_blocks', 'session_participants', 'workouts', 'points_ledger', 'redemptions', 'crunch_weeks'].forEach((t) => (out[t] = S[t].filter((r) => r.user_id === id)));
      download('exercisefolks-my-data.json', JSON.stringify(out, null, 2), 'application/json');
    },
    'delete-me': () => openModal({ kind: 'confirm', danger: true, title: 'Delete your account?', text: 'This removes your profile, free/busy hours, workouts, points and reward requests from this device. It can\'t be undone.', yes: 'Delete everything', run: () => {
      const id = S.currentUserId;
      S.users = S.users.filter((u) => u.id !== id);
      ['group_members', 'availability_blocks', 'session_participants', 'workouts', 'points_ledger', 'redemptions', 'crunch_weeks'].forEach((t) => (S[t] = S[t].filter((r) => r.user_id !== id)));
      S.feed = S.feed.filter((f) => !(f.user_ids || []).includes(id));
      S.currentUserId = S.users[0]?.id || null; ui.onboard = S.currentUserId ? null : { step: 'welcome' };
      save(); ui.tab = 'home'; render(); toast('Your account and data were deleted.');
    } }),
    time: (d) => {
      const step = { '1h': HOUR, '3h': 3 * HOUR, '1d': DAY, '7d': 7 * DAY }[d.v];
      if (d.v === 'reset') S.offsetMs = 0;
      else if (d.v === 'next') {
        const s = S.sessions.filter((x) => !x.closed && sessionStart(x).getTime() > nowMs()).sort((a, b) => sessionStart(a) - sessionStart(b))[0];
        if (s) S.offsetMs += sessionStart(s).getTime() + 5 * MIN - nowMs();
        else return toast('No upcoming session to jump to.');
      } else S.offsetMs += step;
      save(); render(); checkReminders();
    },
    fulfil: (d) => { const r = S.redemptions.find((x) => x.id === d.id); r.status = 'sent'; r.sent_at = new Date(nowMs()).toISOString(); save(); render(); toast('Marked as sent.'); },
    'del-voucher': (d) => { S.vouchers = S.vouchers.filter((v) => v.id !== d.id); save(); render(); },
    csv: (d) => { download(`exercisefolks-${d.k}-${dkey(now())}.csv`, CSV[d.k]().map((r) => r.map(csvCell).join(',')).join('\n') + '\n'); },
    'export-all': () => download(`exercisefolks-backup-${dkey(now())}.json`, JSON.stringify(S, null, 2), 'application/json'),
    'reset-all': () => openModal({ kind: 'confirm', danger: true, title: 'Reset the prototype?', text: 'Every user, group, session and point in this browser will be wiped.', yes: 'Reset', run: () => {
      S = blankState(); save(); ui.onboard = { step: 'welcome' }; ui.tab = 'home'; render();
    } }),
  };

  function finishOnboarding() {
    ui.onboard = null; save(); ui.tab = 'plan'; ui.plan = 'week'; render();
    toast('Now tap the hours you\'re free this week.');
  }

  const F = {
    'ob-name': (fd) => {
      const u = addUser(fd.get('name'), { consent: true });
      S.currentUserId = u.id; save();
      ui.onboard = { step: 'group' }; render();
    },
    'ob-create': (fd) => { createGroup(fd.get('gname'), S.currentUserId); finishOnboarding(); },
    'ob-joincode': (fd) => {
      const g = S.groups.find((x) => x.code === String(fd.get('code')).trim().toUpperCase());
      if (!g) return toast('No group with that code on this device.');
      if (members(g.id).length >= 5) return toast('That group is full (5 friends max).');
      joinGroup(S.currentUserId, g.id); post(g.id, `${me().name} joined the group.`, { icon: '👋' }); finishOnboarding();
    },
    checkin: (fd, form) => {
      const r = checkIn(form.dataset.id, S.currentUserId, { activity: fd.get('activity'), minutes: +fd.get('minutes'), intensity: +fd.get('intensity') });
      if (!r) { closeModal(); return toast('Check-in window has closed for this session.'); }
      save(); render();
      const i = INTENSITY[r.workout.intensity];
      const lines = [`${r.workout.minutes} min × ${i.mult} (${i.label}) = ${r.base} pts`];
      if (r.bonus) lines.push(`<b>Buddy bonus!</b> Everyone showed up, so it's doubled to ${r.base * 2}.`);
      else if (r.waiting.length) lines.push(`2x buddy bonus unlocks when ${esc(joinList(r.waiting.map(nameOf)))} check${r.waiting.length > 1 ? '' : 's'} in.`);
      celebrate({ title: r.bonus ? 'Better together!' : 'Checked in!', icon: r.bonus ? '🎉' : '🌟', points: r.bonus ? r.base * 2 : r.base, lines, sound: r.bonus ? 'big' : 'success' });
    },
    micro: (fd) => {
      const r = logMicro(S.currentUserId, { label: String(fd.get('label')).trim() || 'Micro-workout', activity: fd.get('activity'), minutes: +fd.get('minutes'), intensity: +fd.get('intensity') });
      save(); render();
      const i = INTENSITY[r.workout.intensity];
      celebrate({ title: 'Every minute counts', icon: '⚡', points: r.base, lines: [`${r.workout.minutes} min × ${i.mult} (${i.label}) = ${r.base} pts`] });
    },
    invite: (fd) => {
      const slot = ui.modal.slot, who = fd.getAll('who');
      if (!who.length) return toast('Pick at least one friend.');
      const s = createSession({ groupId: myGroup().id, start: slot.start, minutes: +fd.get('minutes'), activity: fd.get('activity'), createdBy: S.currentUserId, invitees: who });
      save(); closeModal(); ui.plan = 'sessions'; render(); chime('success');
      toast(`Invite sent to ${joinList(who.map(nameOf))}.`);
      return s;
    },
    'add-friend': (fd) => {
      const g = myGroup();
      if (members(g.id).length >= 5) return toast('Groups are 2 to 5 friends.');
      const u = addTestFriend(g.id, fd.get('name')); save(); closeModal(); render(); toast(`${u.name} joined ${g.name}.`);
    },
    'admin-session': (fd) => {
      const g = fd.get('group'), d = parseKey(fd.get('date')); d.setHours(+fd.get('hour'), 0, 0, 0);
      if (d.getTime() <= nowMs()) return toast('Pick a time in the future.');
      createSession({ groupId: g, start: d, minutes: +fd.get('minutes'), activity: fd.get('activity'), createdBy: 'admin', invitees: members(g).map((u) => u.id), source: 'admin' });
      save(); render(); toast('Session created. Everyone in the group has an invite.');
    },
    voucher: (fd, form) => {
      const v = { name: String(fd.get('name')).trim(), desc: String(fd.get('desc') || '').trim(), price: Math.max(1, +fd.get('price')), active: fd.get('active') === 'on' };
      if (form.dataset.id) Object.assign(S.vouchers.find((x) => x.id === form.dataset.id), v);
      else S.vouchers.push({ id: uid(), ...v });
      save(); render(); toast('Rewards saved.');
    },
  };

  // Village taps
  function villageTap(target) {
    const g = myGroup(), v = villageLevel(g.id);
    const itemEl = target.closest('[data-placed]'), tile = target.closest('.tile');
    if (ui.placing) {
      let x, y;
      if (tile) { x = +tile.dataset.x; y = +tile.dataset.y; } else return;
      if (occupied(g.id, x, y, ui.placing)) return toast('That spot is taken. Try an empty tile.');
      const p = S.placed_items.find((i) => i.id === ui.placing); p.x = x; p.y = y;
      ui.placing = null; save(); chime('soft'); render(); return;
    }
    if (itemEl) {
      const id = itemEl.dataset.placed;
      ui.sel = ui.sel === id ? null : id; chime('tap'); render(); return;
    }
    if (tile && ui.sel) {
      const x = +tile.dataset.x, y = +tile.dataset.y;
      if (x >= v.size || y >= v.size || occupied(g.id, x, y, ui.sel)) return;
      const p = S.placed_items.find((i) => i.id === ui.sel); p.x = x; p.y = y; save(); chime('soft'); render();
    }
  }

  document.addEventListener('click', (e) => {
    const vil = e.target.closest('.view-village svg.village.interactive');
    if (vil) { villageTap(e.target); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    const fn = A[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset, el); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.act === 'crunch' || el.dataset.act === 'setting') A[el.dataset.act](el.dataset, el);
    if (el.dataset.act === 'rename') { const v = el.value.trim(); if (v) { me().name = v; save(); toast('Name updated.'); } }
    if (el.dataset.act === 'import' && el.files[0]) {
      el.files[0].text().then((t) => {
        try { const s = JSON.parse(t); if (!s.users || !s.groups) throw new Error('bad'); S = Object.assign(blankState(), s); save(); render(); toast('Backup restored.'); }
        catch (err) { toast('That file isn\'t an ExerciseFolks backup.'); }
      });
    }
  });
  document.addEventListener('input', (e) => { if (e.target.closest('[data-form="checkin"],[data-form="micro"]')) updateCalc(e.target.closest('form')); });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]'); if (!form) return;
    e.preventDefault();
    const fn = F[form.dataset.form]; if (fn) fn(new FormData(form), form);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.modal) closeModal(); });

  function updateCalc(form) {
    const out = form.querySelector('[data-calc]'); if (!out) return;
    const fd = new FormData(form), m = +fd.get('minutes') || 0, i = INTENSITY[+fd.get('intensity')] || INTENSITY[2];
    const lim = form.dataset.form === 'micro' ? Math.max(5, Math.min(15, m)) : m;
    out.innerHTML = `${lim} min × ${i.mult} = <b>${lim * i.mult} pts</b>${form.dataset.form === 'checkin' ? ' · doubled if everyone shows up' : ''}`;
  }
  // ------------------------------------------------------------------
  // Reminders (in-app banner always; system notification when allowed)
  // ------------------------------------------------------------------
  function checkReminders() {
    const t = nowMs();
    S.users.forEach((u) => mySessions(u.id, (s, p) => p.status === 'accepted' && !s.closed && !p.checked_in_at).forEach((s) => {
      const a = sessionStart(s).getTime(), k = `${s.id}|${u.id}`;
      if (a > t && a - t <= REMIND_BEFORE && !S.reminders_sent.includes(k)) {
        S.reminders_sent.push(k); save();
        if (u.id === S.currentUserId && S.settings.reminders && 'Notification' in window && Notification.permission === 'granted') {
          const body = `${ACTIVITIES[s.activity].label} at ${fmtTime(new Date(a))} with ${joinList(parts(s.id).filter((p) => p.user_id !== u.id && p.status === 'accepted').map((p) => nameOf(p.user_id))) || 'your friends'}`;
          navigator.serviceWorker?.ready.then((r) => r.showNotification('ExerciseFolks', { body, icon: 'icon-192.png', tag: k })).catch(() => {});
        }
      }
    }));
  }
  setInterval(() => { if (resolveSessions() && !ui.modal) render(); checkReminders(); }, 30e3);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

  // Expose the engine for automated checks.
  window.EF = { get S() { return S; }, points, checkIn, logMicro, respond, createSession, resolveSessions, suggestions, streak, buyItem, redeem, balance, CSV, villageLevel, render };

  render();
  checkReminders();
})();
