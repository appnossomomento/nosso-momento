const path = require('path');
const PptxGenJS = require('pptxgenjs');

const pptx = new PptxGenJS();
pptx.author = 'Nosso Momento';
pptx.company = 'Nosso Momento';
pptx.subject = 'Varredura de seguranca e roadmap MVP';
pptx.title = 'Seguranca MVP - Nosso Momento';
pptx.layout = 'LAYOUT_WIDE';
pptx.lang = 'pt-BR';

const COLORS = {
  bg: 'F7F8FA',
  title: '0F172A',
  body: '1E293B',
  muted: '475569',
  accent: '0EA5E9',
  red: 'DC2626',
  amber: 'D97706',
  green: '059669',
  white: 'FFFFFF',
  line: 'CBD5E1',
};

function addHeader(slide, title, subtitle) {
  slide.background = { color: COLORS.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.55,
    fill: { color: COLORS.title },
    line: { color: COLORS.title },
  });

  slide.addText('NOSSO MOMENTO | SEGURANCA MVP', {
    x: 0.5,
    y: 0.13,
    w: 6.5,
    h: 0.25,
    fontSize: 10,
    bold: true,
    color: COLORS.white,
    fontFace: 'Calibri',
  });

  slide.addText(title, {
    x: 0.6,
    y: 0.8,
    w: 12,
    h: 0.5,
    fontSize: 30,
    bold: true,
    color: COLORS.title,
    fontFace: 'Calibri',
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6,
      y: 1.35,
      w: 12,
      h: 0.35,
      fontSize: 14,
      color: COLORS.muted,
      fontFace: 'Calibri',
    });
  }
}

function addBullets(slide, items, startY = 2.0) {
  let y = startY;
  items.forEach((item) => {
    slide.addText(`• ${item}`, {
      x: 0.85,
      y,
      w: 11.9,
      h: 0.38,
      fontSize: 17,
      color: COLORS.body,
      fontFace: 'Calibri',
    });
    y += 0.47;
  });
}

function addSeverityBadge(slide, text, color, x, y) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w: 1.35,
    h: 0.36,
    rectRadius: 0.08,
    fill: { color },
    line: { color },
  });
  slide.addText(text, {
    x,
    y: y + 0.06,
    w: 1.35,
    h: 0.22,
    align: 'center',
    fontSize: 10,
    bold: true,
    color: COLORS.white,
    fontFace: 'Calibri',
  });
}

// Slide 1 - Capa
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Roadmap de Seguranca para Lancamento MVP', 'Next.js + Firebase + Cloud Functions | Data: 28/05/2026');
  slide.addText('Objetivo: reduzir riscos criticos sem travar o go-live.', {
    x: 0.85,
    y: 2.35,
    w: 11.8,
    h: 0.55,
    fontSize: 22,
    bold: false,
    color: COLORS.body,
    fontFace: 'Calibri',
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.85,
    y: 3.2,
    w: 11.4,
    h: 2.2,
    rectRadius: 0.05,
    fill: { color: 'E2E8F0' },
    line: { color: '94A3B8' },
  });

  slide.addText('Escopo da varredura', {
    x: 1.1,
    y: 3.45,
    w: 3.5,
    h: 0.3,
    fontSize: 15,
    bold: true,
    color: COLORS.title,
    fontFace: 'Calibri',
  });

  addBullets(slide, [
    'Regras Firestore e Storage',
    'Endpoints HTTP das Functions',
    'Middleware/proxy e sessao no Next.js',
    'Headers de seguranca e CSP',
  ], 3.82);
}

// Slide 2 - Resumo executivo
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Resumo Executivo', 'Achados principais e impacto de negocio');

  addSeverityBadge(slide, 'CRITICO', COLORS.red, 0.85, 2.0);
  slide.addText('Leitura ampla de dados de usuarios autenticados (risco de exposicao de PII).', {
    x: 2.35,
    y: 2.02,
    w: 9.9,
    h: 0.34,
    fontSize: 14,
    color: COLORS.body,
    fontFace: 'Calibri',
  });

  addSeverityBadge(slide, 'ALTO', COLORS.amber, 0.85, 2.55);
  slide.addText('Enumeracao de telefone e rate limit em memoria por instancia.', {
    x: 2.35,
    y: 2.57,
    w: 9.9,
    h: 0.34,
    fontSize: 14,
    color: COLORS.body,
    fontFace: 'Calibri',
  });

  addSeverityBadge(slide, 'MEDIO', '2563EB', 0.85, 3.1);
  slide.addText('Gate de rota por cookie simples e CSP permissiva/Report-Only.', {
    x: 2.35,
    y: 3.12,
    w: 9.9,
    h: 0.34,
    fontSize: 14,
    color: COLORS.body,
    fontFace: 'Calibri',
  });

  addSeverityBadge(slide, 'BAIXO', COLORS.green, 0.85, 3.65);
  slide.addText('App Check ausente e auditoria de CVEs pendente no CI.', {
    x: 2.35,
    y: 3.67,
    w: 9.9,
    h: 0.34,
    fontSize: 14,
    color: COLORS.body,
    fontFace: 'Calibri',
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.85,
    y: 4.55,
    w: 11.6,
    h: 1.2,
    fill: { color: 'FEF3C7' },
    line: { color: 'F59E0B' },
  });
  slide.addText('Recomendacao de release: GO condicional, apos fechamento dos itens obrigatorios da Fase 1.', {
    x: 1.1,
    y: 4.95,
    w: 11.1,
    h: 0.42,
    fontSize: 14,
    bold: true,
    color: '92400E',
    fontFace: 'Calibri',
  });
}

// Slide 3 - Riscos por severidade
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Matriz de Risco', 'Severidade x Impacto x Esforco');

  const rows = [
    ['Risco', 'Severidade', 'Impacto', 'Esforco'],
    ['Leitura ampla de usuarios autenticados', 'Critico', 'LGPD/PII', 'Medio'],
    ['Enumeracao de telefone', 'Alto', 'Abuso e scraping', 'Baixo-Medio'],
    ['Rate limit em memoria', 'Alto', 'Bypass anti-spam', 'Medio'],
    ['Cookie simples no gate do app', 'Medio', 'Bypass de UX protegida', 'Medio'],
    ['CSP permissiva', 'Medio', 'Maior risco XSS', 'Medio-Alto'],
    ['Sem App Check', 'Baixo', 'Abuso automatizado', 'Medio'],
  ];

  slide.addTable(rows, {
    x: 0.75,
    y: 1.95,
    w: 11.9,
    h: 3.8,
    border: { pt: 1, color: COLORS.line },
    fontFace: 'Calibri',
    fontSize: 12,
    color: COLORS.body,
    fill: 'FFFFFF',
    valign: 'middle',
    colW: [5.4, 1.9, 2.4, 2.2],
    rowH: [0.43, 0.43, 0.43, 0.43, 0.43, 0.43, 0.43],
  });
}

// Slide 4 - Plano de execucao (fases)
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Plano de Execucao', 'Roadmap de hardening para lancamento MVP');

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.75,
    y: 1.95,
    w: 3.9,
    h: 3.55,
    fill: { color: 'FEE2E2' },
    line: { color: 'FCA5A5' },
  });
  slide.addText('FASE 1\nAntes do Go-Live\n(Obrigatorio)', {
    x: 0.95,
    y: 2.1,
    w: 3.5,
    h: 0.9,
    fontSize: 14,
    bold: true,
    color: '991B1B',
    fontFace: 'Calibri',
  });
  addBullets(slide, [
    'Fechar leitura ampla de usuarios',
    'Neutralizar enumeracao de telefone',
    'Rate limit centralizado',
    'Sessao server-validated',
    'CSP enforced inicial',
  ], 3.0);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 4.95,
    y: 1.95,
    w: 3.9,
    h: 3.55,
    fill: { color: 'FEF3C7' },
    line: { color: 'FCD34D' },
  });
  slide.addText('FASE 2\nSemana 1\n(Estabilizacao)', {
    x: 5.15,
    y: 2.1,
    w: 3.5,
    h: 0.9,
    fontSize: 14,
    bold: true,
    color: '92400E',
    fontFace: 'Calibri',
  });
  addBullets(slide, [
    'App Check em monitoramento',
    'Alertas 401/403/429/500 por rota',
    'Observabilidade de abuso',
    'Ajustes rapidos orientados por log',
  ], 3.0);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 9.15,
    y: 1.95,
    w: 3.4,
    h: 3.55,
    fill: { color: 'DCFCE7' },
    line: { color: '86EFAC' },
  });
  slide.addText('FASE 3\nMes 1\n(Consolidacao)', {
    x: 9.35,
    y: 2.1,
    w: 3.0,
    h: 0.9,
    fontSize: 14,
    bold: true,
    color: '14532D',
    fontFace: 'Calibri',
  });
  addBullets(slide, [
    'Perfil publico x privado',
    'Security tests no CI/CD',
    'Pentest de abuso de negocio',
    'Gestao continua de CVEs',
  ], 3.0);
}

// Slide 5 - Plano detalhado de execucao
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Plano Detalhado de Execucao', 'Backlog executavel com owner e prioridade');

  const rows = [
    ['Item', 'Owner', 'Prazo', 'Prioridade', 'Status inicial'],
    ['Restringir leitura de usuarios (Firestore rules)', 'Backend', 'D-7', 'P0', 'A fazer'],
    ['Ajustar verificarTelefone para resposta neutra', 'Backend', 'D-6', 'P0', 'A fazer'],
    ['Rate limit em storage centralizado', 'Backend/Infra', 'D-5', 'P0', 'A fazer'],
    ['Trocar auth-session por sessao validada no server', 'Frontend/Backend', 'D-4', 'P1', 'A fazer'],
    ['Enforce CSP e remover unsafe quando possivel', 'Frontend/Infra', 'D-3', 'P1', 'A fazer'],
    ['Habilitar App Check + rollout gradual', 'Frontend/Backend', 'D+3', 'P2', 'A fazer'],
    ['Pipeline de security checks no CI', 'Infra', 'D+7', 'P2', 'A fazer'],
  ];

  slide.addTable(rows, {
    x: 0.55,
    y: 1.95,
    w: 12.25,
    h: 3.95,
    border: { pt: 1, color: COLORS.line },
    fontFace: 'Calibri',
    fontSize: 11,
    color: COLORS.body,
    fill: 'FFFFFF',
    valign: 'middle',
    colW: [4.65, 2.0, 1.05, 1.1, 1.6],
    rowH: [0.38, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45],
  });
}

// Slide 6 - KPIs de seguranca com pontos e nota maxima
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Tabela de KPIs de Seguranca', 'Classificacao por pontos e nota maxima');

  const rows = [
    ['KPI', 'Peso max (pts)', 'Pontuacao atual', 'Nivel atual', 'Meta de release'],
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

  slide.addTable(rows, {
    x: 0.45,
    y: 1.9,
    w: 12.45,
    h: 4.3,
    border: { pt: 1, color: COLORS.line },
    fontFace: 'Calibri',
    fontSize: 10,
    color: COLORS.body,
    fill: 'FFFFFF',
    valign: 'middle',
    colW: [5.0, 1.6, 1.7, 1.9, 2.25],
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6,
    y: 6.35,
    w: 12.1,
    h: 0.62,
    fill: { color: 'DBEAFE' },
    line: { color: '93C5FD' },
  });
  slide.addText('Nota maxima: 100 pontos | Faixas sugeridas: <60 Alto risco, 60-79 Moderado, >=80 Pronto para escala.', {
    x: 0.9,
    y: 6.53,
    w: 11.6,
    h: 0.25,
    fontSize: 12,
    bold: true,
    color: '1E3A8A',
    fontFace: 'Calibri',
  });
}

// Slide 7 - Gate de release
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Gate de Release de Seguranca', 'Checklist minimo para aprovar o MVP');
  addBullets(slide, [
    'Teste de acesso cruzado entre usuarios deve falhar.',
    'Endpoint de telefone deve responder sem sinalizar existencia.',
    'Tentativa de forjar cookie nao pode vazar dados protegidos.',
    'Exibicao do extrato deve ser isolada por beneficiario.',
    'Rate limit deve bloquear spam distribuido.',
    'Pipeline CI deve reprovar em CVE severa sem excecao aprovada.',
    'Alertas de seguranca devem disparar em erro 5xx/429 acima do baseline.',
  ], 2.0);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.85,
    y: 5.55,
    w: 11.6,
    h: 0.9,
    fill: { color: 'ECFDF5' },
    line: { color: '6EE7B7' },
  });
  slide.addText('Criterio de aprovacao sugerido: nenhum item P0 aberto + KPI total >= 79/100.', {
    x: 1.15,
    y: 5.85,
    w: 11,
    h: 0.3,
    fontSize: 14,
    bold: true,
    color: '065F46',
    fontFace: 'Calibri',
  });
}

// Slide 8 - Proximos passos
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Proximos Passos Imediatos', 'Execucao recomendada para os proximos 7 dias');
  addBullets(slide, [
    'Dia 1-2: aplicar fixes P0 de regras, telefone e rate limit.',
    'Dia 3-4: ajustar sessao server-side e endurecer CSP.',
    'Dia 5: validar gate de release com testes manuais e automatizados.',
    'Dia 6-7: monitorar producao, corrigir regressao e atualizar score KPI.',
  ], 2.1);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.85,
    y: 4.6,
    w: 11.6,
    h: 1.7,
    fill: { color: 'F8FAFC' },
    line: { color: 'CBD5E1' },
  });
  slide.addText('Saida esperada: MVP com risco controlado, plano de melhoria continua e seguranca mensuravel por pontuacao.', {
    x: 1.1,
    y: 5.1,
    w: 11.1,
    h: 0.6,
    fontSize: 16,
    color: COLORS.title,
    bold: true,
    fontFace: 'Calibri',
  });
}

const output = path.join(__dirname, '..', 'docs', 'Apresentacao_Seguranca_MVP_Nosso_Momento.pptx');
pptx.writeFile({ fileName: output })
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`PPTX gerado com sucesso: ${output}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Erro ao gerar PPTX:', err);
    process.exitCode = 1;
  });
