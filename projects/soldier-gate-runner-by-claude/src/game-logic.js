/* Pure game logic. Road coordinates: u in [-1,1] across the road, d in [0,1+] from the squad (0) to the far end (1 = visible limit). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GameLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var C = { HORIZON: 0.35, TOP_HALF: 0.08, BOTTOM_HALF: 0.45, U_LIMIT: 0.97, SPEED: 0.14, STOP_D: 0.3,
    FIRE_RANGE: 1.0, ENEMY_RANGE: 0.75, BULLET_SPEED: 1.3, FIRE_INTERVAL: 0.18, SHOOTERS_MAX: 24, START_COUNT: 12, ENEMY_DPS: 0.8,
    TANK_TIME: 8, POWER_TIME: 8, TANK_SHELL_W: 12, TANK_INTERVAL: 0.35, CRATE_PENALTY: 8, MUL_STEP: 25, MUL_MAX: 5 };

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function roadHalfWidth(v) { return C.TOP_HALF + (C.BOTTOM_HALF - C.TOP_HALF) * v; }
  function toScreen(u, d, w, h) {
    var v = 1 - clamp(d, 0, 1);
    return { x: w / 2 + u * roadHalfWidth(v) * w, y: h * (C.HORIZON + (1 - C.HORIZON) * v), scale: 0.25 + 0.75 * v };
  }
  function dims(count) {
    var cols = Math.min(Math.ceil(Math.sqrt(count * 1.6)), 9), rows = Math.max(1, Math.ceil(count / cols));
    return { cols: cols, rows: rows, rowStep: Math.min(0.045, 0.26 / rows) };
  }
  // Depth (d) of the front row of the squad. Gates make contact here, not at the rear.
  function frontD(count) { var m = dims(count); return (m.rows - 1) * m.rowStep; }
  function layout(count, centerU) {
    var m = dims(count), du = m.cols > 1 ? Math.min(0.14, 1.6 / (m.cols - 1)) : 0, out = [];
    for (var i = 0; i < count; i++) {
      var r = Math.floor(i / m.cols), c = i % m.cols, inRow = Math.min(m.cols, count - r * m.cols);
      var u = centerU + (c - (inRow - 1) / 2) * du + (r % 2 ? 0.25 : -0.25) * du;
      out.push({ u: clamp(u, -C.U_LIMIT, C.U_LIMIT), d: (m.rows - 1 - r) * m.rowStep });
    }
    return out;
  }

  function isShootable(g) { return g.type === 'shoot' || g.type === 'shootmul' || g.type === 'shootsub' || g.type === 'crate'; }
  function mulOf(g) { return Math.min(C.MUL_MAX, 1 + Math.floor(g.hits / C.MUL_STEP)); }
  function isOpen(g) {
    if (g.done) return false;
    if (g.type === 'shoot') return g.base + g.hits < g.max;
    if (g.type === 'shootmul') return g.hits < g.max;
    if (g.type === 'shootsub') return g.hits < g.base;
    if (g.type === 'crate') return !g.broken;
    return false;
  }
  function gateValue(g) {
    if (g.type === 'shoot') return g.base + g.hits;
    if (g.type === 'shootmul') return mulOf(g);
    if (g.type === 'shootsub') return g.base - g.hits;
    if (g.type === 'crate') return Math.max(0, g.need - g.hits);
    return g.value;
  }
  function grantPower(s, kind) { s.power = { kind: kind, t: kind === 'tank' ? C.TANK_TIME : C.POWER_TIME }; }
  function applyGate(g, count) {
    if (g.type === 'add') return count + g.value;
    if (g.type === 'sub') return Math.max(0, count - g.value);
    if (g.type === 'mul') return Math.floor(count * g.value);
    if (g.type === 'div') return Math.max(1, Math.floor(count / g.value));
    if (g.type === 'pct') return Math.max(0, Math.round(count * (1 + g.value / 100)));
    if (g.type === 'shoot') return count + g.base + g.hits;
    if (g.type === 'shootmul') return Math.floor(count * mulOf(g));
    if (g.type === 'shootsub') return Math.max(0, count - (g.base - g.hits));
    if (g.type === 'crate') return Math.max(0, count - C.CRATE_PENALTY); // contact with an unbroken crate
    return count;
  }
  function addHits(s, g, w) {
    if (g.type === 'shoot') g.hits = Math.min(g.max - g.base, g.hits + w);
    else if (g.type === 'shootmul') g.hits = Math.min(g.max, g.hits + w);
    else if (g.type === 'shootsub') g.hits = Math.min(g.base, g.hits + w);
    else if (g.type === 'crate') {
      g.hits = Math.min(g.need, g.hits + w);
      if (g.hits >= g.need && !g.broken) {
        g.broken = true; g.done = true;
        var reward = g.reward || 'tank';
        if (reward === 'soldiers') s.count += g.amount; else grantPower(s, reward);
      }
    }
  }

  function createState() {
    // Order along the road (d = distance ahead). Every gate sits well before the next enemy so none is stuck behind a blocking enemy.
    return { status: 'ready', t: 0, count: C.START_COUNT, u: 0, cool: 0, tcool: 0, hurt: 0, bullets: [], progress: 0, power: null,
      gates: [
        { type: 'add', value: 10, u: -0.5, d: 0.9, half: 0.45 }, { type: 'mul', value: 2, u: 0.5, d: 0.9, half: 0.45 },
        { type: 'shoot', base: 1, hits: 0, max: 30, u: 0, d: 1.35, half: 0.4 },
        { type: 'crate', reward: 'tank', need: 500, hits: 0, u: 0, d: 2.4, half: 0.35 },
        { type: 'pct', value: 40, u: -0.5, d: 2.9, half: 0.45 }, { type: 'power', kind: 'rapid', u: 0.5, d: 2.9, half: 0.45 },
        { type: 'shootmul', hits: 0, max: (C.MUL_MAX - 1) * C.MUL_STEP, u: 0, d: 3.4, half: 0.4 },
        { type: 'crate', reward: 'soldiers', amount: 25, need: 200, hits: 0, u: -0.5, d: 4.4, half: 0.3 },
        { type: 'shootsub', base: 25, hits: 0, u: 0.5, d: 4.4, half: 0.4 },
        { type: 'sub', value: 8, u: -0.5, d: 4.9, half: 0.45 }, { type: 'pct', value: -20, u: 0.5, d: 4.9, half: 0.45 }],
      enemies: [{ id: 'e1', hp: 24, max: 24, u: -0.3, d: 1.9, boss: false }, { id: 'e2', hp: 40, max: 40, u: 0.35, d: 3.9, boss: false },
        { id: 'boss', hp: 220, max: 220, u: 0, d: 5.6, boss: true }] };
  }
  function start(s) { s.status = 'playing'; return s; }

  function target(s) {
    var best = null;
    s.enemies.forEach(function (e) { if (e.hp > 0 && e.d <= C.FIRE_RANGE && (!best || e.d < best.d)) best = { u: e.u, d: e.d, kind: 'enemy', ref: e }; });
    s.gates.forEach(function (g) { if (isShootable(g) && isOpen(g) && g.d <= C.FIRE_RANGE && (!best || g.d < best.d)) best = { u: g.u, d: g.d, kind: 'gate', ref: g }; });
    return best;
  }
  function fire(s, tgt) {
    var pos = layout(s.count, s.u), n = Math.min(s.count, C.SHOOTERS_MAX), heavy = !!(s.power && s.power.kind === 'heavy'), weight = Math.ceil(s.count / n) * (heavy ? 2 : 1);
    for (var k = 0; k < n; k++) {
      var p = pos[Math.floor((k + 0.5) * s.count / n)];
      s.bullets.push({ u0: p.u, u: p.u, d0: p.d, d: p.d, w: weight, ref: tgt.ref, kind: tgt.kind, big: false, heavy: heavy });
    }
  }
  function fireTank(s, tgt) {
    var d0 = frontD(s.count) + 0.03;
    s.bullets.push({ u0: s.u, u: s.u, d0: d0, d: d0, w: C.TANK_SHELL_W, ref: tgt.ref, kind: tgt.kind, big: true });
  }

  function step(s, dt, input) {
    if (s.status !== 'playing') return s;
    s.t += dt; s.u = clamp(s.u + clamp(input || 0, -1, 1) * dt * 0.9, -0.85, 0.85);
    if (s.power) { s.power.t -= dt; if (s.power.t <= 0) s.power = null; }
    var front = null;
    s.enemies.forEach(function (e) { if (e.hp > 0 && (!front || e.d < front.d)) front = e; });
    var scroll = front && front.d <= C.STOP_D + 0.02 ? 0 : C.SPEED * dt; s.progress += scroll;
    s.gates.forEach(function (g) { g.d -= scroll; });
    s.enemies.forEach(function (e) { e.d -= scroll; });
    var fd = frontD(s.count);
    s.gates.forEach(function (g) {
      if (!g.done && g.d <= fd) { g.done = true; if (Math.abs(s.u - g.u) <= g.half) { if (g.type === 'power') grantPower(s, g.kind); else s.count = applyGate(g, s.count); } }
    });
    var tgt = target(s); s.cool -= dt; s.tcool -= dt;
    if (tgt && s.cool <= 0) { fire(s, tgt); s.cool = C.FIRE_INTERVAL * (s.power && s.power.kind === 'rapid' ? 0.5 : 1); }
    if (tgt && s.power && s.power.kind === 'tank' && s.tcool <= 0) { fireTank(s, tgt); s.tcool = C.TANK_INTERVAL; }
    s.bullets = s.bullets.filter(function (b) {
      b.d += C.BULLET_SPEED * dt;
      b.u = b.u0 + (b.ref.u - b.u0) * clamp((b.d - b.d0) / Math.max(b.ref.d - b.d0, 0.05), 0, 1);
      for (var i = 0; i < s.enemies.length; i++) { // a bullet hits the first enemy it touches
        var e = s.enemies[i];
        if (e.hp > 0 && Math.abs(b.u - e.u) < 0.14 && b.d >= e.d - 0.03 && b.d <= e.d + 0.06) { e.hp = Math.max(0, e.hp - b.w); return false; }
      }
      if (b.kind === 'gate' && !b.ref.done && b.d >= b.ref.d - 0.03) { addHits(s, b.ref, b.w); return false; }
      return b.d <= 1.05 && b.d >= -0.05;
    });
    var engaged = s.enemies.filter(function (e) { return e.hp > 0 && e.d <= C.ENEMY_RANGE; }).length;
    if (!(s.power && (s.power.kind === 'tank' || s.power.kind === 'shield'))) s.hurt += engaged * C.ENEMY_DPS * dt; // tank and shield protect the squad
    while (s.hurt >= 1) { s.hurt -= 1; s.count = Math.max(0, s.count - 1); }
    if (s.enemies.every(function (e) { return e.hp <= 0; })) { s.status = 'won'; s.power = null; }
    else if (s.count <= 0) { s.status = 'lost'; s.power = null; }
    return s;
  }
  // Advance by dt * speed in fixed sub-steps (<= 1/60 s) so collisions stay accurate at x2..x4.
  function advance(s, dt, input, speed) {
    var left = dt * (speed || 1);
    while (left > 1e-9 && s.status === 'playing') { var h = Math.min(left, 1 / 60); step(s, h, input); left -= h; }
    return s;
  }
  return { C: C, advance: advance, roadHalfWidth: roadHalfWidth, toScreen: toScreen, layout: layout, frontD: frontD, applyGate: applyGate,
    gateValue: gateValue, isShootable: isShootable, isOpen: isOpen, createState: createState, start: start, step: step };
});
