const test = require('node:test');
const assert = require('node:assert');
const G = require('../src/game-logic.js');

test('road half width grows toward the viewer', () => {
  assert.ok(G.roadHalfWidth(0) < G.roadHalfWidth(0.5) && G.roadHalfWidth(0.5) < G.roadHalfWidth(1));
});

test('layout stays inside the road and grows with squad size', () => {
  const small = G.layout(12, 0), big = G.layout(200, 0.85);
  assert.strictEqual(big.length, 200);
  big.forEach((p) => assert.ok(Math.abs(p.u) <= G.C.U_LIMIT));
  const width = (l) => Math.max(...l.map((p) => p.u)) - Math.min(...l.map((p) => p.u));
  const depth = (l) => Math.max(...l.map((p) => p.d));
  assert.ok(width(G.layout(200, 0)) > width(small) && depth(G.layout(200, 0)) > depth(small));
});

test('every bullet stays between the road edges at its own height (max squad, both edges)', () => {
  for (const centerU of [-0.85, 0, 0.85]) {
    const s = G.start(G.createState()); s.count = 300; s.u = centerU;
    let checked = 0;
    for (let i = 0; i < 1500 && s.status === 'playing'; i++) {
      G.step(s, 1 / 60, 0);
      s.bullets.forEach((b) => {
        const v = 1 - Math.min(Math.max(b.d, 0), 1), half = G.roadHalfWidth(v);
        const sc = G.toScreen(b.u, b.d, 1000, 1000);
        assert.ok(Math.abs(sc.x - 500) <= half * 1000 + 1e-6, 'bullet left the road');
        assert.ok(Math.abs(b.u) <= 1, 'bullet u out of range'); checked++;
      });
    }
    assert.ok(checked > 100);
  }
});

test('hits reduce enemy hp and a won round ends the game', () => {
  const s = G.start(G.createState()); s.count = 60; const total = s.enemies.reduce((a, e) => a + e.hp, 0);
  let min = total;
  for (let i = 0; i < 20000 && s.status === 'playing'; i++) { G.step(s, 1 / 60, 0); min = Math.min(min, s.enemies.reduce((a, e) => a + e.hp, 0)); }
  assert.ok(min < total); assert.ok(['won', 'lost'].includes(s.status));
});

test('shooting gate: displayed value equals hits and the final count gain', () => {
  const s = G.start(G.createState()); const g = s.gates.find((x) => x.type === 'shoot');
  s.enemies = [{ id: 'far', hp: 999, max: 999, u: 0, d: 10, boss: false }]; s.gates = [g]; g.d = 0.4; s.count = 40; s.u = 0;
  let before = null;
  for (let i = 0; i < 20000 && !g.done; i++) { before = s.count; G.step(s, 1 / 60, 0); }
  assert.ok(g.hits > 0); assert.strictEqual(G.gateValue(g), g.base + g.hits);
  assert.strictEqual(s.count - before, g.base + g.hits);
});

test('gate arithmetic and fresh state on restart', () => {
  assert.strictEqual(G.applyGate({ type: 'add', value: 5 }, 10), 15);
  assert.strictEqual(G.applyGate({ type: 'sub', value: 50 }, 10), 0);
  assert.strictEqual(G.applyGate({ type: 'mul', value: 2 }, 10), 20);
  assert.strictEqual(G.applyGate({ type: 'div', value: 2 }, 11), 5);
  const a = G.createState(); a.gates.filter((g) => g.hits !== undefined).forEach((g) => { g.hits = 9; g.broken = true; });
  G.createState().gates.filter((g) => g.hits !== undefined).forEach((g) => assert.strictEqual(g.hits, 0));
  assert.ok(!G.createState().gates.some((g) => g.broken) && G.createState().power === null);
});

test('a full round can be won and lost, and gates never sit between the squad and a blocking enemy', () => {
  const win = G.start(G.createState()); win.count = 300;
  for (let i = 0; i < 60 * 240 && win.status === 'playing'; i++) G.step(win, 1 / 60, 0);
  assert.strictEqual(win.status, 'won');
  const lose = G.start(G.createState()); lose.count = 1; lose.gates = [];
  for (let i = 0; i < 60 * 240 && lose.status === 'playing'; i++) G.step(lose, 1 / 60, 0);
  assert.strictEqual(lose.status, 'lost');
  const lv = G.createState();
  lv.enemies.forEach((e) => lv.gates.filter((g) => g.d < e.d).forEach((g) => assert.ok(e.d - g.d >= 0.4, `gate ${g.type}@${g.d} too close before enemy ${e.id}@${e.d}`)));
});

test('shooting gate value is capped and never exceeds its maximum', () => {
  const s = G.start(G.createState()); const g = s.gates.find((x) => x.type === 'shoot');
  s.enemies = [{ id: 'far', hp: 999, max: 999, u: 0, d: 10, boss: false }]; s.gates = [g]; g.d = 0.7; s.count = 300; s.u = 0;
  for (let i = 0; i < 20000 && !g.done; i++) G.step(s, 1 / 60, 0);
  assert.ok(g.base + g.hits <= g.max); assert.strictEqual(g.base + g.hits, g.max);
});

test('every gate type and enemy approaches at the same speed', () => {
  const s = G.start(G.createState());
  s.gates.push({ type: 'div', value: 2, u: 0, d: 0.9, half: 0.4 });
  const before = s.gates.map((g) => g.d).concat(s.enemies.map((e) => e.d));
  for (let i = 0; i < 120; i++) G.step(s, 1 / 60, 0);
  const after = s.gates.map((g) => g.d).concat(s.enemies.map((e) => e.d));
  const moved = before.map((d, i) => d - after[i]);
  moved.forEach((m) => assert.ok(Math.abs(m - moved[0]) < 1e-9, 'objects moved at different speeds'));
  assert.ok(Math.abs(moved[0] - G.C.SPEED * 2) < 1e-9);
});

test('speed multiplier advances game time proportionally and matches fixed stepping', () => {
  for (const speed of [1, 2, 3, 4]) {
    const a = G.start(G.createState()), b = G.start(G.createState());
    for (let i = 0; i < 30; i++) G.advance(a, 1 / 30, 0, speed);
    for (let i = 0; i < 60 * speed; i++) G.step(b, 1 / 60, 0);
    assert.ok(Math.abs(a.t - speed) < 1e-6, `x${speed} elapsed ${a.t}`);
    assert.ok(Math.abs(a.gates[0].d - b.gates[0].d) < 1e-6);
  }
});

test('bullets stay inside the road at x4 speed as well', () => {
  const s = G.start(G.createState()); s.count = 200;
  for (let i = 0; i < 2000 && s.status === 'playing'; i++) {
    G.advance(s, 1 / 30, 0, 4);
    s.bullets.forEach((b) => assert.ok(Math.abs(b.u) <= 1 && b.d <= 1.05 + 1e-6));
  }
});

test('feedback 1: an enemy is hit as soon as it becomes visible', () => {
  const s = G.start(G.createState()); s.gates = []; s.count = 30; const e = s.enemies[0]; e.d = 0.99;
  let t = null;
  for (let i = 0; i < 600 && t === null; i++) { G.step(s, 1 / 60, 0); if (e.hp < e.max) t = s.t; }
  assert.ok(t !== null && t < 1.5, `first damage after ${t}`); assert.ok(e.d > 0.8, `enemy already at ${e.d}`);
});

test('feedback 6: gates make contact at the squad front, not the rear', () => {
  for (const count of [12, 40, 200]) {
    const s = G.start(G.createState()); const g = { type: 'add', value: 5, u: 0, d: 0.5, half: 0.4 };
    s.gates = [g]; s.enemies = [{ id: 'far', hp: 999, max: 999, u: 0, d: 10, boss: false }]; s.count = count; s.u = 0;
    const fd = G.frontD(count); let atContact = null;
    for (let i = 0; i < 2000 && !g.done; i++) { G.step(s, 1 / 60, 0); if (g.done) atContact = g.d; }
    assert.ok(atContact <= fd && atContact > fd - G.C.SPEED / 60 - 1e-9, `x${count}: contact d=${atContact}, front=${fd}`);
    assert.strictEqual(s.count, count + 5);
  }
  assert.ok(G.frontD(200) > G.frontD(12));
});

function runGate(g, count, ticks) {
  const s = G.start(G.createState()); s.gates = [g]; s.enemies = [{ id: 'far', hp: 999, max: 999, u: 0, d: 10, boss: false }]; s.count = count; s.u = 0;
  let before = count;
  for (let i = 0; i < ticks && !g.done; i++) { before = s.count; G.step(s, 1 / 60, 0); }
  return { s, before };
}

test('shoot-to-multiply gate: multiplier grows with hits (capped) and applies on contact', () => {
  const g = { type: 'shootmul', hits: 0, max: 100, u: 0, d: 0.8, half: 0.4 };
  const { s, before } = runGate(g, 40, 3000);
  assert.ok(g.hits > 0 && g.hits <= g.max); const m = Math.min(5, 1 + Math.floor(g.hits / 25));
  assert.strictEqual(G.gateValue(g), m); assert.strictEqual(s.count, Math.floor(before * m));
});

test('shoot-to-shrink gate: the penalty shrinks as it is shot', () => {
  const g = { type: 'shootsub', base: 25, hits: 0, u: 0, d: 0.8, half: 0.4 };
  const { s, before } = runGate(g, 40, 3000);
  assert.ok(g.hits > 0 && g.hits <= 25); assert.strictEqual(G.gateValue(g), 25 - g.hits);
  assert.strictEqual(s.count, Math.max(0, before - (25 - g.hits)));
});

test('crate: 500 hits break it and grant a tank for a limited time; unbroken crate hurts on contact', () => {
  const broken = { type: 'crate', need: 500, hits: 0, u: 0, d: 1.2, half: 0.35 };
  const s = G.start(G.createState()); s.gates = [broken]; s.enemies = [{ id: 'far', hp: 999, max: 999, u: 0, d: 10, boss: false }]; s.count = 120;
  let got = false; for (let i = 0; i < 3000 && !got; i++) { G.step(s, 1 / 60, 0); got = !!s.power; }
  assert.ok(got && broken.broken && broken.hits === 500 && s.power.kind === 'tank');
  const t0 = s.power.t; for (let i = 0; i < 60; i++) G.step(s, 1 / 60, 0); assert.ok(s.power.t < t0);
  for (let i = 0; i < 60 * 10; i++) G.step(s, 1 / 60, 0); assert.strictEqual(s.power, null);
  const weak = { type: 'crate', need: 500, hits: 0, u: 0, d: 0.6, half: 0.35 };
  const r = runGate(weak, 3, 3000); assert.ok(!weak.broken && r.s.power === null); assert.ok(r.s.count <= Math.max(0, 3 - G.C.CRATE_PENALTY + 1));
});

test('riding the tank protects the squad and the tank shells do heavy damage', () => {
  const s = G.start(G.createState()); s.gates = []; s.count = 20; s.power = { kind: 'tank', t: 8 };
  const e = s.enemies[0]; e.d = 0.7; e.hp = e.max = 200; const c0 = s.count;
  for (let i = 0; i < 60 * 3; i++) G.step(s, 1 / 60, 0);
  assert.strictEqual(s.count, c0); assert.ok(e.hp < 200); assert.ok(s.bullets.every((b) => Math.abs(b.u) <= 1));
});
