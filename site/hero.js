// Névoa da capa: sai dos furos da torre de inox e se espalha pela página inteira.
// A camada fica por cima de tudo, sem bloquear cliques (pointer-events: none).
(function () {
  var torre = document.getElementById('heroTorre');
  var cv = document.getElementById('nevoaPagina');
  if (!torre || !cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');

  // posição dos furos na imagem da torre (fração da largura/altura)
  var FURO_Y = 0.108, FURO_X0 = 0.12, FURO_X1 = 0.90;

  // sprite: mancha de névoa com borda bem suave
  var sp = document.createElement('canvas');
  sp.width = sp.height = 128;
  var g = sp.getContext('2d');
  var rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(236,244,247,0.55)');
  rg.addColorStop(0.35, 'rgba(226,238,242,0.26)');
  rg.addColorStop(0.7, 'rgba(216,232,238,0.07)');
  rg.addColorStop(1, 'rgba(216,232,238,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);

  var jato = [], ambiente = [];
  var W = 0, H = 0, dpr = 1, base = 1;
  var rodando = false, ult = 0, acum = 0;
  var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    base = Math.min(Math.max(W / 1000, 0.6), 1.1);   // escala para celular/computador
  }

  function fonte() {
    var r = torre.getBoundingClientRect();
    if (!r.width) return null;
    return {
      y: r.top + window.scrollY + r.height * FURO_Y,
      x0: r.left + r.width * FURO_X0,
      x1: r.left + r.width * FURO_X1,
      cx: r.left + r.width / 2
    };
  }

  function nascerJato(f) {
    var x = f.x0 + Math.random() * (f.x1 - f.x0);
    var lado = x < f.cx ? -1 : 1;
    if (Math.random() < 0.25) lado = -lado;          // furos dos dois lados da torre
    var vel = (110 + Math.random() * 260) * base;
    jato.push({
      x: x, y: f.y + (Math.random() - 0.5) * 6,
      vx: lado * vel,
      vy: (-18 + Math.random() * 22) * base,
      t: 0, vida: 7 + Math.random() * 7,
      r0: 5 + Math.random() * 5, r1: (150 + Math.random() * 200) * base,
      a: 0.1 + Math.random() * 0.1,
      fase: Math.random() * 6.28
    });
  }

  function nascerAmbiente(espalhar) {
    ambiente.push({
      x: Math.random() * W, y: window.scrollY + Math.random() * H,
      vx: (Math.random() - 0.5) * 14, vy: 4 + Math.random() * 8,
      t: espalhar ? Math.random() * 12 : 0, vida: 12 + Math.random() * 8,
      r: (380 + Math.random() * 320) * base,
      a: 0.04 + Math.random() * 0.035,
      fase: Math.random() * 6.28
    });
  }

  function passo(dt, tempo) {
    var f = fonte();
    if (f) {
      acum += dt * 48;
      while (acum >= 1) { nascerJato(f); acum -= 1; }
      while (ambiente.length < 18) nascerAmbiente(false);
    }

    for (var i = jato.length - 1; i >= 0; i--) {
      var p = jato[i];
      p.t += dt;
      if (p.t >= p.vida) { jato.splice(i, 1); continue; }
      var arrasto = Math.pow(0.62, dt);
      p.vx *= arrasto;
      p.vy = p.vy * arrasto + 7 * base * dt * 3;      // a névoa fria desce devagar
      p.x += (p.vx + Math.sin(tempo * 0.5 + p.fase) * 10 * base) * dt;
      p.y += (p.vy + Math.cos(tempo * 0.4 + p.fase) * 5 * base) * dt;
    }
    for (var j = ambiente.length - 1; j >= 0; j--) {
      var q = ambiente[j];
      q.t += dt;
      if (q.t >= q.vida) { ambiente.splice(j, 1); continue; }
      q.x += (q.vx + Math.sin(tempo * 0.2 + q.fase) * 8) * dt;
      q.y += q.vy * dt;
    }
  }

  function pintar(p, r, alfa, sy) {
    var y = p.y - sy;
    if (alfa <= 0.003 || y + r < 0 || y - r > H || p.x + r < 0 || p.x - r > W) return;
    ctx.globalAlpha = alfa;
    ctx.drawImage(sp, p.x - r, y - r * 0.7, r * 2, r * 1.4);
  }

  function desenhar() {
    var sy = window.scrollY;
    ctx.clearRect(0, 0, W, H);
    for (var j = 0; j < ambiente.length; j++) {
      var q = ambiente[j], k = q.t / q.vida;
      pintar(q, q.r, q.a * Math.sin(Math.PI * k), sy);
    }
    for (var i = 0; i < jato.length; i++) {
      var p = jato[i], kk = p.t / p.vida;
      var r = p.r0 + (p.r1 - p.r0) * Math.pow(kk, 0.8);
      pintar(p, r, p.a * Math.min(1, kk * 10) * Math.pow(1 - kk, 1.5), sy);
    }
    ctx.globalAlpha = 1;
  }

  function quadro(ts) {
    if (!rodando) return;
    var dt = ult ? Math.min((ts - ult) / 1000, 0.05) : 0.016;
    ult = ts;
    passo(dt, ts / 1000);
    desenhar();
    requestAnimationFrame(quadro);
  }

  function ativo() { return !!torre.getBoundingClientRect().width; }

  function aquecer() {
    jato = []; ambiente = [];
    if (!ativo()) return;
    for (var a = 0; a < 18; a++) nascerAmbiente(true);
    for (var i = 0, t = 0; i < 260; i++, t += 0.04) passo(0.04, t);
    desenhar();
  }

  function ligar() {
    if (rodando || document.hidden || !ativo()) return;
    if (reduzir) { desenhar(); return; }
    rodando = true; ult = 0; requestAnimationFrame(quadro);
  }
  function desligar() { rodando = false; }

  medir();
  aquecer();
  ligar();

  window.addEventListener('resize', function () { medir(); desenhar(); });
  window.addEventListener('scroll', function () { if (!rodando) desenhar(); }, { passive: true });
  document.addEventListener('visibilitychange', function () { document.hidden ? desligar() : ligar(); });

  // o portal fica oculto até o login e some ao sair: acompanha a torre
  if ('ResizeObserver' in window) {
    var antes = false;
    new ResizeObserver(function () {
      var agora = ativo();
      if (agora && !antes) { medir(); aquecer(); ligar(); }
      if (!agora && antes) { desligar(); jato = []; ambiente = []; ctx.clearRect(0, 0, W, H); }
      antes = agora;
    }).observe(torre);
  }
})();
