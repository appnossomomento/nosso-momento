/* eslint-disable no-console */
/**
 * Script de teste: ativa desafio da Roleta para t1@gmail.com / rg2@gmail.com.
 * Expira os outros desafios ativos (alma_gemea, preferencias) do par.
 * Usage: node functions/scripts/testar_roleta.js
 */
const https = require('https');
const {execSync} = require('child_process');

const UID_T1 = 'GfEycuLa5NTzswftqVIcHYIGMS32';
const UID_RG2 = 'hX3TWvGQjXPyxph28Ss424QwgQ33';
const PROJECT = 'nosso-momento-app';

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
      method, hostname, path,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(data ? {'Content-Length': Buffer.byteLength(data)} : {}),
      },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        try { resolve({status: res.statusCode, body: JSON.parse(buf)}); } catch {
          resolve({status: res.statusCode, body: buf});
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const FS_BASE = `/v1/projects/${PROJECT}/databases/(default)/documents`;

async function getDoc(token, docId) {
  const res = await request('GET', 'firestore.googleapis.com',
      `${FS_BASE}/weeklyChallenges/${docId}`, token, null);
  return res.status === 200 ? res.body : null;
}

async function patchDoc(token, docId, fields, updateMask) {
  const maskParam = updateMask.map((f) => `updateMask.fieldPaths=${f}`).join('&');
  const path = `${FS_BASE}/weeklyChallenges/${docId}?${maskParam}`;
  return request('PATCH', 'firestore.googleapis.com', path, token, {fields});
}

async function expireDoc(token, docId) {
  const doc = await getDoc(token, docId);
  if (!doc || !doc.fields) { console.log(`  ${docId}: não existe, pulando.`); return; }
  const status = doc.fields.status && doc.fields.status.stringValue;
  const concluido = doc.fields.concluido && doc.fields.concluido.booleanValue;
  if (status !== 'pendente' || concluido) {
    console.log(`  ${docId}: status=${status}, concluido=${concluido} — nada a expirar.`);
    return;
  }
  const res = await patchDoc(token, docId, {
    status: {stringValue: 'expirado'},
  }, ['status']);
  console.log(`  ${docId}: ${res.status === 200 ? '✅ expirado' : '❌ erro ' + res.status}`);
}

async function main() {
  const token = getGcloudToken();
  const pairUids = [UID_T1, UID_RG2].sort();
  const pairKey = pairUids.join('_');
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  console.log(`\nPar: ${pairKey}`);

  console.log('\nExpirando outros desafios...');
  await expireDoc(token, `alma_gemea_${pairKey}`);
  await expireDoc(token, `preferencias_${pairKey}`);

  console.log('\nCriando desafio da Roleta...');
  const docId = `roleta_${pairKey}`;
  const doc = {
    fields: {
      id: {stringValue: docId},
      challengeId: {stringValue: 'roleta'},
      tipo: {stringValue: 'roleta'},
      titulo: {stringValue: 'Roleta dos Foguinhos'},
      descricao: {stringValue: 'Cada um gira a roleta. A soma dos resultados é o bônus!'},
      status: {stringValue: 'pendente'},
      pairUids: {arrayValue: {values: pairUids.map((u) => ({stringValue: u}))}},
      respostas: {mapValue: {fields: {}}},
      respondeuEm: {mapValue: {fields: {}}},
      concluido: {booleanValue: false},
      rewarded: {booleanValue: false},
      completedAt: {nullValue: null},
      completedAtMs: {nullValue: null},
      startedAtMs: {integerValue: String(nowMs)},
      startedAt: {timestampValue: new Date(nowMs).toISOString()},
      createdAtMs: {integerValue: String(nowMs)},
      criadoEm: {timestampValue: new Date(nowMs).toISOString()},
      updatedAt: {timestampValue: new Date(nowMs).toISOString()},
      cycleIndex: {integerValue: String(nowSec)},
    },
  };

  const fsPath = `${FS_BASE}/weeklyChallenges/${docId}`;
  const res = await request('PATCH', 'firestore.googleapis.com', fsPath, token, doc);
  if (res.status === 200) {
    console.log(`  ✅ ${docId} criado/atualizado`);
    console.log('\nPronto! Abra o app com t1@gmail.com para ver a roleta.');
  } else {
    console.error(`  ❌ Erro ${res.status}:`, JSON.stringify(res.body, null, 2));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro:', err.message || err);
  process.exit(1);
});

