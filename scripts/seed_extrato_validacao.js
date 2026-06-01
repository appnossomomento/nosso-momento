const https = require('https');
const { execSync } = require('child_process');

const PROJECT = 'nosso-momento-app';
const PAREAMENTO_ID = '21232323232_21977776666';
const UID_LOGADA = 'gWblxQ28Z2cobZU7TJgtRZplXn63';
const UID_PARCEIRO = 'vj8AhmOTpSaycndKsnBi4f7y90s1';

function token() {
  return execSync('gcloud auth print-access-token').toString().trim();
}

function docBody({ descricao, beneficiarioUid, autorUid, autorNome, valor }) {
  return {
    fields: {
      tipo: { stringValue: 'bonus' },
      descricao: { stringValue: descricao },
      valor: { integerValue: String(valor) },
      beneficiarioUid: { stringValue: beneficiarioUid },
      autorUid: { stringValue: autorUid },
      autorNome: { stringValue: autorNome },
      createdAtMs: { integerValue: String(Date.now()) },
      pareamentoId: { stringValue: PAREAMENTO_ID },
    },
  };
}

function post(path, body, bearer) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        method: 'POST',
        hostname: 'firestore.googleapis.com',
        path,
        headers: {
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let out = '';
        res.on('data', (c) => {
          out += c;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, body: out });
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const bearer = token();
  const basePath = `/v1/projects/${PROJECT}/databases/(default)/documents/pareamentos/${PAREAMENTO_ID}/extrato`;

  const a = await post(
    basePath,
    docBody({
      descricao: 'VALIDACAO_LOGADA',
      beneficiarioUid: UID_LOGADA,
      autorUid: UID_PARCEIRO,
      autorNome: 'Teste',
      valor: 1,
    }),
    bearer,
  );

  const b = await post(
    basePath,
    docBody({
      descricao: 'VALIDACAO_PARCEIRO',
      beneficiarioUid: UID_PARCEIRO,
      autorUid: UID_LOGADA,
      autorNome: 'Teste',
      valor: 1,
    }),
    bearer,
  );

  console.log('seed_status', a.status, b.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
