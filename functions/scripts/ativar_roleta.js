/* eslint-disable no-console */
/**
 * Ativa o desafio da roleta para dois usuários pelo e-mail.
 * Usa a Firestore REST API com o token da sessão gcloud.
 * Usage: node functions/scripts/ativar_roleta.js
 */
const https = require('https');
const {execSync} = require('child_process');

const EMAIL_A = 't1@gmail.com';
const EMAIL_B = 'rg2@gmail.com';
const PROJECT = 'nosso-momento-app';
const CYCLE_MS = (3 * 24 + 23) * 60 * 60 * 1000; // ~95h

function getGcloudToken() {
  const raw = execSync('gcloud auth print-access-token 2>&1').toString();
  const token = raw.split('\n').map((l) => l.trim()).find((l) =>
    l.startsWith('ya29.') || l.startsWith('eyJ'),
  );
  if (!token) throw new Error('Token gcloud não encontrado. Execute: gcloud auth login');
  return token;
}

function request(method, hostname, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      method,
      hostname,
      path,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(data ? {'Content-Length': Buffer.byteLength(data)} : {}),
      },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        try {
          resolve({status: res.statusCode, body: JSON.parse(buf)});
        } catch {
          resolve({status: res.statusCode, body: buf});
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getUidByEmail(token, email) {
  // Busca na coleção `usuarios` via Firestore query REST API
  const body = {
    structuredQuery: {
      from: [{collectionId: 'usuarios'}],
      where: {
        fieldFilter: {
          field: {fieldPath: 'email'},
          op: 'EQUAL',
          value: {stringValue: email},
        },
      },
      limit: 1,
    },
  };
  const fsBase = `/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
  const res = await request('POST', 'firestore.googleapis.com', fsBase, token, body);
  if (!Array.isArray(res.body) || !res.body[0] || !res.body[0].document) {
    console.log(`  [lookup ${email}] resposta:`, JSON.stringify(res.body).slice(0, 300));
    throw new Error(`Usuário não encontrado no Firestore: ${email}`);
  }
  // O docId do documento em `usuarios` é o próprio UID
  const docName = res.body[0].document.name; // .../usuarios/{uid}
  return docName.split('/').pop();
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return {nullValue: null};
  if (typeof val === 'string') return {stringValue: val};
  if (typeof val === 'number') return {integerValue: String(Math.floor(val))};
  if (typeof val === 'boolean') return {booleanValue: val};
  if (val instanceof Date) return {timestampValue: val.toISOString()};
  if (Array.isArray(val)) {
    return {arrayValue: {values: val.map(toFirestoreValue)}};
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return {mapValue: {fields}};
  }
  return {stringValue: String(val)};
}

function buildDoc(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFirestoreValue(v);
  return {fields};
}

async function main() {
  const token = getGcloudToken();
  console.log('Token obtido. Buscando usuários...');

  const uidA = await getUidByEmail(token, EMAIL_A);
  console.log(`${EMAIL_A} → ${uidA}`);

  const uidB = await getUidByEmail(token, EMAIL_B);
  console.log(`${EMAIL_B} → ${uidB}`);

  const pairUids = [uidA, uidB].sort();
  const pairKey = pairUids.join('_');
  const docId = `roleta_${pairKey}`;
  console.log(`\nCriando: weeklyChallenges/${docId}`);

  const nowMs = Date.now();
  const doc = buildDoc({
    id: docId,
    challengeId: 'roleta',
    tipo: 'roleta',
    titulo: 'Roleta da Sorte 🎰',
    descricao: 'Cada um gira a roleta. A soma define os foguinhos do casal!',
    status: 'pendente',
    pairUids: pairUids,
    respostas: {},
    respondeuEm: {},
    startedAtMs: nowMs,
    expiresAtMs: nowMs + CYCLE_MS,
  });

  const fsPath = `/v1/projects/${PROJECT}/databases/(default)/documents/` +
    `weeklyChallenges/${docId}`;
  const res = await request('PATCH', 'firestore.googleapis.com', fsPath, token, doc);

  if (res.status !== 200) {
    console.error('Erro ao criar documento:', JSON.stringify(res.body, null, 2));
    process.exit(1);
  }

  console.log('✅ Desafio da roleta criado com sucesso!');
  console.log('   Expira em:', new Date(nowMs + CYCLE_MS).toLocaleString('pt-BR'));
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro:', err.message || err);
  process.exit(1);
});
