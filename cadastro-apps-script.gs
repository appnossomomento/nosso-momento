/**
 * Nosso Momento — Backend do formulário de cadastro (Google Apps Script)
 * -----------------------------------------------------------------------
 * Anti-spam: token secreto + honeypot + tempo mínimo de preenchimento.
 * Rejeições retornam ok:true (sem gravar) para não dar pista a bots.
 *
 * Leitura admin: GET ?action=leads&token=LEADS_READ_TOKEN
 *
 * IMPORTANTE:
 * - FORM_TOKEN deve ser igual ao de cadastrovip.html
 * - LEADS_READ_TOKEN deve ser igual a LP_LEADS_TOKEN no .env / Vercel
 * Após alterar: Implantar > Gerenciar implantações > Nova versão.
 */

var SHEET_NAME = 'Cadastros';
var META_VAGAS = 50;
var FORM_TOKEN = 'nm-fundadores-7kQ2mXp9';
var LEADS_READ_TOKEN = 'nm-leads-read-9pL4wKx2';
var MIN_SUBMIT_MS = 3000;

var HEADERS = [
  'Data',
  'Nome',
  'WhatsApp',
  'Email',
  'Nome do Parceiro',
  'Cidade/Estado',
  'Origem',
  'Consentimento',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
  'landing_url',
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (isSpam_(data)) {
      return json_({ ok: true, count: contarCadastros_(), meta: META_VAGAS });
    }
    var sheet = getSheet_();
    appendCadastro_(sheet, data);
    return json_({ ok: true, count: contarCadastros_(), meta: META_VAGAS });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  var token = e && e.parameter && e.parameter.token;

  if (action === 'leads') {
    if (token !== LEADS_READ_TOKEN) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    try {
      return json_({
        ok: true,
        generatedAt: new Date().toISOString(),
        count: contarCadastros_(),
        meta: META_VAGAS,
        leads: listLeads_(),
      });
    } catch (err) {
      return json_({ ok: false, error: String(err) });
    }
  }

  var payload = { count: contarCadastros_(), meta: META_VAGAS };
  var callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(payload);
}

function isSpam_(data) {
  if (!data || data.token !== FORM_TOKEN) return true;
  if (data.website) return true;
  var loaded = Number(data._formLoaded);
  if (loaded && (Date.now() - loaded) < MIN_SUBMIT_MS) return true;
  return false;
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    return;
  }
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) {
    return String(v || '');
  });
  for (var i = 0; i < HEADERS.length; i++) {
    if (existing.indexOf(HEADERS[i]) === -1) {
      sheet.getRange(1, existing.length + 1).setValue(HEADERS[i]);
      existing.push(HEADERS[i]);
    }
  }
}

function headerIndexMap_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[String(headers[i] || '')] = i;
  }
  return { headers: headers, map: map, lastCol: lastCol };
}

function appendCadastro_(sheet, data) {
  ensureHeaders_(sheet);
  var info = headerIndexMap_(sheet);
  var row = [];
  for (var i = 0; i < info.lastCol; i++) row.push('');

  function set(h, v) {
    if (info.map[h] === undefined) return;
    row[info.map[h]] = v;
  }

  set('Data', new Date());
  set('Nome', data.nome || '');
  set('WhatsApp', data.whatsapp || '');
  set('Email', data.email || '');
  set('Nome do Parceiro', data.parceiro_nome || '');
  set('Cidade/Estado', data.cidade_estado || '');
  set('Origem', data.origem || '');
  set('Consentimento', data.consent ? 'Sim' : '');
  set('utm_source', data.utm_source || '');
  set('utm_medium', data.utm_medium || '');
  set('utm_campaign', data.utm_campaign || '');
  set('utm_content', data.utm_content || '');
  set('utm_term', data.utm_term || '');
  set('gclid', data.gclid || '');
  set('fbclid', data.fbclid || '');
  set('landing_url', data.landing_url || '');

  sheet.appendRow(row);
}

function listLeads_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var info = headerIndexMap_(sheet);
  var values = sheet.getRange(2, 1, lastRow, info.lastCol).getValues();
  var leads = [];

  function cell(row, h) {
    var idx = info.map[h];
    if (idx === undefined) return '';
    var v = row[idx];
    if (v instanceof Date) return v.toISOString();
    return v == null ? '' : String(v);
  }

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var nome = cell(row, 'Nome');
    var email = cell(row, 'Email');
    if (!nome && !email) continue;
    leads.push({
      data: cell(row, 'Data'),
      nome: nome,
      whatsapp: cell(row, 'WhatsApp'),
      email: email,
      parceiroNome: cell(row, 'Nome do Parceiro'),
      cidadeEstado: cell(row, 'Cidade/Estado'),
      origem: cell(row, 'Origem'),
      consentimento: cell(row, 'Consentimento'),
      utmSource: cell(row, 'utm_source'),
      utmMedium: cell(row, 'utm_medium'),
      utmCampaign: cell(row, 'utm_campaign'),
      utmContent: cell(row, 'utm_content'),
      utmTerm: cell(row, 'utm_term'),
      gclid: cell(row, 'gclid'),
      fbclid: cell(row, 'fbclid'),
      landingUrl: cell(row, 'landing_url'),
    });
  }

  // Mais recentes primeiro
  leads.reverse();
  return leads;
}

function contarCadastros_() {
  var sheet = getSheet_();
  return Math.max(0, sheet.getLastRow() - 1);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
