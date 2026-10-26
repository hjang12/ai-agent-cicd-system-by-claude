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
  const a = G.createState(); a.gates[2].hits = 9;
  assert.strictEqual(G.createState().gates[2].hits, 0);
});

test('a full round can be won and lost, and gates never sit between the squad and a blocking enemy', () => {
  const win = G.start(G.createState()); win.count = 300;
  for (let i = 0; i < 60 * 240 && win.status === 'playing'; i++) G.step(win, 1 / 60, 0);
  assert.strictEqual(win.status, 'won');
  const lose = G.start(G.createState()); lose.count = 1;
  for (let i = 0; i < 60 * 240 && lose.status === 'playing'; i++) G.step(lose, 1 / 60, 0);
  assert.strictEqual(lose.status, 'lost');
  const s = G.createState(), firstEnemy = Math.min(...s.enemies.map((e) => e.d));
  s.gates.filter((g) => g.d < firstEnemy + 0.5).forEach((g) => assert.ok(g.d < firstEnemy || g.type !== 'shoot'));
});

test('shooting gate value is capped and never exceeds its maximum', () => {
  const s = G.start(G.createState()); const g = s.gates.find((x) => x.type === 'shoot');
  s.enemies = [{ id: 'far', hp: 999, max: 999, u: 0, d: 10, boss: false }]; s.gates = [g]; g.d = 0.7; s.count = 300; s.u = 0;
  for (let i = 0; i < 20000 && !g.done; i++) G.step(s, 1 / 60, 0);
  assert.ok(g.base + g.hits <= g.max); assert.strictEqual(g.base + g.hits, g.max);
});
