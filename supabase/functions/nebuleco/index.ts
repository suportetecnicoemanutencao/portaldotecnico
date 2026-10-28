// ════════════════════════════════════════════════════════════════
// NEBULECO · Edge Function (arquivo único)
// Cole este conteúdo inteiro no editor do Supabase.
//
// Antes de testar, cadastre os secrets em
// Project Settings > Edge Functions > Secrets:
//   GEMINI_API_KEY        chave do aistudio.google.com/apikey
//   ORIGENS_PERMITIDAS    https://portaldotecnico.nebulize.com.br
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// NEBULECO · Edge Function
// Valida a sessão do técnico, confere a aprovação e consulta o Gemini.
// A chave da API fica no servidor: nunca chega ao navegador.
// ════════════════════════════════════════════════════════════════

import { createClient } from "jsr:@supabase/supabase-js@2";

const MODELO = Deno.env.get("MODELO_IA") ?? "gemini-2.0-flash";
const ORIGENS = (Deno.env.get("ORIGENS_PERMITIDAS") ??
  "https://portaldotecnico.nebulize.com.br").split(",").map((o) => o.trim());

const LIMITE_HORA = 40;

function cors(origem: string | null) {
  const permitida = origem && ORIGENS.includes(origem) ? origem : ORIGENS[0];
  return {
    "Access-Control-Allow-Origin": permitida,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function responder(corpo: unknown, status: number, origem: string | null) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors(origem), "Content-Type": "application/json" },
  });
}


// ─────────── Base de conhecimento ───────────


const INSTRUCAO = [
  "Você é o Nebuleco, assistente técnico da Nebulize. No Portal do Técnico você atende EXCLUSIVAMENTE técnicos de campo autenticados — profissionais que abrem o equipamento, medem com multímetro e trocam peça.",
  "",
  "Nível da conversa:",
  "- Fale como técnico fala com técnico. Use o vocabulário do guia: PCI de Controle, PCI de Potência, ressonador, transdutor, cabo Mike, Atomizing Module, Cooling Fan, NTC, via, pino, conector de 24 vias.",
  "- Nada de linguagem de cliente final. Não explique o que é nebulização nem use emoji.",
  "- Vá direto: causa provável, o que medir, onde medir e o valor esperado. Passos numerados e curtos.",
  "- Toda medição sai completa: ponto (via, pino ou conector), grandeza (CA, CC, continuidade) e valor esperado. Sem valor, não é medição.",
  "- Siga a ordem do fluxo de diagnóstico do guia: entrada 220V, fonte, cabo Mike, LEDs e display, cargas, sensor, válvula, ressonador, cerâmicas, microventilador. Não pule para troca de placa sem as medições anteriores.",
  "- Pergunte o modelo quando a resposta mudar conforme o modelo e o técnico não tiver dito qual é. Uma pergunta por vez.",
  "- Quando o técnico disser o que já mediu, continue do ponto onde ele parou em vez de repetir o que já foi feito.",
  "",
  "Vídeos:",
  "- Quando houver vídeo do catálogo para o caso, indique-o pelo título e cole o link completo numa linha própria.",
  "- Só indique vídeo que esteja na lista abaixo. Nunca invente título ou endereço de vídeo.",
  "- O vídeo complementa a resposta técnica, nunca a substitui.",
  "",
  "Segurança:",
  "- Sempre que o passo envolver abrir o equipamento ou tocar em parte energizada, lembre: desligar, tirar da tomada e desligar o disjuntor.",
  "- Diante de risco elétrico, estrutura metálica sem aterramento, água contaminada ou suspeita de choque, mande parar e acionar a manutenção antes de prosseguir.",
  "",
  "Limites:",
  "- Responda apenas com base no guia e no catálogo de vídeos abaixo. Se não constar, diga que não consta e oriente acionar a manutenção pelo WhatsApp (41) 9231-2056.",
  "- Nunca invente tensão, pino, via, código de erro, peça ou procedimento.",
  "- Não trate de preço, orçamento, comissão, garantia comercial ou condição de pagamento: isso é com a Nebulize.",
  "- Caso de campo que o guia não cobre, ou equipamento fora do padrão: encaminhe para a manutenção em vez de improvisar."
].join("\n");

const BASE = [
'# GUIA TÉCNICO DE CAMPO NEBULIZE',
'',
'## Regras gerais de segurança e instalação',
'Toda troca de peça com a máquina desligada, cabo fora da tomada e disjuntor DESLIGADO.',
'Tomada 220V exclusiva, aterrada, disjuntor 10A, quadro estabilizado. Proibido benjamim, extensão ou adaptador.',
'Estrutura metálica sem aterramento representa risco de choque.',
'Água potável, baixo cloro (carvão ativado), pressão de 0,5 a 7 bar, entrada até 30 °C.',
'Cerâmicas têm vida útil de aproximadamente 5.000 horas.',
'Esgoto em PVC 40 mm, máquina pelo menos 15 cm acima do esgoto, sifão sem barrigas.',
'Sem ponto de água: reservatório de 20 L ou 50 L, coluna d\'água máxima de 1,5 m.',
'Poço artesiano: exigir análise físico-química e microbiológica, pré-filtro de sedimentos, abrandador se a água for dura, e combinar por escrito a troca mais frequente de filtros.',
'Rede elétrica ruim (oscilação, picos, aterramento deficiente) causa névoa fraca ou intermitente, erros no painel e reduz a vida das cerâmicas.',
'',
'## Causas mais comuns de chamado',
'Filtro entupido; cerâmica encrustada; tanque sujo ou com resíduo de sabão; ventilador ou tela sujos; mangueira dobrada ou com barriga; registro de esvaziamento aberto; tubulação sem caimento; linha automática desligada à noite, o que impede a autolimpeza.',
'',
'## O que anula a garantia',
'Não usar a filtragem fornecida; intervenção de técnico não autorizado; remoção do número de série ou do lacre; falha de energia ou falta de água; corrosão química; instalação inadequada; transporte ou quedas.',
'',
'## Fluxo geral de diagnóstico',
'1. Confirmar 220V CA na entrada.',
'2. Medir a saída da fonte principal (12V, 24V ou 48V conforme o modelo).',
'3. Testar continuidade do cabo Mike 2W.',
'4. Observar LEDs e display. Sem display, suspeitar da PCI de Controle.',
'5. Na linha NBi, desconectar o Cooling Fan.',
'6. Na linha NBi, desconectar os Atomizing Modules um a um.',
'7. Testar continuidade do sensor de nível.',
'8. Medir 220V CA na válvula de entrada.',
'9. Medir tensão no ressonador (±42V no NB400, ±48V no NB100S). Sem tensão, suspeitar da PCI de Potência.',
'10. Inspecionar visualmente as cerâmicas.',
'11. Medir tensão e conferir o giro do microventilador.',
'',
'## NB400 e NB800 (conector de 24 vias)',
'Medições: L/N 220V CA; fonte 12V CC na PCI de Controle (CN4/CN5); fonte 48V CC na PCI de Potência; bateria RTC acima de 3,0V; vias 13/14 do ressonador ±42V CC (no NB800 também as vias 15/16); vias 19/20 do nível com continuidade; vias 21/22 do ventilador ±10V CC; vias 11/12 Val.IN 220V CA; vias 7/8 Val.OUT 220V CA; vias 23/24 e 9/10 NTC com resistência variável.',
'Sintomas: tudo apagado indica rede, disjuntor, fonte 12V ou PCI de Controle. Só o Standby aceso indica bateria de 3V fraca ou horário zerado. Não ventila: medir vias 21/22; sem tensão é PCI de Controle, com tensão é o microventilador. Não nebuliza: verificar fonte 48V, vias 13/14 (PCI de Potência) ou o transdutor de 10 cerâmicas. S.AGUA: checar vias 11/12 e a válvula de entrada, a fonte encapsulada de 12V, a eletrobomba, o sensor de nível nas vias 19/20, o cabo Mike e a presença de ar na bomba, purgando se necessário. Transbordando com o LED de Enchimento apagado indica relé Val.OUT colado na PCI de Potência. Botões acionando sozinhos indicam umidade ou corrosão na PCI de Controle.',
'Códigos de erro: Err01 lógica dos sensores de nível (pinos 19/20); Err02 tempo de enchimento excedido; Err03 sobretemperatura na nebulização (água acima de 30 °C ou NTC); Err04 sobretemperatura na esterilização; Err05 aquecedor de 1 kW não aquece; Err06 drenagem lenta (conferir tubo de 22 mm, dreno, bomba de esvaziamento e desnível de 15 cm); Err07 vazamento na esterilização.',
'O equipamento não para quando registra erro: grava na memória e acende o LED de Alarme.',
'Não desligar NB400 e NB800 no fim do expediente, porque a esterilização diária é automática. A esterilização leva cerca de 40 minutos, aquece de 70 a 80 °C, drena e repõe a água (parâmetro StErE). O parâmetro SEnSE só deve ser ajustado por técnico com instrumento aferido.',
'',
'## NB3i, NB6i e NB10i (linha manual, chicote LowCost, manual Rev.02 de setembro de 2026)',
'LEDs: verde indica nebulizando; vermelho indica ligado sem nebulizar, o que é normal; os dois piscando juntos uma vez por segundo indicam reabastecimento, também normal; piscando alternados uma vez por segundo indicam falha de abastecimento após 7 minutos, quando bomba e válvula desligam e o equipamento rearma sozinho. Nesse caso, verificar ponto de água, registro de esvaziamento e filtros, depois a válvula de entrada e o sensor.',
'Knobs de % Nebulização e % Ventilação na Rev.02: vermelho é baixo (0 a 33%), amarelo é médio (34 a 66%) e verde é alto (67 a 100%). Manuais antigos trazem essa escala invertida.',
'Ciclo em 8 níveis: o nível 1 nebuliza 15 segundos a cada 2 minutos e o nível 8 nebuliza 1 minuto e 45 segundos a cada 2 minutos.',
'Sintomas: não aciona a nebulização, desconectar o Cooling Fan de 12V; se voltar a nebulizar, trocar o fan. Sem nebulização e com LEDs apagados, suspeitar de Atomizing Module defeituoso, reconectando um a um, ou da PCI principal. Sem névoa mesmo com o ciclo completo, verificar cerâmicas e mangueiras. Névoa saindo pela ventilação indica o Mist Blowing Fan de 12V. Vazamento pela ventilação indica boia ou sensor de nível. Enche mas não nebuliza indica a primeira boia travada. Não puxa água indica bomba, filtro ou solenoide. O DC Converter trabalha de 15 a 80V para 12V CC. Conector AKZ950.',
'Painel de Controle de Umidade, acessório opcional com conector de 6 vias: quando conectado assume o comando e os knobs e o controle remoto ficam inativos, o que é normal. Display mostrando "erro" e "sens" indica falha no sensor de umidade, caso em que o painel informa 100% e interrompe a nebulização. O ventilador em máximo nos 5 segundos iniciais de cada pausa é comportamento normal.',
'',
'## NB6C (conector de 16 vias)',
'Medições: L/N na chave gangorra 220V CA; fonte 24V CC na PCI via Mini Fit 2W; bateria acima de 3,0V; pinos 1/2 do nível com continuidade; pinos 3/4 das cerâmicas ±24V; pinos 5/6 da válvula de entrada 220V CA; pinos 7/8 da válvula de saída 220V CA; pinos 13/14 do microventilador 24V CC.',
'Sintomas: "ESPER" indica bateria de 3V ou horário. Não liga: verificar 220V, fonte 24V e PCI de Controle. Encoder não responde: PCI. Nebulização fraca: configuração, tanque sujo, cerâmicas ou placa (teste visual a 30%) e PCI. S.AGUA: fonte 12V da bomba, a própria bomba, pinos 5/6, pinos 1/2, cabo Mike e conector de 16 vias. Vazando: sensor nos pinos 1/2 ou válvula de saída nos pinos 7/8. Névoa voltando pelo ventilador: pinos 13/14.',
'Códigos de erro: bot.Er botão preso; L.In.Er timeout de enchimento; L.Ou.Er timeout de esvaziamento (registro aberto, válvula 7/8, sifão); Htr.Er timeout de aquecimento (resistência ou termostato); FAn.Er ventilador; nO.Er sem falhas; S.AgUA reservatório externo vazio, bastando encher e apertar MENU; ChEIO reservatório de saída cheio.',
'Menus: ErrOr, segurando MENU por 2 segundos, mostra os 25 últimos erros, sendo 01 o mais recente; t-rES mostra as horas do ressonador; rESEt zera os contadores, confirmando no botão Ventilador. A esterilização ocorre a 75 °C com troca de água (parâmetro EStEr).',
'',
'## NB100S (conector de 16 vias)',
'Medições: L/N no interruptor 220V CA; fonte 48V 350W em CN5; ressonador em CN6/CN7 com ±48V; bateria acima de 3,0V; nível nos pinos 9/10 ou 14/15 com continuidade; Valv IN nos pinos 12/13 com 220V CA; ventilador ±12V CC; bomba via CN8; aterramento com continuidade.',
'Sintomas: "STAND" indica bateria de 3V ou horário. Não liga: fonte 48V ou 220V. Nebulizando sem pausa indica bloco de cerâmicas em curto, com paliativo de reduzir para 70%. Névoa fraca: configuração com mínimo de 70%, mangueira reta, tanque, cerâmicas e tela do ventilador. S.AGUA: fonte 12V da bomba, a bomba, Valv IN, sensor de nível e cabo Mike. Pouco tempo de nebulização: ciclo em 80% ou PCI. Vazando: sensor ou solenoide. Névoa voltando: microventilador, indicado como "FAN".',
'',
'## Manutenção preventiva',
'Filtro plissado: lavar a cada 3 meses e trocar após 3 lavagens.',
'Carvão ativado: não lavar, trocar a cada 9 meses.',
'Tanque: esvaziar, lavar com sabão neutro, usar pincel macio nas cerâmicas e enxaguar muito bem, porque resíduo de sabão causa falha.',
'Ventilador: 4 parafusos, limpar e não montar invertido.',
'Registro de esvaziamento só deve ficar aberto durante a manutenção.',
'Não transportar o equipamento com o tanque cheio.',
'',
'## Quadro técnico (vazão a 100% de névoa, potência, torres máximas, tubulação máxima, tanque)',
'NB3i: 1,05 L/h, 60 W, 1 torre, 1,5 m, tanque de 1 L, operação manual.',
'NB6i: 2,1 L/h, 120 W, 2 torres, 3 m, tanque de 1 L.',
'NB10i: 5,0 L/h, 300 W, 3 torres, 4,5 m, tanque de 1 L.',
'NB100S: 2 L/h, 170 W, 3 torres, 3,5 m, tanque de 5 L, automático.',
'NB6C: 2,1 L/h, 115/400 W, 2 torres, 3 m, tanque de 0,7 L, automático e com esterilização.',
'NB400: 6 L/h, 300/1000 W, 4 torres, 4 m, tanque de 9,8 L.',
'NB800: 10 L/h, 600/1000 W, 6 torres, 6 m, tanque de 11 L.',
'ST2c e ST6c compõem a linha esterilizadora, com 0,7 e 2,1 L/h.',
'Todos os modelos são 220V com saída de 50 mm. Cada torre cobre um raio aproximado de 0,70 m.',
'',
'',
'## Catálogo de vídeos oficiais Nebulize',
'Indique pelo título e cole o link inteiro. Não existem outros vídeos além destes.',
'',
'Instalação e configuração:',
'- Instalação NB400/NB800: https://youtu.be/Xx3rM8o2I4Y',
'- Configuração NB400/NB800: https://youtu.be/dVPJP3PFBsM',
'- Limpeza manual NB400/NB800: https://youtube.com/shorts/FMw5xdfreho',
'- Configuração completa NB100S: https://youtube.com/shorts/68_PSaUgUEw',
'- NB6C, ajuste de configuração: https://youtu.be/rijYrkR3jrg',
'- NB6C, configuração avançada: https://youtu.be/2aat3ympUqs',
'- Montagem da bancada ED120: https://youtu.be/lX4uWgALndc',
'- Instalação NBi com 1 torre: https://youtu.be/yOmyHSWR2hk',
'- Instalação NBi com 2 torres: https://youtu.be/YMIuEsWSmbA',
'- Como limpar o filtro duplo, todos os modelos: https://youtu.be/w8ojg9ofr4M',
'',
'Diagnóstico de falhas:',
'- Máquina transbordando: https://youtu.be/XWbpZ8Y8vVs',
'- Erro sem água, parte 1: https://youtu.be/euXx-L0UtRs',
'- Erro sem água, parte 2: https://youtu.be/vMwotZG5x0Q',
'- Sem névoa com o painel marcando nebulizando: https://youtu.be/vV3_Ka-gxFk',
'- Névoa fraca, sem força na saída: https://youtu.be/8MikCPcNtNo',
'- Painel apagado, só o LED liga/standby: https://youtu.be/7KIvGFPsTXg',
'- Painel totalmente apagado: https://youtu.be/86msTth8ko0',
'- Placa apitando e botão apertando sozinho: https://youtu.be/EsX9Yxi42is',
'- Não está gravando a configuração: https://youtu.be/mb0nyO09Dzc',
'## Contatos da manutenção Nebulize',
'WhatsApp: (41) 9231-2056. Telefone: (41) 3016-1320.'
].join("\n");


Deno.serve(async (req) => {
  const origem = req.headers.get("origin");

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origem) });
  if (req.method !== "POST") return responder({ erro: "Método não permitido." }, 405, origem);

  try {
    // ── 1. Sessão do técnico ──
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return responder({ erro: "Sessão expirada. Entre novamente." }, 401, origem);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: sessao, error: erroSessao } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (erroSessao || !sessao?.user) {
      return responder({ erro: "Sessão expirada. Entre novamente." }, 401, origem);
    }
    const usuario = sessao.user;

    // ── 2. Aprovação ──
    const { data: tecnico } = await admin
      .from("tecnicos").select("status, nome").eq("id", usuario.id).single();

    if (!tecnico || tecnico.status !== "aprovado") {
      return responder({ erro: "Seu acesso ainda não foi aprovado." }, 403, origem);
    }

    // ── 3. Limite por hora ──
    const umaHoraAtras = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin
      .from("nebuleco_log").select("id", { count: "exact", head: true })
      .eq("tecnico", usuario.id).gte("criado_em", umaHoraAtras);

    if ((count ?? 0) >= LIMITE_HORA) {
      return responder({ erro: "Limite de perguntas por hora atingido. Tente mais tarde." }, 429, origem);
    }

    // ── 4. Pergunta ──
    const corpo = await req.json().catch(() => ({}));
    const pergunta = String(corpo?.pergunta ?? "").trim();
    const historico = Array.isArray(corpo?.historico) ? corpo.historico.slice(-6) : [];

    if (!pergunta) return responder({ erro: "Escreva sua dúvida." }, 400, origem);
    if (pergunta.length > 1200) return responder({ erro: "Pergunta muito longa." }, 400, origem);

    const chave = Deno.env.get("GEMINI_API_KEY");
    if (!chave) return responder({ erro: "O Nebuleco ainda não foi configurado." }, 500, origem);

    // ── 5. Gemini ──
    const contents = [
      ...historico.map((m: { autor: string; texto: string }) => ({
        role: m.autor === "nebuleco" ? "model" : "user",
        parts: [{ text: String(m.texto).slice(0, 2000) }],
      })),
      { role: "user", parts: [{ text: pergunta }] },
    ];

    const resposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${encodeURIComponent(chave)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: `${INSTRUCAO}\n\n${BASE}` }] },
          contents,
          generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
        }),
      },
    );

    if (!resposta.ok) {
      console.error("Gemini", resposta.status, await resposta.text());
      return responder(
        { erro: "O Nebuleco está indisponível agora. Chame a manutenção pelo WhatsApp." },
        502, origem,
      );
    }

    const json = await resposta.json();
    const texto = (json?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "").join("").trim();

    if (!texto) {
      return responder(
        { erro: "Não consegui responder agora. Reformule a pergunta ou chame a manutenção." },
        502, origem,
      );
    }

    // ── 6. Registro ──
    await admin.from("nebuleco_log").insert({
      tecnico: usuario.id,
      pergunta,
      resposta: texto.slice(0, 4000),
    });

    return responder({ resposta: texto }, 200, origem);
  } catch (e) {
    console.error(e);
    return responder({ erro: "Falha inesperada. Tente de novo em instantes." }, 500, origem);
  }
});