/**
 * Nosso Momento — Backend do formulário de cadastro (Google Apps Script)
 * -----------------------------------------------------------------------
 * Anti-spam: token secreto + honeypot + tempo mínimo de preenchimento.
 * Rejeições retornam ok:true (sem gravar) para não dar pista a bots.
 *
 * IMPORTANTE: FORM_TOKEN deve ser igual ao de cadastrovip.html.
 * Após alterar este arquivo: Implantar > Gerenciar implantações > Nova versão.
 */

var SHEET_NAME = 'Cadastros';
var META_VAGAS = 50;
var FORM_TOKEN = 'nm-fundadores-7kQ2mXp9';
var MIN_SUBMIT_MS = 3000;

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (isSpam_(data)) {
      return json_({ ok: true, count: contarCadastros_(), meta: META_VAGAS });
    }
    var sheet = getSheet_();
    sheet.appendRow([
      new Date(),
      data.nome || '',
      data.whatsapp || '',
      data.email || '',
      data.parceiro_nome || '',
      data.cidade_estado || '',
      data.origem || '',
      data.consent ? 'Sim' : ''
    ]);
    return json_({ ok: true, count: contarCadastros_(), meta: META_VAGAS });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
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
    sheet.appendRow(['Data', 'Nome', 'WhatsApp', 'Email', 'Nome do Parceiro', 'Cidade/Estado', 'Origem', 'Consentimento']);
  }
  return sheet;
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
