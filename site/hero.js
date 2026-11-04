// Névoa da capa: jatos saindo dos furos da torre de inox, que viram nuvem,
// giram com o ar e se espalham devagar pela página inteira.
// A camada fica por cima de tudo, sem bloquear cliques (pointer-events: none).
(function () {
  var torre = document.getElementById('heroTorre');
  var cv = document.getElementById('nevoaPagina');
  if (!torre || !cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');

  // Furos na imagem da torre (fração da largura/altura).
  // dir: -1 sai para a esquerda, 1 para a direita, 0 de frente (abre para os dois lados)
  var FUROS = [
    { x: 0.12, y: 0.112, dir: -1 },
    { x: 0.33, y: 0.108, dir: 0 },
    { x: 0.72, y: 0.108, dir: 0 },
    { x: 0.90, y: 0.112, dir: 1 }
  ];

  // ── texturas de névoa: ruído fractal dentro de uma borda suave ──
  function ruido(seed) {
    var N = 32, v = [], s = seed * 9301 + 49297;
    for (var i = 0; i < N * N; i++) { s = (s * 9301 + 49297) % 233280; v.push(s / 233280); }
    function at(x, y) { return v[((y % N + N) % N) * N + ((x % N + N) % N)]; }
    function sm(t) { return t * t * (3 - 2 * t); }
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
      var a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
  }
  function textura(seed) {
    var T = 128, c = document.createElement('canvas');
    c.width = c.height = T;
    var g = c.getContext('2d'), img = g.createImageData(T, T), n = ruido(seed);
    for (var y = 0; y < T; y++) for (var x = 0; x < T; x++) {
      var fx = x / T * 4, fy = y / T * 4;
      var f = n(fx, fy) * 0.5 + n(fx * 2, fy * 2) * 0.27 + n(fx * 4, fy * 4) * 0.15 + n(fx * 8, fy * 8) * 0.08;
      var dx = (x - T / 2) / (T / 2), dy = (y - T / 2) / (T / 2);
      var r = Math.sqrt(dx * dx + dy * dy);
      var borda = Math.max(0, 1 - r);
      borda = borda * borda * (3 - 2 * borda);
      var al = Math.max(0, Math.min(1, (f - 0.28) * 1.9)) * borda;
      var k = (y * T + x) * 4;
      img.data[k] = 236; img.data[k + 1] = 244; img.data[k + 2] = 247;
      img.data[k + 3] = Math.round(al * 255);
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  var tex = [textura(3), textura(11), textura(27), textura(42)];

  // núcleo do jato: mancha lisa e mais densa
  var nucleo = document.createElement('canvas');
  nucleo.width = nucleo.height = 64;
  (function () {
    var g = nucleo.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(245,250,252,0.9)');
    rg.addColorStop(0.45, 'rgba(235,244,247,0.35)');
    rg.addColorStop(1, 'rgba(235,244,247,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  })();

  var parts = [], ambiente = [];
  var W = 0, H = 0, dpr = 1, base = 1, tempo = 0;
  var rodando = false, ult = 0, acum = 0, media = 0.016, qualidade = 1;
  var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function medir() {
    // névoa é desfocada por natureza: meia resolução fica igual e custa 4x menos
    dpr = 0.5;
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    base = Math.min(Math.max(W / 1000, 0.6), 1.1);
  }

  function posTorre() {
    var r = torre.getBoundingClientRect();
    if (!r.width) return null;
    return { l: r.left, t: r.top + window.scrollY, w: r.width, h: r.height };
  }

  // jato: sai pequeno, rápido e denso; perde força e vira nuvem
  function nascer(p) {
    var f = FUROS[(Math.random() * FUROS.length) | 0];
    var lado = f.dir || (Math.random() < 0.5 ? -1 : 1);
    var ang = (Math.random() - 0.5) * 0.45 - 0.03;           // leque do jato, levemente para cima
    var vel = (260 + Math.random() * 260) * base;
    parts.push({
      x: p.l + p.w * f.x, y: p.t + p.h * f.y,
      vx: lado * Math.cos(ang) * vel * (f.dir ? 1 : 0.75),
      vy: Math.sin(ang) * vel,
      t: 0, vida: 6 + Math.random() * 7,
      r0: 3 + Math.random() * 3, r1: (110 + Math.random() * 190) * base,
      a: 0.1 + Math.random() * 0.08,
      rot: Math.random() * 6.28, giro: (Math.random() - 0.5) * 0.5,
      tx: tex[(Math.random() * tex.length) | 0]
    });
  }

  function nascerAmbiente(espalhar) {
    ambiente.push({
      x: Math.random() * W, y: window.scrollY + Math.random() * H,
      vx: (Math.random() - 0.5) * 12, vy: 3 + Math.random() * 6,
      t: espalhar ? Math.random() * 14 : 0, vida: 14 + Math.random() * 10,
      r: (320 + Math.random() * 300) * base, a: 0.05 + Math.random() * 0.04,
      rot: Math.random() * 6.28, giro: (Math.random() - 0.5) * 0.06,
      tx: tex[(Math.random() * tex.length) | 0]
    });
  }

  // campo de vento suave: faz a névoa ondular e enrolar
  function vento(x, y) {
    var s = 0.006 / base;
    return {
      x: Math.sin(y * s + tempo * 0.35) * 16 + Math.sin((x + y) * s * 0.6 - tempo * 0.2) * 10,
      y: Math.cos(x * s * 0.8 + tempo * 0.3) * 9
    };
  }

  function passo(dt) {
    tempo += dt;
    var p = posTorre();
    if (p) {
      acum += dt * 42 * qualidade;
      while (acum >= 1) { nascer(p); acum -= 1; }
      while (ambiente.length < 14) nascerAmbiente(false);
    }
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i];
      q.t += dt;
      if (q.t >= q.vida) { parts.splice(i, 1); continue; }
      var arrasto = Math.pow(0.18, dt);                        // o jato freia rápido no ar
      q.vx *= arrasto; q.vy *= arrasto;
      q.vy += 14 * base * dt;                                  // névoa fria assenta devagar
      var v = vento(q.x, q.y), mistura = Math.min(1, q.t / 1.2);
      q.x += (q.vx + v.x * base * mistura) * dt;
      q.y += (q.vy + v.y * base * mistura) * dt;
      q.rot += q.giro * dt;
    }
    for (var j = ambiente.length - 1; j >= 0; j--) {
      var a = ambiente[j];
      a.t += dt;
      if (a.t >= a.vida) { ambiente.splice(j, 1); continue; }
      var va = vento(a.x, a.y);
      a.x += (a.vx + va.x * 0.6) * dt; a.y += (a.vy + va.y * 0.4) * dt;
      a.rot += a.giro * dt;
    }
  }

  function pintar(img, x, y, r, esticar, rot, alfa) {
    if (alfa <= 0.004 || y + r * esticar < 0 || y - r * esticar > H || x + r * esticar < 0 || x - r * esticar > W) return;
    var c = Math.cos(rot), s = Math.sin(rot), e2 = 1 / Math.sqrt(esticar);
    ctx.globalAlpha = alfa;
    ctx.setTransform(dpr * c * esticar, dpr * s * esticar, -dpr * s * e2, dpr * c * e2, dpr * x, dpr * y);
    ctx.drawImage(img, -r, -r, r * 2, r * 2);
  }

  function desenhar() {
    var sy = window.scrollY;
    ctx.clearRect(0, 0, W, H);
    for (var j = 0; j < ambiente.length; j++) {
      var a = ambiente[j], ka = a.t / a.vida;
      pintar(a.tx, a.x, a.y - sy, a.r, 1.6, a.rot, a.a * Math.sin(Math.PI * ka));
    }
    for (var i = 0; i < parts.length; i++) {
      var q = parts[i], k = q.t / q.vida;
      var r = q.r0 + (q.r1 - q.r0) * Math.pow(k, 0.85);
      var alfa = q.a * Math.min(1, k * 12) * Math.pow(1 - k, 1.3);
      var y = q.y - sy;
      if (q.t < 0.9) {
        // começo do jato: núcleo denso, alongado na direção do movimento
        var d = Math.atan2(q.vy, q.vx);
        pintar(nucleo, q.x, y, Math.min(r * 0.9, 30 * base), 2.6, d, Math.min(0.5, alfa * 3) * (1 - q.t / 0.9));
      }
      pintar(q.tx, q.x, y, r, 1.3, q.rot, alfa);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function quadro(ts) {
    if (!rodando) return;
    var dt = ult ? Math.min((ts - ult) / 1000, 0.05) : 0.016;
    ult = ts;
    // aparelho lento: reduz a quantidade de névoa em vez de travar a página
    media = media * 0.95 + dt * 0.05;
    if (media > 0.034 && qualidade > 0.35) qualidade -= 0.01;
    else if (media < 0.02 && qualidade < 1) qualidade += 0.005;
    passo(dt);
    desenhar();
    requestAnimationFrame(quadro);
  }

  function ativo() { return !!torre.getBoundingClientRect().width; }

  function aquecer() {
    parts = []; ambiente = [];
    if (!ativo()) return;
    for (var a = 0; a < 14; a++) nascerAmbiente(true);
    for (var i = 0; i < 300; i++) passo(0.035);
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
      if (!agora && antes) { desligar(); parts = []; ambiente = []; ctx.clearRect(0, 0, W, H); }
      antes = agora;
    }).observe(torre);
  }
})();
