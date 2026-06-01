const path = require('path');
const PptxGenJS = require('pptxgenjs');

const pptx = new PptxGenJS();
pptx.author = 'Nosso Momento';
pptx.company = 'Nosso Momento';
pptx.subject = 'Versao 2 - seguranca e lancamento MVP';
pptx.title = 'Seguranca MVP - Nosso Momento v2';
pptx.layout = 'LAYOUT_WIDE';
pptx.lang = 'pt-BR';

const brandLogo = path.join(__dirname, '..', 'assets', 'icons', 'logo-black-txt-full.png');

const C = {
  ink: '111827',
  body: '1F2937',
  muted: '6B7280',
  bg: 'F9FAFB',
  panel: 'FFFFFF',
  line: 'D1D5DB',
  navy: '0B132B',
  cyan: '0EA5E9',
  mint: '10B981',
  amber: 'F59E0B',
  red: 'DC2626',
  blue: '2563EB',
  white: 'FFFFFF',
};

function shell(slide, title, subtitle) {
  slide.background = { color: C.bg };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.68,
    fill: { color: C.navy },
    line: { color: C.navy },
  });

  slide.addImage({
    path: brandLogo,
    x: 0.5,
    y: 0.08,
    w: 1.85,
    h: 0.48,
  });

  slide.addText('Security Release Deck | MVP 2026', {
    x: 10.15,
    y: 0.2,
    w: 2.7,
    h: 0.2,
    fontFace: 'Segoe UI',
    fontSize: 10,
    color: C.white,
    align: 'right',
  });

  slide.addText(title, {
    x: 0.62,
    y: 0.95,
    w: 12.0,
    h: 0.6,
    fontFace: 'Aptos Display',
    fontSize: 31,
    bold: true,
    color: C.ink,
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.62,
      y: 1.48,
      w: 12.0,
      h: 0.32,
      fontFace: 'Segoe UI',
      fontSize: 13,
      color: C.muted,
    });
  }

  slide.addShape(pptx.ShapeType.line, {
    x: 0.62,
    y: 1.9,
    w: 12.05,
    h: 0,
    line: { color: C.line, pt: 1 },
  });
}

function bullets(slide, items, x, y, w, size = 15, step = 0.42) {
  let yy = y;
  items.forEach((t) => {
    slide.addText(`• ${t}`, {
      x,
      y: yy,
      w,
      h: 0.33,
      fontFace: 'Segoe UI',
      fontSize: size,
      color: C.body,
    });
    yy += step;
  });
}

function card(slide, x, y, w, h, fill = 'FFFFFF', line = 'D1D5DB') {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: fill, transparency: 0 },
    line: { color: line, pt: 1 },
  });
}

function badge(slide, label, color, x, y) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w: 1.28,
    h: 0.34,
    rectRadius: 0.07,
    fill: { color },
    line: { color },
  });
  slide.addText(label, {
    x,
    y: y + 0.07,
    w: 1.28,
    h: 0.2,
    fontFace: 'Segoe UI',
    fontSize: 9,
    bold: true,
    color: C.white,
    align: 'center',
  });
}

// 1. Capa
{
  const s = pptx.addSlide();
  shell(s, 'Roadmap de Seguranca para Lancamento MVP (V2)', 'Next.js + Firebase + Cloud Functions | 28/05/2026');

  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.62,
    y: 2.25,
    w: 12.0,
    h: 3.95,
    rectRadius: 0.1,
    fill: { color: 'EAF5FF' },
    line: { color: 'BFDBFE' },
  });

  s.addText('Mensagem central', {
    x: 1.0,
    y: 2.55,
    w: 3.0,
    h: 0.3,
    fontFace: 'Segoe UI',
    fontSize: 15,
    bold: true,
    color: C.blue,
  });

  s.addText('Go-live recomendado com gate de seguranca e fechamento de P0.', {
    x: 1.0,
    y: 2.95,
    w: 8.7,
    h: 0.8,
    fontFace: 'Aptos Display',
    fontSize: 27,
    color: C.ink,
    bold: true,
  });

  bullets(s, [
    'Escopo: rules, functions, auth/session, headers, CSP e operacao',
    'Saida: plano de execucao em 3 fases + KPIs com nota maxima 100',
    'Objetivo: reduzir risco sem comprometer velocidade de entrega',
  ], 1.0, 4.25, 10.9, 14, 0.4);

  s.addImage({ path: brandLogo, x: 10.25, y: 2.6, w: 2.0, h: 2.0 });
}

// 2. Resumo executivo
{
  const s = pptx.addSlide();
  shell(s, 'Resumo Executivo', 'Prioridades para seguranca antes da escala');

  card(s, 0.7, 2.2, 12.0, 3.75, 'FFFFFF', 'E5E7EB');

  badge(s, 'CRITICO', C.red, 1.0, 2.5);
  s.addText('Leitura ampla de dados de usuarios autenticados.', {
    x: 2.45, y: 2.54, w: 9.8, h: 0.25, fontFace: 'Segoe UI', fontSize: 13.5, color: C.body,
  });

  badge(s, 'ALTO', C.amber, 1.0, 3.05);
  s.addText('Enumeracao de telefone e rate limit local por instancia.', {
    x: 2.45, y: 3.09, w: 9.8, h: 0.25, fontFace: 'Segoe UI', fontSize: 13.5, color: C.body,
  });

  badge(s, 'MEDIO', C.blue, 1.0, 3.6);
  s.addText('Sessao com cookie simples e CSP com excecoes amplas.', {
    x: 2.45, y: 3.64, w: 9.8, h: 0.25, fontFace: 'Segoe UI', fontSize: 13.5, color: C.body,
  });

  badge(s, 'BAIXO', C.mint, 1.0, 4.15);
  s.addText('App Check e governanca de CVE ainda incompletos.', {
    x: 2.45, y: 4.19, w: 9.8, h: 0.25, fontFace: 'Segoe UI', fontSize: 13.5, color: C.body,
  });

  card(s, 1.0, 4.85, 11.4, 0.82, 'FEF3C7', 'FCD34D');
  s.addText('Diretriz: liberar com GO condicional apos fechamento dos itens P0 da fase pre go-live.', {
    x: 1.3, y: 5.08, w: 10.8, h: 0.3, fontFace: 'Segoe UI', fontSize: 13, bold: true, color: '92400E',
  });
}

// 3. Plano de execucao por fases
{
  const s = pptx.addSlide();
  shell(s, 'Plano de Execucao em 3 Fases', 'Sequencia recomendada para o MVP');

  card(s, 0.7, 2.2, 3.85, 3.95, 'FEE2E2', 'FECACA');
  s.addText('FASE 1\nPre Go-Live\n(Obrigatoria)', {
    x: 0.95, y: 2.45, w: 3.35, h: 0.9, fontFace: 'Aptos Display', fontSize: 15, bold: true, color: '991B1B',
  });
  bullets(s, [
    'Regras de acesso a usuarios',
    'Resposta neutra no telefone',
    'Rate limit centralizado',
    'Sessao validada no servidor',
    'CSP enforce inicial',
  ], 0.95, 3.35, 3.3, 11.5, 0.35);

  card(s, 4.75, 2.2, 3.85, 3.95, 'FEF3C7', 'FDE68A');
  s.addText('FASE 2\nSemana 1\n(Estabilizacao)', {
    x: 5.0, y: 2.45, w: 3.35, h: 0.9, fontFace: 'Aptos Display', fontSize: 15, bold: true, color: '92400E',
  });
  bullets(s, [
    'App Check em rollout',
    'Alertas de seguranca',
    'Monitoramento de abuso',
    'Ajustes por telemetria',
  ], 5.0, 3.35, 3.3, 11.5, 0.35);

  card(s, 8.8, 2.2, 3.9, 3.95, 'DCFCE7', 'BBF7D0');
  s.addText('FASE 3\nMes 1\n(Consolidacao)', {
    x: 9.05, y: 2.45, w: 3.35, h: 0.9, fontFace: 'Aptos Display', fontSize: 15, bold: true, color: '166534',
  });
  bullets(s, [
    'Modelo publico vs privado',
    'Security tests no CI/CD',
    'Pentest de negocio',
    'Gestao continua de CVE',
  ], 9.05, 3.35, 3.35, 11.5, 0.35);
}

// 4. Gantt semanal
{
  const s = pptx.addSlide();
  shell(s, 'Cronograma de Execucao (Gantt)', 'Janela de 7 dias para release seguro');

  card(s, 0.7, 2.2, 12.0, 4.1, 'FFFFFF', 'E5E7EB');

  const leftX = 0.95;
  const topY = 2.6;
  const rowH = 0.52;
  const dayW = 1.23;
  const startX = 4.3;

  s.addText('Trilha', { x: leftX, y: topY - 0.28, w: 3.2, h: 0.2, fontFace: 'Segoe UI', fontSize: 10, bold: true, color: C.muted });
  ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'].forEach((d, i) => {
    s.addText(d, { x: startX + i * dayW, y: topY - 0.28, w: dayW, h: 0.2, align: 'center', fontFace: 'Segoe UI', fontSize: 10, bold: true, color: C.muted });
    s.addShape(pptx.ShapeType.line, {
      x: startX + i * dayW,
      y: topY - 0.04,
      w: 0,
      h: 3.45,
      line: { color: 'E5E7EB', pt: 1 },
    });
  });

  const tasks = [
    { name: 'P0 rules + telefone', color: C.red, start: 0, len: 2 },
    { name: 'Rate limit centralizado', color: C.amber, start: 1, len: 2 },
    { name: 'Sessao server + CSP', color: C.blue, start: 2, len: 2 },
    { name: 'Gate de seguranca', color: C.mint, start: 4, len: 1 },
    { name: 'Monitoramento e tuning', color: '0D9488', start: 5, len: 2 },
    { name: 'Atualizacao score KPI', color: '7C3AED', start: 6, len: 1 },
  ];

  tasks.forEach((t, idx) => {
    const y = topY + idx * rowH;
    s.addText(t.name, { x: leftX, y: y + 0.12, w: 3.1, h: 0.2, fontFace: 'Segoe UI', fontSize: 11.2, color: C.body });
    s.addShape(pptx.ShapeType.roundRect, {
      x: startX + t.start * dayW + 0.06,
      y: y + 0.07,
      w: t.len * dayW - 0.12,
      h: 0.32,
      rectRadius: 0.06,
      fill: { color: t.color },
      line: { color: t.color },
    });
  });

  s.addText('Marco de release: D5 com gate cumprido e sem P0 aberto.', {
    x: 0.95, y: 6.0, w: 11.4, h: 0.2, fontFace: 'Segoe UI', fontSize: 11.5, bold: true, color: '065F46',
  });
}

// 5. Backlog executavel
{
  const s = pptx.addSlide();
  shell(s, 'Plano de Execucao Detalhado', 'Owner, prazo e prioridade de cada entrega');

  const rows = [
    ['Item', 'Owner', 'Prazo', 'Prioridade', 'Status'],
    ['Restringir leitura de usuarios (rules)', 'Backend', 'D-7', 'P0', 'A fazer'],
    ['Resposta neutra em verificarTelefone', 'Backend', 'D-6', 'P0', 'A fazer'],
    ['Rate limit em armazenamento central', 'Backend/Infra', 'D-5', 'P0', 'A fazer'],
    ['Sessao validada no server', 'Frontend/Backend', 'D-4', 'P1', 'A fazer'],
    ['CSP enforce sem unsafe critico', 'Frontend/Infra', 'D-3', 'P1', 'A fazer'],
    ['App Check rollout gradual', 'Frontend/Backend', 'D+3', 'P2', 'A fazer'],
    ['Security checks no CI/CD', 'Infra', 'D+7', 'P2', 'A fazer'],
  ];

  s.addTable(rows, {
    x: 0.55,
    y: 2.2,
    w: 12.25,
    h: 4.1,
    border: { pt: 1, color: C.line },
    fontFace: 'Segoe UI',
    fontSize: 11,
    color: C.body,
    fill: C.panel,
    colW: [5.0, 2.0, 1.05, 1.1, 1.3],
  });
}

// 6. KPI por pontos
{
  const s = pptx.addSlide();
  shell(s, 'Tabela de KPIs de Seguranca', 'Classificacao por pontos com nota maxima');

  const rows = [
    ['KPI', 'Peso max (pts)', 'Atual', 'Nivel', 'Meta release'],
    ['Bloqueio de acesso indevido (rules)', '20', '8', 'Critico', '>= 16'],
    ['Protecao anti-enumeracao (telefone)', '10', '3', 'Alto', '>= 8'],
    ['Rate limit efetivo multi-instancia', '15', '5', 'Alto', '>= 12'],
    ['Sessao segura no app (server-validated)', '10', '4', 'Medio', '>= 8'],
    ['CSP enforce sem unsafe critico', '10', '4', 'Medio', '>= 8'],
    ['Hardening de upload de arquivos', '10', '6', 'Medio', '>= 8'],
    ['App Check e anti-bot', '10', '2', 'Baixo', '>= 7'],
    ['Monitoramento e alertas de seguranca', '10', '5', 'Medio', '>= 8'],
    ['Security tests no CI/CD', '5', '1', 'Baixo', '>= 4'],
    ['Gestao de vulnerabilidades (CVE)', '10', '4', 'Medio', '>= 8'],
    ['TOTAL', '100', '42', 'Risco elevado', '>= 79'],
  ];

  s.addTable(rows, {
    x: 0.5,
    y: 2.15,
    w: 12.35,
    h: 4.25,
    border: { pt: 1, color: C.line },
    fontFace: 'Segoe UI',
    fontSize: 10,
    color: C.body,
    fill: C.panel,
    colW: [5.1, 1.6, 1.5, 1.9, 2.25],
  });

  card(s, 0.8, 6.5, 11.8, 0.5, 'DBEAFE', '93C5FD');
  s.addText('Nota maxima: 100 | Faixas: <60 alto risco | 60-79 moderado | >=80 pronto para escalar.', {
    x: 1.05, y: 6.67, w: 11.3, h: 0.2, fontFace: 'Segoe UI', fontSize: 11.5, bold: true, color: '1E3A8A',
  });
}

// 7. Gate de release
{
  const s = pptx.addSlide();
  shell(s, 'Gate de Release de Seguranca', 'Checklist minimo para aprovar producao');

  card(s, 0.7, 2.2, 12.0, 3.9, 'FFFFFF', 'E5E7EB');

  bullets(s, [
    'Acesso cruzado entre usuarios deve falhar.',
    'Endpoint de telefone sem sinalizar existencia.',
    'Cookie forjado nao pode expor dados protegidos.',
    'Extrato isolado por beneficiario e paginacao valida.',
    'Rate limit bloqueando spam distribuido.',
    'CI reprovando CVE severa sem excecao aprovada.',
    'Alerta ativo para erro 5xx e 429 acima do baseline.',
  ], 1.0, 2.7, 10.8, 14, 0.45);

  card(s, 0.9, 6.3, 11.6, 0.65, 'ECFDF5', '6EE7B7');
  s.addText('Aprovacao sugerida: nenhum P0 aberto + score total KPI >= 79/100.', {
    x: 1.2, y: 6.53, w: 11.0, h: 0.25, fontFace: 'Segoe UI', fontSize: 13.5, bold: true, color: '065F46',
  });
}

// 8. Encerramento
{
  const s = pptx.addSlide();
  shell(s, 'Fechamento e Proximos 7 Dias', 'Plano de ataque final para release seguro');

  card(s, 0.72, 2.25, 12.0, 3.95, 'EAF5FF', 'BFDBFE');

  bullets(s, [
    'Dia 1-2: fechar P0 de rules, telefone e rate limit.',
    'Dia 3-4: hardening de sessao server-side e CSP.',
    'Dia 5: executar gate de seguranca completo.',
    'Dia 6-7: monitorar producao e recalcular KPIs.',
  ], 1.05, 2.75, 9.0, 16, 0.55);

  s.addImage({ path: brandLogo, x: 9.9, y: 3.15, w: 2.25, h: 2.25 });

  s.addText('Entrega final esperada: MVP com risco controlado e evolucao guiada por score.', {
    x: 1.05, y: 5.85, w: 10.9, h: 0.3, fontFace: 'Aptos Display', fontSize: 16, bold: true, color: C.ink,
  });
}

const out = path.join(__dirname, '..', 'docs', 'Apresentacao_Seguranca_MVP_Nosso_Momento_v2.pptx');
pptx.writeFile({ fileName: out })
  .then(() => {
    console.log(`PPTX V2 gerado com sucesso: ${out}`);
  })
  .catch((err) => {
    console.error('Erro ao gerar PPTX V2:', err);
    process.exitCode = 1;
  });
