import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const C  = window.NBZ || {};

if (C.SUPABASE_ANON_KEY && C.SUPABASE_ANON_KEY.startsWith('sb_publishable_')) {
  window.__falhar && window.__falhar(
    'Formato de chave incompatível',
    'A chave em config.js começa com "sb_publishable_", formato novo que esta versão da ' +
    'biblioteca não reconhece.\n\nNo Supabase, vá em Project Settings > API Keys, ' +
    'procure as chaves legadas (Legacy / JWT) e copie a chave "anon public", a longa que ' +
    'começa com eyJ. Substitua apenas esse valor no config.js.'
  );
}

const sb = createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
const $  = (id) => document.getElementById(id);

let eu = null;          // registro do técnico
let historico = [];
let recuperando = false;

// ───────── auxiliares ─────────
const mostrar = (el, txt) => { el.textContent = txt || ''; el.classList.toggle('on', !!txt); };

function ocupado(b, estado, txt) {
  b.disabled = estado;
  if (estado) { b.dataset.t = b.textContent; b.textContent = txt || 'Aguarde…'; }
  else if (b.dataset.t) b.textContent = b.dataset.t;
}

function tela(id) {
  ['carregando','telaEntrada','telaNovaSenha','telaEspera','telaPortal']
    .forEach((t) => $(t).classList.toggle('oculto', t !== id));
  window.scrollTo(0, 0);
}

function senhaValida(s) {
  return String(s).length >= 8 && /[A-Za-z]/.test(s) && /[0-9]/.test(s);
}

function traduzir(msg) {
  const m = String(msg || '');
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m))       return 'Confirmação de e-mail ainda ligada no Supabase. Fale com a manutenção.';
  if (/User already registered/i.test(m))   return 'Já existe um cadastro com esse e-mail.';
  if (/rate limit|too many/i.test(m))       return 'Muitas tentativas. Aguarde alguns minutos.';
  if (/Password should be/i.test(m))        return 'Senha muito curta. Use ao menos 8 caracteres.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet.';
  return m || 'Não foi possível concluir. Tente novamente.';
}

const registrar = (acao, detalhe) =>
  sb.from('acessos').insert({ tecnico: eu?.id, email: eu?.email, acao, detalhe }).then(() => {}, () => {});

// ───────── sessão ─────────
sb.auth.onAuthStateChange((evento, sessao) => {
  if (evento === 'PASSWORD_RECOVERY') { recuperando = true; tela('telaNovaSenha'); return; }
  if (recuperando) return;
  if (sessao) carregarTecnico(); else { eu = null; tela('telaEntrada'); }
});

async function carregarTecnico(tentativa = 0) {
  const { data, error } = await sb.from('tecnicos').select('*').single();

  // logo após o cadastro, o registro pode levar um instante para existir
  if ((error || !data) && tentativa < 3) {
    await new Promise((r) => setTimeout(r, 700));
    return carregarTecnico(tentativa + 1);
  }

  if (error || !data) {
    mostrar($('erroLogin'), 'Cadastro não encontrado. Fale com a manutenção.');
    await sb.auth.signOut();
    return tela('telaEntrada');
  }
  eu = data;

  if (data.status !== 'aprovado') {
    $('esperaNome').textContent = data.nome;
    if (data.status === 'bloqueado') {
      $('esperaTitulo').textContent = 'Acesso desativado';
      $('esperaTexto').textContent = 'Seu acesso foi desativado. Fale com a manutenção se isso não estiver correto.';
    }
    $('btnVerificar').classList.toggle('oculto', data.status !== 'pendente');
    $('esperaWhats').href = 'https://wa.me/' + C.WHATSAPP;
    $('esperaTel').href = 'tel:' + C.TELEFONE;
    return tela('telaEspera');
  }

  $('saudacao').textContent = 'Olá, ' + String(data.nome).split(' ')[0];
  $('linkWhats').href = 'https://wa.me/' + C.WHATSAPP;
  $('linkTel').href = 'tel:' + C.TELEFONE;
  $('abaUsuarios').classList.toggle('oculto', data.perfil !== 'admin');

  sb.rpc('marcar_acesso').then(() => {}, () => {});
  registrar('login', data.perfil);
  await carregarRecursos();
  tela('telaPortal');
}

// ───────── recursos (links protegidos pelo RLS) ─────────
async function carregarRecursos() {
  const alvo = $('listaRecursos');
  alvo.textContent = '';

  const { data, error } = await sb.from('recursos').select('*').order('ordem');
  if (error || !data?.length) {
    alvo.textContent = 'Não foi possível carregar os formulários. Atualize a página ou chame a manutenção.';
    return;
  }

  const icones = {
    nota:  '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
    pecas: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>'
  };

  data.forEach((r, i) => {
    const a = document.createElement('a');
    a.className = 'acao' + (i % 2 ? ' b' : '');
    a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
    a.addEventListener('click', () => registrar('abriu formulário', r.chave));

    const ico = document.createElement('span');
    ico.className = 'ico';
    ico.innerHTML = '<svg viewBox="0 0 24 24">' + (icones[r.chave] || icones.nota) + '</svg>';

    const tx = document.createElement('span');
    tx.className = 'tx';
    const b = document.createElement('b'); b.textContent = r.titulo;
    const s = document.createElement('span'); s.textContent = r.descricao || '';
    tx.append(b, s);

    const seta = document.createElement('span');
    seta.className = 'seta'; seta.textContent = '→';

    a.append(ico, tx, seta);
    alvo.appendChild(a);
  });
}

// ───────── entrada ─────────
const trocarBox = (mostrarId) => {
  ['boxLogin','boxCadastro','boxEsqueci'].forEach((b) => $(b).classList.toggle('oculto', b !== mostrarId));
};
$('irCadastro').onclick = (e) => { e.preventDefault(); trocarBox('boxCadastro'); };
$('irEsqueci').onclick  = (e) => { e.preventDefault(); trocarBox('boxEsqueci'); };
document.querySelectorAll('.voltarLogin').forEach((a) => {
  a.onclick = (e) => { e.preventDefault(); trocarBox('boxLogin'); };
});

$('btnEntrar').onclick = async function () {
  mostrar($('erroLogin'), ''); mostrar($('okLogin'), '');
  const email = $('lgEmail').value.trim(), senha = $('lgSenha').value;
  if (!email || !senha) return mostrar($('erroLogin'), 'Preencha e-mail e senha.');

  ocupado(this, true, 'Entrando…');
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  ocupado(this, false);
  if (error) mostrar($('erroLogin'), traduzir(error.message));
  else $('lgSenha').value = '';
};
$('lgSenha').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnEntrar').click(); });

$('btnCadastrar').onclick = async function () {
  mostrar($('erroCadastro'), ''); mostrar($('okCadastro'), '');
  const nome = $('cdNome').value.trim();
  const email = $('cdEmail').value.trim();
  const celular = $('cdCel').value.replace(/\D/g, '');
  const empresa = $('cdEmpresa').value.trim();
  const senha = $('cdSenha').value;

  if (nome.length < 3) return mostrar($('erroCadastro'), 'Informe seu nome completo.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return mostrar($('erroCadastro'), 'E-mail inválido.');
  if (celular.length < 10) return mostrar($('erroCadastro'), 'Celular inválido. Use DDD + número.');
  if (!senhaValida(senha)) return mostrar($('erroCadastro'), 'A senha precisa ter 8 caracteres, com letras e números.');

  ocupado(this, true, 'Enviando…');
  const { error } = await sb.auth.signUp({
    email, password: senha,
    options: { data: { nome, celular, empresa }, emailRedirectTo: window.location.origin }
  });
  ocupado(this, false);

  if (error) return mostrar($('erroCadastro'), traduzir(error.message));
  mostrar($('okCadastro'), 'Cadastro enviado. Assim que a manutenção aprovar, entre com seu e-mail e a senha que você acabou de criar.');
  ['cdNome','cdEmail','cdCel','cdEmpresa','cdSenha'].forEach((i) => { $(i).value = ''; });
};

$('btnEsqueci').onclick = async function () {
  mostrar($('erroEsqueci'), ''); mostrar($('okEsqueci'), '');
  const email = $('esEmail').value.trim();
  if (!email) return mostrar($('erroEsqueci'), 'Informe seu e-mail.');

  ocupado(this, true, 'Enviando…');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  ocupado(this, false);
  if (error) mostrar($('erroEsqueci'), traduzir(error.message));
  else mostrar($('okEsqueci'), 'Se o e-mail estiver cadastrado, o link de redefinição chegará em instantes.');
};

$('btnNovaSenha').onclick = async function () {
  mostrar($('erroNova'), ''); mostrar($('okNova'), '');
  const nova = $('nvSenha').value;
  if (!senhaValida(nova)) return mostrar($('erroNova'), 'A senha precisa ter 8 caracteres, com letras e números.');

  ocupado(this, true, 'Salvando…');
  const { error } = await sb.auth.updateUser({ password: nova });
  ocupado(this, false);

  if (error) return mostrar($('erroNova'), traduzir(error.message));
  mostrar($('okNova'), 'Senha alterada. Abrindo o portal…');
  recuperando = false;
  setTimeout(carregarTecnico, 900);
};

$('btnVerificar').onclick = async function () {
  ocupado(this, true, 'Verificando…');
  await carregarTecnico();
  ocupado(this, false);
};

document.querySelectorAll('.sair').forEach((b) => {
  b.onclick = async () => {
    await registrar('logout', '');
    await sb.auth.signOut();
    eu = null; historico = []; $('chat').textContent = '';
    trocarBox('boxLogin');
    tela('telaEntrada');
  };
});

$('cardAjuda').onclick = (e) => {
  e.preventDefault();
  document.querySelector('[data-alvo="paNebuleco"]').click();
};

$('btnTrocar').onclick = () => {
  $('esEmail').value = eu?.email || '';
  trocarBox('boxEsqueci');
  mostrar($('okEsqueci'), 'Confirme o envio para receber o link de redefinição.');
  sb.auth.signOut();
  tela('telaEntrada');
};

// ───────── abas ─────────
document.querySelectorAll('.aba').forEach((aba) => {
  aba.onclick = () => {
    document.querySelectorAll('.aba').forEach((a) => a.classList.remove('ativa'));
    document.querySelectorAll('.pagina').forEach((p) => p.classList.add('oculto'));
    aba.classList.add('ativa');
    $(aba.dataset.alvo).classList.remove('oculto');
    if (aba.dataset.alvo === 'paUsuarios') carregarUsuarios();
  };
});

// ───────── nebuleco ─────────
// transforma endereços em links clicáveis sem usar innerHTML
function escreverComLinks(destino, texto) {
  const partes = String(texto).split(/(https?:\/\/[^\s)]+)/g);
  partes.forEach((p, i) => {
    if (!p) return;
    if (i % 2) {
      const a = document.createElement('a');
      a.href = p; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = p.replace(/^https?:\/\//, '');
      destino.appendChild(a);
    } else destino.appendChild(document.createTextNode(p));
  });
}

function balao(classe, texto) {
  const div = document.createElement('div');
  div.className = 'balao ' + classe;
  String(texto).split('\n').forEach((linha, i) => {
    if (i) div.appendChild(document.createElement('br'));
    linha.split(/\*\*(.+?)\*\*/g).forEach((p, j) => {
      if (!p) return;
      if (j % 2) { const b = document.createElement('b'); b.textContent = p; div.appendChild(b); }
      else escreverComLinks(div, p);
    });
  });
  $('chat').appendChild(div);
  $('chat').scrollTop = $('chat').scrollHeight;
  return div;
}

async function perguntar(texto) {
  texto = (texto || $('pergunta').value).trim();
  if (!texto) return;
  $('pergunta').value = '';
  $('sugestoes').classList.add('oculto');
  balao('tec', texto);
  historico.push({ autor: 'tecnico', texto });

  const espera = balao('nebu pensando', 'Nebuleco está consultando o guia…');
  ocupado($('btnPerguntar'), true, 'Enviando…');

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');

    const r = await fetch(C.NEBULECO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ pergunta: texto, historico })
    });
    const json = await r.json().catch(() => ({}));
    espera.remove();

    if (!r.ok) throw new Error(json.erro || 'O Nebuleco está indisponível agora.');
    balao('nebu', json.resposta);
    historico.push({ autor: 'nebuleco', texto: json.resposta });
  } catch (e) {
    espera.remove();
    balao('nebu alerta', traduzir(e.message));
  } finally {
    ocupado($('btnPerguntar'), false);
  }
}

$('btnPerguntar').onclick = () => perguntar();
$('pergunta').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); perguntar(); }
});
document.querySelectorAll('.chip').forEach((c) => { c.onclick = () => perguntar(c.textContent); });

// ───────── usuários ─────────
async function carregarUsuarios() {
  mostrar($('erroAdmin'), ''); mostrar($('okAdmin'), '');
  $('listaUsuarios').textContent = 'Carregando…';

  const { data, error } = await sb.from('tecnicos').select('*').order('criado_em', { ascending: false });
  if (error) {
    $('listaUsuarios').textContent = '';
    return mostrar($('erroAdmin'), traduzir(error.message));
  }

  const peso = { pendente: 0, aprovado: 1, bloqueado: 2 };
  data.sort((a, b) => (peso[a.status] - peso[b.status]) || a.nome.localeCompare(b.nome));

  $('listaUsuarios').textContent = '';
  if (!data.length) { $('listaUsuarios').textContent = 'Nenhum técnico cadastrado.'; return; }

  data.forEach((u) => {
    const card = document.createElement('div');
    card.className = 'usuario ' + u.status;

    const topo = document.createElement('div');
    topo.className = 'u1';
    const nome = document.createElement('b'); nome.textContent = u.nome;
    const pill = document.createElement('span'); pill.className = 'pill ' + u.status; pill.textContent = u.status;
    topo.append(nome, pill);

    const det = document.createElement('div');
    det.className = 'u2';
    const ultimo = u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : '—';
    det.textContent = [u.email, u.celular, u.empresa].filter(Boolean).join(' · ') + ' · último acesso ' + ultimo;

    const acoes = document.createElement('div');
    acoes.className = 'u3';
    if (u.id !== eu.id) {
      [['Aprovar', 'aprovado'], ['Bloquear', 'bloqueado']].forEach(([rotulo, status]) => {
        if (u.status === status) return;
        const b = document.createElement('button');
        b.className = 'btn mini'; b.textContent = rotulo;
        b.onclick = () => mudarStatus(u, status, b);
        acoes.appendChild(b);
      });
    }

    card.append(topo, det, acoes);
    $('listaUsuarios').appendChild(card);
  });
}

async function mudarStatus(u, status, botao) {
  ocupado(botao, true, '…');
  const patch = { status };
  if (status === 'aprovado') patch.aprovado_em = new Date().toISOString();

  const { error } = await sb.from('tecnicos').update(patch).eq('id', u.id);
  ocupado(botao, false);

  if (error) return mostrar($('erroAdmin'), traduzir(error.message));
  mostrar($('okAdmin'), u.nome + ' agora está ' + status + '.');
  registrar('status ' + status, u.email);
  carregarUsuarios();
}

// ───────── início ─────────
try {
  if (!C || !C.SUPABASE_URL || C.SUPABASE_URL.includes('SEU-PROJETO')) {
    throw new Error('config.js ainda está com os valores de exemplo. ' +
      'Preencha SUPABASE_URL, SUPABASE_ANON_KEY e NEBULECO_URL.');
  }
  if (window.location.hash.includes('type=recovery')) { recuperando = true; tela('telaNovaSenha'); }
  else {
    const { data: { session } } = await sb.auth.getSession();
    if (session) await carregarTecnico(); else tela('telaEntrada');
  }
} catch (e) {
  if (window.__falhar) window.__falhar('Não foi possível iniciar o portal', e.message || String(e));
  else document.getElementById('carregando').textContent = 'Erro: ' + (e.message || e);
}
