/* Pure game logic. Road coordinates: u in [-1,1] across the road, d in [0,1] from the squad (0) to the far end (1). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GameLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var C = { HORIZON: 0.35, TOP_HALF: 0.08, BOTTOM_HALF: 0.45, U_LIMIT: 0.97, SPEED: 0.07, STOP_D: 0.3,
    ENGAGE_D: 0.75, BULLET_SPEED: 1.3, FIRE_INTERVAL: 0.18, SHOOTERS_MAX: 24, START_COUNT: 12, ENEMY_DPS: 0.8 };

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  // v: 0 at the horizon, 1 at the bottom of the screen. Returns road half width as a fraction of screen width.
  function roadHalfWidth(v) { return C.TOP_HALF + (C.BOTTOM_HALF - C.TOP_HALF) * v; }
  function toScreen(u, d, w, h) {
    var v = 1 - clamp(d, 0, 1);
    return { x: w / 2 + u * roadHalfWidth(v) * w, y: h * (C.HORIZON + (1 - C.HORIZON) * v), scale: 0.25 + 0.75 * v };
  }
  function layout(count, centerU) {
    var cols = Math.min(Math.ceil(Math.sqrt(count * 1.6)), 9), rows = Math.ceil(count / cols);
    var du = cols > 1 ? Math.min(0.14, 1.6 / (cols - 1)) : 0, out = [];
    for (var i = 0; i < count; i++) {
      var r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, count - r * cols);
      var u = centerU + (c - (inRow - 1) / 2) * du + (r % 2 ? 0.25 : -0.25) * du;
      out.push({ u: clamp(u, -C.U_LIMIT, C.U_LIMIT), d: (rows - 1 - r) * Math.min(0.045, 0.26 / rows) });
    }
    return out;
  }
  function applyGate(g, count) {
    if (g.type === 'add') return count + g.value;
    if (g.type === 'sub') return Math.max(0, count - g.value);
    if (g.type === 'mul') return Math.floor(count * g.value);
    if (g.type === 'div') return Math.max(1, Math.floor(count / g.value));
    if (g.type === 'shoot') return count + g.base + g.hits;
    return count;
  }
  function gateValue(g) { return g.type === 'shoot' ? g.base + g.hits : g.value; }

  function createState() {
    return { status: 'ready', t: 0, count: C.START_COUNT, u: 0, cool: 0, hurt: 0, bullets: [], progress: 0,
      // Order along the road (d = distance ahead): gates, shooting gate, enemy group, gates, enemy group, boss.
      gates: [
        { type: 'add', value: 10, u: -0.5, d: 0.85, half: 0.45 }, { type: 'mul', value: 2, u: 0.5, d: 0.85, half: 0.45 },
        { type: 'shoot', base: 1, hits: 0, max: 30, u: 0, d: 1.15, half: 0.4 },
        { type: 'sub', value: 6, u: -0.5, d: 1.9, half: 0.45 }, { type: 'add', value: 15, u: 0.5, d: 1.9, half: 0.45 }],
      enemies: [{ id: 'e1', hp: 18, max: 18, u: -0.3, d: 1.55, boss: false }, { id: 'e2', hp: 30, max: 30, u: 0.35, d: 2.3, boss: false },
        { id: 'boss', hp: 160, max: 160, u: 0, d: 2.8, boss: true }] };
  }
  function start(s) { s.status = 'playing'; return s; }

  function target(s) {
    var best = null;
    s.enemies.forEach(function (e) { if (e.hp > 0 && e.d < C.ENGAGE_D && (!best || e.d < best.d)) best = { u: e.u, d: e.d, kind: 'enemy', ref: e }; });
    s.gates.forEach(function (g) { if (g.type === 'shoot' && !g.done && g.base + g.hits < g.max && g.d < C.ENGAGE_D && (!best || g.d < best.d)) best = { u: g.u, d: g.d, kind: 'gate', ref: g }; });
    return best;
  }
  function fire(s, tgt) {
    var pos = layout(s.count, s.u), n = Math.min(s.count, C.SHOOTERS_MAX), weight = Math.ceil(s.count / n);
    for (var k = 0; k < n; k++) {
      var p = pos[Math.floor((k + 0.5) * s.count / n)];
      s.bullets.push({ u0: p.u, u: p.u, d0: p.d, d: p.d, w: weight, ref: tgt.ref, kind: tgt.kind });
    }
  }
  function step(s, dt, input) {
    if (s.status !== 'playing') return s;
    s.t += dt; s.u = clamp(s.u + clamp(input || 0, -1, 1) * dt * 0.9, -0.85, 0.85);
    var front = null;
    s.enemies.forEach(function (e) { if (e.hp > 0 && (!front || e.d < front.d)) front = e; });
    var scroll = front && front.d <= C.STOP_D + 0.02 ? 0 : C.SPEED * dt; s.progress += scroll;
    s.gates.forEach(function (g) { g.d -= scroll; });
    s.enemies.forEach(function (e) { e.d -= scroll; });
    s.gates.forEach(function (g) {
      if (!g.done && g.d <= 0) { g.done = true; if (Math.abs(s.u - g.u) <= g.half) s.count = applyGate(g, s.count); }
    });
    var tgt = target(s); s.cool -= dt;
    if (tgt && s.cool <= 0) { fire(s, tgt); s.cool = C.FIRE_INTERVAL; }
    s.bullets = s.bullets.filter(function (b) {
      b.d += C.BULLET_SPEED * dt;
      b.u = b.u0 + (b.ref.u - b.u0) * clamp((b.d - b.d0) / Math.max(b.ref.d - b.d0, 0.05), 0, 1);
      if (b.kind === 'enemy' && b.ref.hp > 0 && Math.abs(b.u - b.ref.u) < 0.14 && b.d >= b.ref.d - 0.03) { b.ref.hp = Math.max(0, b.ref.hp - b.w); return false; }
      if (b.kind === 'gate' && !b.ref.done && b.d >= b.ref.d - 0.03) { b.ref.hits = Math.min(b.ref.max - b.ref.base, b.ref.hits + b.w); return false; }
      return b.d <= 1 && b.d >= -0.05;
    });
    var engaged = s.enemies.filter(function (e) { return e.hp > 0 && e.d <= C.ENGAGE_D; }).length;
    s.hurt += engaged * C.ENEMY_DPS * dt;
    while (s.hurt >= 1) { s.hurt -= 1; s.count = Math.max(0, s.count - 1); }
    if (s.enemies.every(function (e) { return e.hp <= 0; })) s.status = 'won';
    else if (s.count <= 0) s.status = 'lost';
    return s;
  }
  return { C: C, roadHalfWidth: roadHalfWidth, toScreen: toScreen, layout: layout, applyGate: applyGate, gateValue: gateValue,
    createState: createState, start: start, step: step };
});
