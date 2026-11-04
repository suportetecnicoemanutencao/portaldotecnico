// Névoa da capa: partículas saindo dos bicos da tubulação sobre a NB400.
// Coordenadas no mesmo sistema do SVG (viewBox 0 0 1000 900).
(function () {
  var arte = document.getElementById('heroArte');
  var cv = document.getElementById('heroNevoa');
  if (!arte || !cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');

  // linha central do tubo horizontal (acompanha a perspectiva da máquina)
  var Y0 = 170, X0 = 257, INC = 0.089;
  var bicos = [];
  for (var x = 455; x <= 935; x += 68) bicos.push({ x: x, y: Y0 + (x - X0) * INC + 4 });

  // sprite de névoa: mancha branca de borda bem suave
  var sp = document.createElement('canvas');
  sp.width = sp.height = 128;
  var g = sp.getContext('2d');
  var rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(235,245,248,0.55)');
  rg.addColorStop(0.35, 'rgba(225,238,242,0.28)');
  rg.addColorStop(0.7, 'rgba(215,232,238,0.08)');
  rg.addColorStop(1, 'rgba(215,232,238,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);

  var parts = [], escala = 1, w = 0, h = 0, rodando = false, visivel = true, ult = 0, acum = 0;
  var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function medir() {
    var r = arte.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    escala = w / 1000;
    ctx.setTransform(dpr * escala, 0, 0, dpr * escala, 0, 0);
  }

  function nascer(b) {
    var vida = 4.5 + Math.random() * 3.5;
    parts.push({
      x: b.x + (Math.random() - 0.5) * 6, y: b.y + (Math.random() - 0.5) * 4,
      vx: 14 + Math.random() * 34,           // jato saindo do bico
      vy: 45 + Math.random() * 45,           // para baixo/frente, como no equipamento
      t: 0, vida: vida,
      r0: 10 + Math.random() * 8, r1: 120 + Math.random() * 120,
      a: 0.26 + Math.random() * 0.2,
      fase: Math.random() * 6.28, rot: Math.random() * 6.28
    });
  }

  function passo(dt, tempo) {
    // ~6 partículas por segundo por bico
    acum += dt * 6 * bicos.length;
    while (acum >= 1) { nascer(bicos[(Math.random() * bicos.length) | 0]); acum -= 1; }

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.t += dt;
      if (p.t >= p.vida) { parts.splice(i, 1); continue; }
      // o jato perde força e a névoa passa a flutuar e subir devagar
      var arrasto = Math.pow(0.5, dt);
      p.vx *= arrasto; p.vy *= arrasto;
      p.vy -= 11 * dt;
      p.x += (p.vx + Math.sin(tempo * 0.6 + p.fase) * 6) * dt;
      p.y += (p.vy + Math.cos(tempo * 0.45 + p.fase) * 3) * dt;
    }
  }

  function desenhar() {
    ctx.clearRect(0, 0, 1000, 900);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], k = p.t / p.vida;
      var r = p.r0 + (p.r1 - p.r0) * Math.sqrt(k);
      var alfa = p.a * Math.min(1, k * 5) * Math.pow(1 - k, 1.6);
      if (alfa <= 0.003) continue;
      ctx.globalAlpha = alfa;
      ctx.drawImage(sp, p.x - r, p.y - r * 0.8, r * 2, r * 1.6);
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

  function ligar() {
    if (rodando || reduzir || !visivel || document.hidden || !w) return;
    rodando = true; ult = 0; requestAnimationFrame(quadro);
  }
  function desligar() { rodando = false; }

  // pré-aquece para a névoa já aparecer formada
  function aquecer() {
    medir();
    if (!w) return;
    parts = [];
    for (var i = 0, t = 0; i < 300; i++, t += 0.033) passo(0.033, t);
    desenhar();
  }

  aquecer();
  ligar();

  window.addEventListener('resize', function () { medir(); desenhar(); });
  document.addEventListener('visibilitychange', function () { document.hidden ? desligar() : ligar(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      visivel = e[0].isIntersecting;
      visivel ? ligar() : desligar();
    }).observe(arte);
  }
  // o portal fica oculto até o login: quando aparecer, mede e liga
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      var antes = w; medir();
      if (!antes && w) { aquecer(); ligar(); } else desenhar();
    }).observe(arte);
  }
})();
