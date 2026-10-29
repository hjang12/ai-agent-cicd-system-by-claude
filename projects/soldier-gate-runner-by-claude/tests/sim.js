// Simulation helpers: simple bots that play the whole campaign through the pure game logic.
const G = require('../src/game-logic.js');

function gainOf(s, g) {
  if (g.type === 'power') return s.count * 0.25;
  return G.applyGate(g, s.count) - s.count;
}
// Moves to the better of two gates just before contact, otherwise faces the nearest enemy, otherwise the nearest shootable.
function aimBot(s) {
  const pairs = s.gates.filter((g) => !g.done && !G.isShootable(g) && g.d < 0.6 && g.d >= 0);
  let tu = null;
  if (pairs.length) tu = pairs.slice().sort((a, b) => gainOf(s, b) - gainOf(s, a))[0].u;
  if (tu === null) { const e = s.enemies.filter((x) => x.hp > 0 && x.d <= 1).sort((a, b) => a.d - b.d)[0]; if (e) tu = e.u; }
  if (tu === null) { const g = s.gates.filter((x) => G.isShootable(x) && G.isOpen(x) && x.d <= 1).sort((a, b) => a.d - b.d)[0]; if (g) tu = g.u; }
  if (tu === null) return 0;
  const d = tu - s.u; return Math.abs(d) < 0.03 ? 0 : Math.sign(d);
}
// Like aimBot but picks the worse gate of a pair about half of the time (decided once per pair, deterministic for a given seed).
function noisyBot(seed) {
  let r = seed >>> 0; const rnd = () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; }, choice = new Map();
  return (s) => {
    const pairs = s.gates.filter((g) => !g.done && !G.isShootable(g) && g.d < 0.6 && g.d >= 0);
    if (pairs.length) {
      const sorted = pairs.slice().sort((x, y) => gainOf(s, y) - gainOf(s, x)), key = s.stage + ':' + Math.min(...pairs.map((g) => s.gates.indexOf(g)));
      if (!choice.has(key)) choice.set(key, rnd() < 0.5 ? 'best' : 'worst');
      const pick = choice.get(key) === 'best' ? sorted[0] : sorted[sorted.length - 1], d = pick.u - s.u; return Math.abs(d) < 0.03 ? 0 : Math.sign(d);
    }
    return aimBot(s);
  };
}
const passiveBot = () => 0;
const leftBot = (s) => (s.u > -0.5 ? -1 : 0);
const rightBot = (s) => (s.u < 0.5 ? 1 : 0);

function playCampaign(bot, opt) {
  const s = G.start(G.createState(opt)), log = []; let frames = 0;
  while (frames < 60 * 60 * 30) {
    if (s.status === 'stageclear') { log.push({ stage: s.stage, count: s.count, seconds: +s.stageT.toFixed(1) }); G.nextStage(s); }
    if (s.status !== 'playing') break;
    G.step(s, 1 / 60, bot(s)); frames++;
  }
  return { status: s.status, stage: s.stage, count: s.count, totalT: s.totalT, log };
}
module.exports = { G, aimBot, noisyBot, passiveBot, leftBot, rightBot, playCampaign };
