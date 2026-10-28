// Diagnóstico: mostra na própria tela qualquer falha de carregamento.
(function () {
  var mostrado = false;
  function falhar(titulo, detalhe) {
    if (mostrado) return;
    mostrado = true;
    var c = document.getElementById('carregando');
    if (!c) return;
    c.style.flexDirection = 'column';
    c.style.textAlign = 'left';
    c.style.padding = '20px';
    c.innerHTML = '';
    var t = document.createElement('div');
    t.style.cssText = 'color:#E06A5A;font-weight:600;margin-bottom:10px;font-size:15px';
    t.textContent = titulo;
    var d = document.createElement('pre');
    d.style.cssText = 'color:#93AF9C;font-size:12px;line-height:1.6;white-space:pre-wrap;' +
      'word-break:break-word;max-width:640px;background:#12221B;border:1px solid #22402F;' +
      'border-radius:10px;padding:14px';
    d.textContent = detalhe;
    c.appendChild(t); c.appendChild(d);
  }
  window.__falhar = falhar;

  window.addEventListener('error', function (e) {
    if (e.target && e.target.tagName === 'SCRIPT') {
      falhar('Não foi possível carregar um script', 'Arquivo: ' + (e.target.src || '(inline)') +
        '\n\nSe for o cdn.jsdelivr.net, verifique a conexão ou o bloqueio de CSP no netlify.toml.');
    } else if (e.message) {
      falhar('Erro de execução', e.message + '\n\n' + (e.filename || '') + ' linha ' + (e.lineno || '?'));
    }
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var m = e.reason && e.reason.message ? e.reason.message : String(e.reason);
    falhar('Falha ao conectar', m + '\n\nConfira SUPABASE_URL e SUPABASE_ANON_KEY no config.js, ' +
      'e se o schema.sql já foi executado no Supabase.');
  });

  setTimeout(function () {
    var c = document.getElementById('carregando');
    if (c && !c.classList.contains('oculto') && !mostrado) {
      falhar('A página não terminou de carregar', [
        'Verifique, nesta ordem:',
        '',
        '1. config.js preenchido com a URL e a chave anon do seu projeto',
        '2. A chave anon é a longa, que começa com eyJ',
        '3. O schema.sql já foi executado no SQL Editor do Supabase',
        '4. As tabelas tecnicos, recursos, acessos e nebuleco_log existem'
      ].join('\n'));
    }
  }, 10000);
})();
