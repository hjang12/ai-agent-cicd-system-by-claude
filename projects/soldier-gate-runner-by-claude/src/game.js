/* Canvas rendering, input, screens and the main loop. Game rules live in game-logic.js. */
(function () {
  var G = GameLogic, cv = document.getElementById('game'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  var ov = document.getElementById('overlay'), ovTitle = document.getElementById('ov-title'), ovSub = document.getElementById('ov-sub'), ovBtn = document.getElementById('ov-btn');
  var state = G.createState(), keys = {}, dragging = false, last = 0;

  function showOverlay() {
    var s = state.status;
    ov.hidden = s === 'playing';
    if (s === 'ready') { ovTitle.textContent = 'Soldier Gate Runner'; ovSub.textContent = '좌우로 드래그해 게이트를 고르고, 병력을 늘려 보스를 쓰러뜨리세요.'; ovBtn.textContent = '시작'; }
    if (s === 'won') { ovTitle.textContent = '승리!'; ovSub.textContent = '남은 병력 ' + state.count + '명'; ovBtn.textContent = '다시 시작'; }
    if (s === 'lost') { ovTitle.textContent = '패배'; ovSub.textContent = '병력이 모두 쓰러졌습니다.'; ovBtn.textContent = '다시 시작'; }
  }
  function begin() { state = G.start(G.createState()); showOverlay(); }
  ovBtn.addEventListener('click', begin);

  function pointerU(e) {
    var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
    return Math.max(-0.85, Math.min(0.85, (x - W / 2) / (G.roadHalfWidth(1) * W)));
  }
  cv.addEventListener('pointerdown', function (e) { dragging = true; if (state.status === 'playing') state.u = pointerU(e); });
  window.addEventListener('pointerup', function () { dragging = false; });
  cv.addEventListener('pointermove', function (e) { if (dragging && state.status === 'playing') state.u = pointerU(e); });
  window.addEventListener('keydown', function (e) { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  function keyInput() { return ((keys.arrowright || keys.d) ? 1 : 0) - ((keys.arrowleft || keys.a) ? 1 : 0); }

  function soldier(x, y, sc, team) {
    var r = 9 * sc, blue = team === 'ally', dir = blue ? -1 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r * 0.4, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = blue ? '#23406b' : '#6b2323'; ctx.fillRect(x - r * 0.7, y - r * 0.9, r * 0.5, r * 0.9); ctx.fillRect(x + r * 0.2, y - r * 0.9, r * 0.5, r * 0.9);
    ctx.fillStyle = blue ? '#2f6fd0' : '#d03a2f'; ctx.fillRect(x - r * 0.9, y - r * 2.2, r * 1.8, r * 1.4);
    ctx.fillStyle = blue ? '#5a95f0' : '#f06a5a'; ctx.fillRect(x - r * 0.9, y - r * 2.2, r * 1.8, r * 0.4);
    ctx.fillStyle = blue ? '#244f99' : '#992a24'; ctx.beginPath(); ctx.arc(x, y - r * 2.7, r * 0.8, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1.5, r * 0.3); ctx.beginPath(); ctx.moveTo(x + r * 0.5, y - r * 1.5); ctx.lineTo(x + r * 0.5, y - r * 1.5 + dir * r * 1.6); ctx.stroke();
  }
  function label(t, x, y, size, color) { ctx.font = 'bold ' + size + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = color || '#fff'; ctx.fillText(t, x, y); }

  function draw() {
    var s = state, hz = H * G.C.HORIZON, i;
    ctx.fillStyle = '#7ec8ff'; ctx.fillRect(0, 0, W, hz); ctx.fillStyle = '#5fae4a'; ctx.fillRect(0, hz, W, H - hz);
    var a = G.toScreen(-1, 1, W, H), b = G.toScreen(1, 1, W, H), c = G.toScreen(1, 0, W, H), d = G.toScreen(-1, 0, W, H);
    ctx.fillStyle = '#6b6f76'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([10, 14]); ctx.beginPath(); var m1 = G.toScreen(0, 1, W, H), m0 = G.toScreen(0, 0, W, H); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m0.x, m0.y); ctx.stroke(); ctx.setLineDash([]);
    var items = [];
    s.gates.forEach(function (g) { if (!g.done && g.d < 1) items.push({ d: g.d, k: 'g', o: g }); });
    s.enemies.forEach(function (e) { if (e.hp > 0 && e.d < 1) items.push({ d: e.d, k: 'e', o: e }); });
    items.sort(function (p, q) { return q.d - p.d; });
    items.forEach(function (it) {
      if (it.k === 'g') {
        var g = it.o, l = G.toScreen(g.u - g.half, g.d, W, H), r = G.toScreen(g.u + g.half, g.d, W, H), h = 60 * l.scale;
        ctx.fillStyle = g.type === 'sub' || g.type === 'div' ? 'rgba(220,70,60,0.85)' : g.type === 'shoot' ? 'rgba(240,170,40,0.9)' : 'rgba(60,130,230,0.85)';
        ctx.fillRect(l.x, l.y - h, r.x - l.x, h);
        var sym = { add: '+', sub: '-', mul: '×', div: '÷', shoot: '+' }[g.type];
        label(sym + G.gateValue(g) + (g.type === 'shoot' && g.base + g.hits >= g.max ? ' MAX' : ''), (l.x + r.x) / 2, l.y - h * 0.3, Math.max(12, 30 * l.scale));
      } else {
        var e = it.o, p = G.toScreen(e.u, e.d, W, H), n = e.boss ? 1 : Math.max(1, Math.ceil(e.hp / e.max * 6));
        if (e.boss) { soldier(p.x, p.y, p.scale * 3.2, 'enemy'); } else for (i = 0; i < n; i++) soldier(p.x + (i % 3 - 1) * 20 * p.scale, p.y - Math.floor(i / 3) * 8 * p.scale, p.scale, 'enemy');
        label(String(Math.ceil(e.hp)), p.x, p.y - (e.boss ? 100 : 46) * p.scale, Math.max(11, 18 * p.scale), '#fff');
      }
    });
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2;
    s.bullets.forEach(function (bl) { var p = G.toScreen(bl.u, bl.d, W, H); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + 7 * p.scale); ctx.stroke(); });
    G.layout(s.count, s.u).map(function (p) { var q = G.toScreen(p.u, p.d, W, H); q.d = p.d; return q; }).sort(function (p, q) { return q.d - p.d; })
      .forEach(function (q) { soldier(q.x, q.y, 0.9 * Math.max(0.5, 1 - s.count / 700), 'ally'); });
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, 44);
    label('병력 ' + s.count, 52, 29, 18); var boss = s.enemies.filter(function (e) { return e.boss; })[0];
    if (boss) { ctx.fillStyle = '#400'; ctx.fillRect(170, 14, W - 190, 14); ctx.fillStyle = '#e33'; ctx.fillRect(170, 14, (W - 190) * Math.max(0, boss.hp) / boss.max, 14); label('BOSS', 148, 27, 12); }
  }

  function frame(t) {
    var dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    if (state.status === 'playing') { G.step(state, dt, keyInput()); if (state.status !== 'playing') showOverlay(); }
    draw(); requestAnimationFrame(frame);
  }
  window.__game = {
    get state() { return state; },
    fastForward: function (sec, input) { for (var i = 0; i < Math.round(sec * 60) && state.status === 'playing'; i++) G.step(state, 1 / 60, input || 0); showOverlay(); draw(); }
  };
  showOverlay(); requestAnimationFrame(frame);
})();
