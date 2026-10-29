/* Canvas rendering, input, screens and the main loop. Game rules live in game-logic.js. */
(function () {
  var G = GameLogic, cv = document.getElementById('game'), ctx = cv.getContext('2d'), W = 360, H = 640; // W x H is the playfield; in landscape the canvas is wider and the playfield stays centred
  var ov = document.getElementById('overlay'), ovTitle = document.getElementById('ov-title'), ovSub = document.getElementById('ov-sub'), ovBtn = document.getElementById('ov-btn');
  var state = G.createState(), keys = {}, dragging = false, last = 0, speed = 1, speedBtns = document.querySelectorAll('#speedbar button');

  var landscapeMQ = window.matchMedia('(orientation: landscape) and (max-height: 600px)');
  function fit() {
    var fw = W;
    if (landscapeMQ.matches) {
      var availH = Math.max(120, window.innerHeight - 16), availW = Math.max(200, window.innerWidth - 110);
      fw = Math.max(W, Math.min(1280, Math.round(H * availW / availH)));
    }
    if (cv.width !== fw) cv.width = fw;
  }
  window.addEventListener('resize', fit); window.addEventListener('orientationchange', fit); fit();

  function showOverlay() {
    var s = state.status;
    ov.hidden = s === 'playing';
    if (s === 'ready') { ovTitle.textContent = 'Soldier Gate Runner'; ovSub.textContent = '좌우로 드래그해 게이트를 고르고, 병력을 늘려 보스를 쓰러뜨리세요.'; ovBtn.textContent = '시작'; }
    if (s === 'won') { ovTitle.textContent = '승리!'; ovSub.textContent = '남은 병력 ' + state.count + '명'; ovBtn.textContent = '다시 시작'; }
    if (s === 'lost') { ovTitle.textContent = '패배'; ovSub.textContent = '병력이 모두 쓰러졌습니다.'; ovBtn.textContent = '다시 시작'; }
  }
  function setSpeed(n) { speed = Math.max(1, Math.min(4, n)); speedBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.speed === speed)); }); }
  speedBtns.forEach(function (b) { b.addEventListener('click', function () { setSpeed(+b.dataset.speed); }); });
  setSpeed(1);
  function begin() { state = G.start(G.createState()); parts = []; showOverlay(); }
  ovBtn.addEventListener('click', begin);

  function pointerU(e) {
    var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * cv.width - (cv.width - W) / 2;
    return Math.max(-0.85, Math.min(0.85, (x - W / 2) / (G.roadHalfWidth(1) * W)));
  }
  cv.addEventListener('pointerdown', function (e) { dragging = true; if (state.status === 'playing') state.u = pointerU(e); });
  window.addEventListener('pointerup', function () { dragging = false; });
  cv.addEventListener('pointermove', function (e) { if (dragging && state.status === 'playing') state.u = pointerU(e); });
  window.addEventListener('keydown', function (e) { keys[e.key.toLowerCase()] = true; if (/^[1-4]$/.test(e.key)) setSpeed(+e.key); });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  function keyInput() { return ((keys.arrowright || keys.d) ? 1 : 0) - ((keys.arrowleft || keys.a) ? 1 : 0); }

  function rr(x, y, w, h, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  // Ally = back view (blue), enemy = front view (red). r is the unit size; phase drives the run cycle.
  function soldier(x, y, sc, team, phase) {
    var r = 12 * sc, ally = team === 'ally', sw = Math.sin(phase || 0) * r * 0.28, dir = ally ? -1 : 1;
    var c = ally ? { dk: '#1b3a73', md: '#2f6fd0', lt: '#6aa6ff', pk: '#22478a', hm: '#2a5cb8', hl: '#8cbcff' }
                 : { dk: '#6e1b1b', md: '#d03a2f', lt: '#ff8a78', pk: '#8a2424', hm: '#b82f2a', hl: '#ffb0a0' };
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.15, r * 0.38, 0, 0, 6.3); ctx.fill();
    rr(x - r * 0.62, y - r * 1.15 + sw, r * 0.5, r * 1.15, r * 0.2, c.dk); rr(x + r * 0.12, y - r * 1.15 - sw, r * 0.5, r * 1.15, r * 0.2, c.dk);
    rr(x - r * 0.68, y - r * 0.28 + sw, r * 0.6, r * 0.32, r * 0.12, '#1c1c20'); rr(x + r * 0.08, y - r * 0.28 - sw, r * 0.6, r * 0.32, r * 0.12, '#1c1c20');
    rr(x - r * 0.95, y - r * 2.35, r * 1.9, r * 1.4, r * 0.4, c.md); rr(x - r * 0.95, y - r * 2.35, r * 0.55, r * 1.4, r * 0.3, c.lt);
    rr(x + r * 0.45, y - r * 2.35, r * 0.5, r * 1.4, r * 0.25, c.dk); rr(x - r * 0.95, y - r * 1.35, r * 1.9, r * 0.22, 0, c.dk);
    if (ally) { rr(x - r * 0.62, y - r * 2.25, r * 1.24, r * 1.25, r * 0.28, c.pk); rr(x - r * 0.62, y - r * 2.25, r * 0.35, r * 1.25, r * 0.2, c.md); }
    else { rr(x - r * 0.6, y - r * 2.0, r * 0.5, r * 0.45, r * 0.1, c.dk); rr(x + r * 0.1, y - r * 2.0, r * 0.5, r * 0.45, r * 0.1, c.dk); }
    rr(x - r * 1.28, y - r * 2.15, r * 0.42, r * 1.0, r * 0.2, c.md); rr(x + r * 0.86, y - r * 2.15, r * 0.42, r * 1.0, r * 0.2, c.dk);
    ctx.strokeStyle = '#17171a'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, r * 0.34);
    ctx.beginPath(); ctx.moveTo(x + r * 0.55, y - r * 1.55); ctx.lineTo(x + r * 0.55, y - r * 1.55 + dir * r * 2.0); ctx.stroke();
    if (!ally) { ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(x, y - r * 2.95, r * 0.62, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = c.hm; ctx.beginPath(); ctx.arc(x, y - r * 3.05, r * (ally ? 0.88 : 0.82), ally ? 0 : Math.PI, ally ? 6.3 : 6.3); ctx.fill();
    if (!ally) { ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(x, y - r * 2.85, r * 0.55, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(x - r * 0.3, y - r * 2.95, r * 0.14, r * 0.16); ctx.fillRect(x + r * 0.16, y - r * 2.95, r * 0.14, r * 0.16); }
    ctx.fillStyle = c.hl; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 3.3, r * 0.3, 0, 6.3); ctx.fill();
  }
  function tank(x, y, sc) {
    var r = 14 * sc;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y, r * 2.2, r * 0.7, 0, 0, 6.3); ctx.fill();
    rr(x - r * 2.0, y - r * 1.2, r * 0.8, r * 1.3, r * 0.3, '#1d2430'); rr(x + r * 1.2, y - r * 1.2, r * 0.8, r * 1.3, r * 0.3, '#1d2430');
    rr(x - r * 1.6, y - r * 2.0, r * 3.2, r * 1.5, r * 0.4, '#3f7a4a'); rr(x - r * 1.6, y - r * 2.0, r * 1.0, r * 1.5, r * 0.4, '#6fb87c');
    rr(x - r * 0.28, y - r * 4.3, r * 0.56, r * 2.5, r * 0.2, '#2b3b2f');
    ctx.fillStyle = '#4f9a5c'; ctx.beginPath(); ctx.arc(x, y - r * 2.1, r * 1.05, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#9fe0aa'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 2.4, r * 0.35, 0, 6.3); ctx.fill();
  }
  function crate(x, y, sc, hitsRatio) {
    var r = 22 * sc;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r * 0.4, 0, 0, 6.3); ctx.fill();
    rr(x - r, y - r * 2.2, r * 2, r * 2.2, r * 0.3, '#9a6a2e'); rr(x - r, y - r * 2.2, r * 0.6, r * 2.2, r * 0.3, '#c18a45');
    rr(x - r, y - r * 1.7, r * 2, r * 0.22, 0, '#5e3d16'); rr(x - r, y - r * 0.6, r * 2, r * 0.22, 0, '#5e3d16');
    ctx.fillStyle = '#e8c84a'; ctx.fillRect(x - r, y - r * 2.55, r * 2 * (1 - hitsRatio), r * 0.25);
  }
  // Floor mat showing exactly which lane an object occupies.
  function laneMat(o, color) {
    if (!o.lane) return;
    var u0 = o.lane === 'L' ? -1 : 0.04, u1 = o.lane === 'L' ? -0.04 : 1, a = G.toScreen(u0, o.d, W, H), b = G.toScreen(u1, o.d, W, H);
    ctx.fillStyle = color; ctx.fillRect(a.x, a.y - 7 * a.scale, b.x - a.x, 9 * a.scale);
  }
  // Draws text that is shrunk to fit inside maxW (used for gate banners).
  function labelFit(text, x, y, size, maxW) {
    ctx.font = 'bold ' + size + 'px system-ui, sans-serif';
    var w = ctx.measureText(text).width, s = w > maxW ? size * maxW / w : size;
    label(text, x, y, Math.max(8, s));
  }
  function label(t, x, y, size, color) { ctx.font = 'bold ' + size + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = color || '#fff'; ctx.fillText(t, x, y); }

  // ---- combat effects: muzzle flashes, impact sparks, hit reactions, kill bursts ----
  var parts = [];
  function pushPart(q) { if (parts.length < 360) parts.push(q); }
  function burst(x, y, n, colors, speed, size, life, sc) {
    for (var i = 0; i < n; i++) {
      var ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = (0.4 + Math.random() * 0.8) * speed * sc;
      pushPart({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: 260 * sc, life: life, max: life, size: size * Math.max(0.6, sc), color: colors[i % colors.length] });
    }
  }
  function spawnFx(ev) {
    var p = G.toScreen(ev.u, ev.d, W, H), sc = p.scale;
    if (ev.k === 'hit') {
      burst(p.x, p.y, ev.big ? 7 : 3, ev.t === 'e' ? ['#fff3b0', '#ffb347', '#ff6a3a'] : ['#fff3b0', '#ffe27a', '#ffd84a'], ev.big ? 220 : 150, ev.big ? 3.5 : 2.2, 0.28, sc);
      pushPart({ x: p.x, y: p.y, ring: true, life: 0.16, max: 0.16, size: (ev.big ? 22 : 10) * Math.max(0.6, sc) });
    } else if (ev.k === 'die') {
      burst(p.x, p.y - 20 * sc, ev.boss ? 30 : 10, ['#ffffff', '#ffb347', '#e33b2f'], ev.boss ? 320 : 200, ev.boss ? 5 : 3, 0.5, ev.boss ? sc * 2 : sc);
      pushPart({ x: p.x, y: p.y - 20 * sc, ring: true, life: 0.35, max: 0.35, size: (ev.boss ? 90 : 36) * Math.max(0.6, sc) });
    } else if (ev.k === 'break') {
      burst(p.x, p.y - 20 * sc, 18, ['#c18a45', '#e8c84a', '#fff3b0'], 240, 4, 0.55, sc);
      pushPart({ x: p.x, y: p.y - 20 * sc, ring: true, life: 0.35, max: 0.35, size: 60 * Math.max(0.6, sc) });
    }
  }
  function updateParts(dt) {
    parts = parts.filter(function (q) { q.life -= dt; if (q.life <= 0) return false; if (!q.ring) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; } return true; });
  }
  function drawParts() {
    parts.forEach(function (q) {
      var a = Math.max(0, q.life / q.max);
      if (q.ring) { var k = q.size * (1.8 - a); ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * a).toFixed(2) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(q.x, q.y, k, k * 0.55, 0, 0, 6.3); ctx.stroke(); }
      else { ctx.globalAlpha = a; ctx.fillStyle = q.color; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); ctx.globalAlpha = 1; }
    });
  }
  function muzzle(x, y, r) {
    ctx.fillStyle = 'rgba(255,196,64,0.55)'; ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff6c2'; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.beginPath();
    ctx.moveTo(x - r * 1.1, y); ctx.lineTo(x + r * 1.1, y); ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x, y + r * 1.1); ctx.stroke();
  }

  function draw() {
    var s = state, hz = H * G.C.HORIZON, i;
    var FW = cv.width; ctx.fillStyle = '#7ec8ff'; ctx.fillRect(0, 0, FW, hz); ctx.fillStyle = '#5fae4a'; ctx.fillRect(0, hz, FW, H - hz);
    ctx.save(); ctx.translate((FW - W) / 2, 0);
    var a = G.toScreen(-1, 1, W, H), b = G.toScreen(1, 1, W, H), c = G.toScreen(1, 0, W, H), d = G.toScreen(-1, 0, W, H);
    ctx.fillStyle = '#6b6f76'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([10, 14]); ctx.beginPath(); var m1 = G.toScreen(0, 1, W, H), m0 = G.toScreen(0, 0, W, H); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m0.x, m0.y); ctx.stroke(); ctx.setLineDash([]);
    var items = [];
    s.gates.forEach(function (g) { if (!g.done && g.d < 1) items.push({ d: g.d, k: 'g', o: g }); });
    s.enemies.forEach(function (e) { if (e.hp > 0 && e.d < 1) items.push({ d: e.d, k: 'e', o: e }); });
    items.sort(function (p, q) { return q.d - p.d; });
    items.forEach(function (it) {
      if (it.k === 'g') {
        var g = it.o;
        if (g.type === 'crate') {
          var cp = G.toScreen(g.u, g.d, W, H); laneMat(g, 'rgba(232,200,74,0.30)'); crate(cp.x, cp.y, cp.scale, g.hits / g.need);
          label({ tank: 'TANK 통', soldiers: '병사 통 +' + g.amount, rapid: '연사 통' }[g.reward || 'tank'], cp.x, cp.y - 62 * cp.scale, Math.max(11, 16 * cp.scale), '#ffe27a');
          label(String(G.gateValue(g)), cp.x, cp.y - 20 * cp.scale, Math.max(12, 24 * cp.scale), '#fff');
        } else {
          var hw = g.lane ? g.half * 0.96 : g.half, l = G.toScreen(g.u - hw, g.d, W, H), r = G.toScreen(g.u + hw, g.d, W, H), h = 60 * l.scale;
          var col = { add: 'rgba(60,130,230,0.85)', mul: 'rgba(60,130,230,0.85)', sub: 'rgba(220,70,60,0.85)', div: 'rgba(220,70,60,0.85)',
            shoot: 'rgba(240,170,40,0.9)', shootmul: 'rgba(160,90,220,0.9)', shootsub: 'rgba(230,110,60,0.9)' }[g.type];
          if (g.type === 'pct') col = g.value > 0 ? 'rgba(60,130,230,0.85)' : 'rgba(220,70,60,0.85)';
          if (g.type === 'power') col = 'rgba(40,170,150,0.9)';
          ctx.fillStyle = col; ctx.fillRect(l.x, l.y - h, r.x - l.x, h);
          if (G.isShootable(g)) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(l.x + 1, l.y - h + 1, r.x - l.x - 2, h - 2); }
          var txt;
          if (g.type === 'pct') txt = (g.value > 0 ? '+' : '') + g.value + '%';
          else if (g.type === 'power') txt = { rapid: '연사 UP', heavy: '화력 UP', shield: '보호막' }[g.kind];
          else {
            var sym = { add: '+', sub: '-', mul: '×', div: '÷', shoot: '◎ +', shootmul: '◎ ×', shootsub: '◎ -' }[g.type];
            txt = sym + G.gateValue(g) + (!G.isOpen(g) && G.isShootable(g) ? ' MAX' : '');
          }
          labelFit(txt, (l.x + r.x) / 2, l.y - h * 0.3, Math.max(12, 28 * l.scale), (r.x - l.x) - 8);
        }
      } else {
        var e = it.o; laneMat(e, 'rgba(220,60,50,0.28)');
        var p = G.toScreen(e.u, e.d, W, H), n = e.boss ? 1 : Math.max(1, Math.ceil(e.hp / e.max * 6));
        var hit = e.hitT !== undefined && s.t - e.hitT < 0.09, shake = hit ? Math.sin(s.t * 90) * 3 * p.scale : 0, shooting = e.d <= G.C.ENEMY_RANGE;
        if (e.boss) {
          var br = 12 * p.scale * 3.2; soldier(p.x + shake, p.y, p.scale * 3.2, 'enemy', s.t * 4);
          if (shooting && (s.t * 4) % 1 < 0.18) muzzle(p.x + shake + 0.55 * br, p.y + 0.45 * br, br * 0.9);
        } else for (i = 0; i < n; i++) {
          var ex = p.x + (i % 3 - 1) * 26 * p.scale + shake, ey = p.y - Math.floor(i / 3) * 10 * p.scale, er = 12 * p.scale * 1.1;
          soldier(ex, ey, p.scale * 1.1, 'enemy', s.t * 6 + i);
          if (shooting && (s.t * 4 + i * 0.37) % 1 < 0.18) muzzle(ex + 0.55 * er, ey + 0.45 * er, er * 0.9);
        }
        if (hit) { var hs = e.boss ? p.scale * 3.2 : p.scale * 1.1; ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(p.x + shake, p.y - 22 * hs, e.boss ? 18 * hs : 40 * p.scale, 26 * hs, 0, 0, 6.3); ctx.fill(); }
        label(String(Math.ceil(e.hp)), p.x, p.y - (e.boss ? 150 : 64) * p.scale, Math.max(11, 18 * p.scale), '#fff');
      }
    });
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2;
    s.bullets.forEach(function (bl) { var p = G.toScreen(bl.u, bl.d, W, H); ctx.strokeStyle = bl.big ? '#ff8a2a' : bl.heavy ? '#ff6a3a' : '#ffd84a'; ctx.lineWidth = bl.big ? 6 * p.scale + 1 : bl.heavy ? 3.5 : 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + (bl.big ? 16 : 7) * p.scale); ctx.stroke(); });
    G.layout(s.count, s.u).map(function (p) { var q = G.toScreen(p.u, p.d, W, H); q.d = p.d; return q; }).sort(function (p, q) { return q.d - p.d; })
      .forEach(function (q) { soldier(q.x, q.y, q.scale * 1.0 * Math.max(0.55, 1 - s.count / 600), 'ally', s.t * 12 + q.x * 0.35); });
    if (s.fireT >= 0 && s.t - s.fireT < 0.07) {
      var raw = G.layout(s.count, s.u), ns = Math.min(s.count, G.C.SHOOTERS_MAX), shrink = Math.max(0.55, 1 - s.count / 600);
      for (var k = 0; k < ns; k++) { var rp = raw[Math.floor((k + 0.5) * s.count / ns)], q2 = G.toScreen(rp.u, rp.d, W, H), mr = 12 * q2.scale * shrink; muzzle(q2.x + 0.55 * mr, q2.y - 3.55 * mr, mr * 0.9); }
    }
    if (s.power && s.power.kind === 'tank') {
      var tp = G.toScreen(s.u, G.frontD(s.count) + 0.05, W, H); tank(tp.x, tp.y, tp.scale * 2.4);
      if (s.tankT >= 0 && s.t - s.tankT < 0.09) muzzle(tp.x, tp.y - 14 * tp.scale * 2.4 * 4.45, 14 * tp.scale * 2.4 * 1.2);
    }
    if (s.power && s.power.kind === 'shield') {
      var sp = G.toScreen(s.u, G.frontD(s.count) / 2, W, H), rx = Math.max(60, 14 * Math.sqrt(s.count)) + 30;
      ctx.fillStyle = 'rgba(90,170,255,0.18)'; ctx.strokeStyle = 'rgba(160,215,255,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(sp.x, sp.y - 34, rx, 60 + G.frontD(s.count) * 160, 0, 0, 6.3); ctx.fill(); ctx.stroke();
    }
    drawParts();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, 44);
    label('병력 ' + s.count, 52, 29, 18); var boss = s.enemies.filter(function (e) { return e.boss; })[0];
    if (boss) { ctx.fillStyle = '#400'; ctx.fillRect(170, 14, W - 190, 14); ctx.fillStyle = '#e33'; ctx.fillRect(170, 14, (W - 190) * Math.max(0, boss.hp) / boss.max, 14); label('BOSS', 148, 27, 12); }
    if (s.power) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(8, 50, 150, 16); ctx.fillStyle = '#4fa85c'; ctx.fillRect(8, 50, 150 * s.power.t / G.C.TANK_TIME, 16); label({ tank: 'TANK', shield: '보호막', rapid: '연사', heavy: '화력' }[s.power.kind] + ' ' + s.power.t.toFixed(1) + 's', 83, 63, 12); }
    ctx.restore();
  }

  function frame(t) {
    var dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    if (state.status === 'playing') { G.advance(state, dt, keyInput(), speed); if (state.status !== 'playing') showOverlay(); }
    var ev = state.events;
    if (ev && ev.length) {
      state.events = [];
      var hits = ev.filter(function (x) { return x.k === 'hit'; }).length, stride = Math.max(1, Math.ceil(hits / 50)), hi = 0;
      ev.forEach(function (x) { if (x.k === 'hit' && (hi++ % stride)) return; spawnFx(x); });
    }
    updateParts(dt);
    draw(); requestAnimationFrame(frame);
  }
  window.__game = {
    get state() { return state; },
    get speed() { return speed; }, setSpeed: setSpeed, get fxCount() { return parts.length; },
    perf: function (n) { var t0 = performance.now(); for (var i = 0; i < n; i++) draw(); return (performance.now() - t0) / n; },
    fastForward: function (sec, input) { for (var i = 0; i < Math.round(sec * 60) && state.status === 'playing'; i++) G.step(state, 1 / 60, input || 0); showOverlay(); draw(); }
  };
  showOverlay(); requestAnimationFrame(frame);
})();
