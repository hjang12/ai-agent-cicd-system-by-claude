/* Pure game logic. Road coordinates: u in [-1,1] across the road, d in [0,1+] from the squad (0) to the far end (1 = visible limit). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GameLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var C = { HORIZON: 0.35, TOP_HALF: 0.08, BOTTOM_HALF: 0.45, U_LIMIT: 0.97, SPEED: 0.14,
    FIRE_RANGE: 1.0, ENEMY_RANGE: 0.75, BULLET_SPEED: 1.3, FIRE_INTERVAL: 0.18, SHOOTERS_MAX: 24, START_COUNT: 12, ENEMY_DPS: 0.8,
    TANK_TIME: 8, POWER_TIME: 8, STAGES: 5, MAX_COUNT: 300, STAGE_BASE: [12, 30, 50, 70, 90],
    // Difficulty tuning: expected squad growth per encounter, enemy hit points as multiples of the expected squad size, enemy damage per second.
    SCALE: { grow: 1.2, grunt: [2.5, 0.4], heavy: [5, 0.8], sniper: [1, 0.15], boss: [5, 1], dps: 0.03, bad: 1.0 }, TANK_SHELL_W: 12, TANK_INTERVAL: 0.35, CRATE_PENALTY: 8, MUL_STEP: 25, MUL_MAX: 5 };

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function roadHalfWidth(v) { return C.TOP_HALF + (C.BOTTOM_HALF - C.TOP_HALF) * v; }
  function toScreen(u, d, w, h) {
    var v = 1 - clamp(d, 0, 1);
    // One perspective law for everything: object scale follows the road width, so banners, enemies, crates, the tank and the boss all grow at the same rate.
    return { x: w / 2 + u * roadHalfWidth(v) * w, y: h * (C.HORIZON + (1 - C.HORIZON) * v), scale: roadHalfWidth(v) / roadHalfWidth(1) };
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

  // Lanes: the road has a left lane (u < 0) and a right lane (u >= 0). Lane objects fill exactly one lane; only the boss sits in the centre.
  function covers(o, u) {
    if (o.lane === 'L') return u < 0;
    if (o.lane === 'R') return u >= 0;
    return Math.abs(u - o.u) < (o.w || o.half || 0.14);
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
  // Visual-effect events for the renderer (capped so an undrained queue cannot grow without bound).
  function emit(s, ev) { if (s.events.length < 400) s.events.push(ev); }
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
        g.broken = true; g.done = true; emit(s, { k: 'break', u: g.u, d: g.d });
        var reward = g.reward || 'tank';
        if (reward === 'soldiers') s.count += g.amount; else grantPower(s, reward);
      }
    }
  }

  // ---------- stage generator (deterministic per stage) ----------
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }
  // Builds one stage as a sequence of encounters along the road (d = distance ahead). Every non-boss object fills exactly one lane
  // and the two objects of an encounter never share a lane. Nothing ever waits: all objects scroll at the same constant speed.
  // Numbers scale with the squad size a player is expected to have at that point (base * 1.2^segment, capped), so every stage stays tense.
  function buildStage(n) {
    var rnd = rng(9100 + n * 131), gates = [], enemies = [], d = 0.9, segs = 8 + n, eid = 0, base = C.STAGE_BASE[Math.min(n, C.STAGE_BASE.length) - 1], E = base;
    var K = C.SCALE, ramp = 0.5 + 0.1 * n; // early stages are gentler: smaller penalties and weaker return fire
    function expect(i) { return Math.min(C.MAX_COUNT, base * Math.pow(K.grow, i)); }
    function laneU(l) { return l === 'L' ? -0.5 : 0.5; }
    function gate(o, l) { o.lane = l; o.u = laneU(l); o.half = 0.5; o.d = d; gates.push(o); }
    function foe(o, l) { o.id = 'e' + (++eid); o.lane = l; o.u = laneU(l); o.d = d + 0.05; o.boss = false; o.max = o.hp; enemies.push(o); }
    var grunt = function () { return { kind: 'grunt', hp: Math.round(E * (K.grunt[0] + K.grunt[1] * n)), dps: Math.max(0.8, K.dps * E * ramp * 2) }; };
    var heavy = function () { return { kind: 'heavy', hp: Math.round(E * (K.heavy[0] + K.heavy[1] * n)), dps: Math.max(1.2, 2.2 * K.dps * E * ramp * 2) }; };
    var sniper = function () { return { kind: 'sniper', hp: Math.round(E * (K.sniper[0] + K.sniper[1] * n)), range: 1.0, dps: Math.max(0.6, 1.2 * K.dps * E * ramp * 2) }; };
    function good(not) {
      for (var i = 0; i < 6; i++) {
        var r = rnd(), g = r < 0.4 ? { type: 'add', value: Math.max(6, Math.round(E * 0.5)) } : r < 0.75 ? { type: 'mul', value: 2 } : { type: 'pct', value: 25 + 5 * n };
        if (!not || g.type !== not) return g;
      }
      return { type: 'add', value: Math.max(6, Math.round(E * 0.5)) };
    }
    function bad() { // a clearly bad option: the right lane matters
      var r = rnd();
      return r < 0.4 ? { type: 'sub', value: Math.max(6, Math.round(E * K.bad * ramp)) } : r < 0.75 ? { type: 'pct', value: -Math.round(15 + 40 * K.bad * ramp) } : { type: 'div', value: 2 };
    }
    var powers = ['rapid', 'heavy', 'shield'];
    var T = {
      pair: function (a, b) { var g1 = good(); gate(g1, a); gate(good(g1.type), b); },
      mix: function (a, b) { gate(good(), a); gate(bad(), b); },
      trap: function (a, b) { gate({ type: 'sub', value: Math.max(5, Math.round(E * 0.25)) }, a); gate({ type: 'pct', value: -(12 + 3 * n) }, b); },
      shoot: function (a, b) { gate({ type: 'shoot', base: 1, hits: 0, max: Math.round(10 + E * 0.6) }, a); foe(grunt(), b); },
      shootmul: function (a, b) { gate({ type: 'shootmul', hits: 0, max: (C.MUL_MAX - 1) * C.MUL_STEP }, a); foe(grunt(), b); },
      crateTank: function (a, b) { gate({ type: 'crate', reward: 'tank', need: Math.round(Math.max(200, E * 8)), hits: 0 }, a); foe(grunt(), b); },
      crateSoldiers: function (a, b) { gate({ type: 'crate', reward: 'soldiers', amount: Math.round(E * 0.5), need: Math.round(Math.max(120, E * 4)), hits: 0 }, a); gate({ type: 'shootsub', base: Math.max(8, Math.round(E * 0.3)), hits: 0 }, b); },
      powerPair: function (a, b) { gate({ type: 'power', kind: powers[Math.floor(rnd() * 3)] }, a); gate(good(), b); },
      ambush: function (a, b) { foe(grunt(), a); foe(grunt(), b); },
      heavy: function (a, b) { foe(heavy(), a); gate(good(), b); },
      sniper: function (a, b) { foe(sniper(), a); foe(sniper(), b); }
    };
    var names = Object.keys(T).concat(n >= 2 ? ['mix', 'mix'] : ['mix']), bag = [];
    function pick() {
      if (!bag.length) { bag = names.slice(); for (var i = bag.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), x = bag[i]; bag[i] = bag[j]; bag[j] = x; } }
      return bag.pop();
    }
    for (var i = 0; i < segs; i++) {
      E = expect(i);
      var name = i === 0 ? 'pair' : i === segs - 1 ? 'trap' : pick(), flip = rnd() < 0.5;
      T[name](flip ? 'L' : 'R', flip ? 'R' : 'L');
      d += (name === 'ambush' || name === 'heavy' || name === 'sniper') ? 0.7 : 0.62;
    }
    var bossHp = Math.round(expect(segs) * (K.boss[0] + K.boss[1] * n));
    enemies.push({ id: 'boss', hp: bossHp, max: bossHp, u: 0, d: d + 0.4, boss: true, w: 0.3 + 0.03 * n, kind: 'boss', dps: Math.max(2, 2.5 * K.dps * expect(segs)) });
    return { gates: gates, enemies: enemies, theme: (n - 1) % 5 };
  }
  function loadStage(s, n) {
    var st = buildStage(n);
    s.stage = n; s.stages = C.STAGES; s.gates = st.gates; s.enemies = st.enemies; s.theme = st.theme; s.length = st.enemies[st.enemies.length - 1].d;
    s.bullets = []; s.events = []; s.power = null; s.hurt = 0; s.progress = 0; s.stageStartCount = s.count; s.stageT = 0;
  }
  function createState(opts) {
    opts = opts || {};
    var n0 = opts.stage || 1, s = { status: 'ready', t: 0, totalT: 0, count: opts.count != null ? opts.count : Math.max(C.START_COUNT, C.STAGE_BASE[Math.min(n0, C.STAGE_BASE.length) - 1]), u: 0, cool: 0, tcool: 0, fireT: -1, tankT: -1 };
    loadStage(s, opts.stage || 1);
    return s;
  }
  // Half of the squad carries over, but never fewer soldiers than the next stage's base.
  function nextStage(s) { var nx = s.stage + 1; s.count = Math.min(C.MAX_COUNT, Math.max(C.STAGE_BASE[Math.min(nx, C.STAGE_BASE.length) - 1], Math.round(s.count * 0.5))); loadStage(s, nx); s.status = 'playing'; return s; }
  function retryStage(s) { s.count = s.stageStartCount; loadStage(s, s.stage); s.status = 'playing'; return s; }
  function start(s) { s.status = 'playing'; return s; }

  // Something worth shooting is ahead (an enemy or a gate that can still absorb hits).
  function hasTarget(s) {
    return s.enemies.some(function (e) { return e.hp > 0 && e.d <= C.FIRE_RANGE; }) ||
      s.gates.some(function (g) { return isShootable(g) && isOpen(g) && g.d <= C.FIRE_RANGE; });
  }
  // Bullets fly straight ahead along the road at the shooter's lateral position: no aiming, no homing.
  function fire(s) {
    s.fireT = s.t;
    var pos = layout(s.count, s.u), n = Math.min(s.count, C.SHOOTERS_MAX), heavy = !!(s.power && s.power.kind === 'heavy'), weight = Math.ceil(s.count / n) * (heavy ? 2 : 1);
    for (var k = 0; k < n; k++) {
      var p = pos[Math.floor((k + 0.5) * s.count / n)];
      s.bullets.push({ u: p.u, d: p.d, w: weight, big: false, heavy: heavy });
    }
  }
  function fireTank(s) { s.tankT = s.t; s.bullets.push({ u: s.u, d: frontD(s.count) + 0.03, w: C.TANK_SHELL_W, big: true, heavy: false }); }

  function step(s, dt, input) {
    if (s.status !== 'playing') return s;
    s.t += dt; s.totalT += dt; s.stageT += dt; s.u = clamp(s.u + clamp(input || 0, -1, 1) * dt * 0.9, -0.85, 0.85);
    if (s.power) { s.power.t -= dt; if (s.power.t <= 0) s.power = null; }
    var scroll = C.SPEED * dt; s.progress += scroll; // the road never stops: nothing waits in front of the squad
    s.gates.forEach(function (g) { g.d -= scroll; });
    s.enemies.forEach(function (e) { e.d -= scroll; });
    if (s.count > C.MAX_COUNT) s.count = C.MAX_COUNT;
    var fd = frontD(s.count), immune = !!(s.power && (s.power.kind === 'tank' || s.power.kind === 'shield'));
    s.gates.forEach(function (g) {
      if (!g.done && g.d <= fd) { g.done = true; if (covers(g, s.u)) { if (g.type === 'power') grantPower(s, g.kind); else s.count = applyGate(g, s.count); } }
    });
    // An enemy that reaches the squad (or goes past it) is gone, and the squad loses as many soldiers as enemies were left.
    s.enemies.forEach(function (e) {
      if (e.hp > 0 && e.d <= fd) {
        if (e.boss) s.count = 0; // the boss reaching the squad fails the mission
        else if (!immune) s.count = Math.max(0, s.count - Math.ceil(e.hp));
        e.hp = 0; e.passed = true;
      }
    });
    var ahead = hasTarget(s); s.cool -= dt; s.tcool -= dt;
    if (ahead && s.cool <= 0) { fire(s); s.cool = C.FIRE_INTERVAL * (s.power && s.power.kind === 'rapid' ? 0.5 : 1); }
    if (ahead && s.power && s.power.kind === 'tank' && s.tcool <= 0) { fireTank(s); s.tcool = C.TANK_INTERVAL; }
    s.bullets = s.bullets.filter(function (b) {
      b.d += C.BULLET_SPEED * dt;
      for (var i = 0; i < s.enemies.length; i++) { // a bullet hits the first enemy it touches
        var e = s.enemies[i];
        if (e.hp > 0 && covers(e, b.u) && b.d >= e.d - 0.03 && b.d <= e.d + 0.06) { var was = e.hp; e.hp = Math.max(0, e.hp - b.w); e.hitT = s.t; emit(s, { k: 'hit', t: 'e', u: b.u, d: b.d, big: b.big }); if (was > 0 && e.hp <= 0) emit(s, { k: 'die', u: e.u, d: e.d, boss: !!e.boss }); return false; }
      }
      for (var j = 0; j < s.gates.length; j++) {
        var g = s.gates[j];
        if (isShootable(g) && isOpen(g) && covers(g, b.u) && b.d >= g.d - 0.03 && b.d <= g.d + 0.06) { addHits(s, g, b.w); emit(s, { k: 'hit', t: 'g', u: b.u, d: b.d, big: b.big }); return false; }
      }
      return b.d <= 1.05;
    });
    var dmg = 0; // each enemy hurts the squad while it is in its own range (snipers reach further, heavies hit harder)
    s.enemies.forEach(function (e) { if (e.hp > 0 && e.d <= (e.range || C.ENEMY_RANGE)) dmg += (e.dps !== undefined ? e.dps : C.ENEMY_DPS); });
    if (!immune) s.hurt += dmg * dt; // tank and shield protect the squad
    while (s.hurt >= 1) { s.hurt -= 1; s.count = Math.max(0, s.count - 1); }
    if (s.count > C.MAX_COUNT) s.count = C.MAX_COUNT;
    if (s.count <= 0) { s.status = 'lost'; s.power = null; }
    else if (s.enemies.every(function (e) { return e.hp <= 0; })) { s.status = s.stage >= s.stages ? 'won' : 'stageclear'; s.power = null; }
    return s;
  }
  // Advance by dt * speed in fixed sub-steps (<= 1/60 s) so collisions stay accurate at x2..x4.
  function advance(s, dt, input, speed) {
    var left = dt * (speed || 1);
    while (left > 1e-9 && s.status === 'playing') { var h = Math.min(left, 1 / 60); step(s, h, input); left -= h; }
    return s;
  }
  return { C: C, advance: advance, roadHalfWidth: roadHalfWidth, toScreen: toScreen, layout: layout, frontD: frontD, applyGate: applyGate,
    covers: covers, gateValue: gateValue, isShootable: isShootable, isOpen: isOpen, createState: createState, buildStage: buildStage, nextStage: nextStage, retryStage: retryStage, start: start, step: step };
});
