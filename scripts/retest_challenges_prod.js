/* eslint-disable no-console */
const https = require('https');
const { execSync } = require('child_process');

const PROJECT = 'nosso-momento-app';
const EMAIL_A = 'h@gmail.com';
const EMAIL_B = 'conviteh28052026@gmail.com';
const CYCLE_MS = (3 * 24 + 23) * 60 * 60 * 1000;

function token() {
  return execSync('gcloud auth print-access-token').toString().trim();
}

function req(method, path, bearer, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { Authorization: `Bearer ${bearer}` };
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const r = https.request({ method, hostname: 'firestore.googleapis.com', path, headers }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        let parsed = buf;
        try { parsed = JSON.parse(buf); } catch (_) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function fsVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return { integerValue: String(Math.trunc(v)) };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsVal) } };
  const fields = {};
  Object.keys(v).forEach((k) => { fields[k] = fsVal(v[k]); });
  return { mapValue: { fields } };
}

function fsDoc(obj) {
  const fields = {};
  Object.keys(obj).forEach((k) => { fields[k] = fsVal(obj[k]); });
  return { fields };
}

function intField(fields, key) {
  return Number((fields[key] || {}).integerValue || 0);
}

function strField(fields, key) {
  return (fields[key] || {}).stringValue || '';
}

function boolField(fields, key) {
  return !!(fields[key] || {}).booleanValue;
}

async function runQuery(bearer, structuredQuery) {
  const path = `/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
  return req('POST', path, bearer, { structuredQuery });
}

async function getUserByEmail(bearer, email) {
  const q = {
    from: [{ collectionId: 'usuarios' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'email' },
        op: 'EQUAL',
        value: { stringValue: email },
      },
    },
    limit: 1,
  };
  const res = await runQuery(bearer, q);
  const doc = Array.isArray(res.body) && res.body[0] && res.body[0].document;
  if (!doc) throw new Error(`Usuario nao encontrado: ${email}`);
  const uid = doc.name.split('/').pop();
  const fields = doc.fields || {};
  const ativos = (((fields.pareamentosAtivos || {}).arrayValue || {}).values) || [];
  let pareamentoId = '';
  if (ativos.length) {
    const f = (((ativos[0] || {}).mapValue || {}).fields) || {};
    pareamentoId = strField(f, 'pareamentoId');
  }
  return { uid, pareamentoId };
}

async function getPairDoc(bearer, pareamentoId) {
  const path = `/v1/projects/${PROJECT}/databases/(default)/documents/pareamentos/${pareamentoId}`;
  const res = await req('GET', path, bearer);
  if (res.status !== 200) throw new Error(`Pareamento nao encontrado: ${pareamentoId}`);
  return res.body.fields || {};
}

async function getChallengeDoc(bearer, docId) {
  const path = `/v1/projects/${PROJECT}/databases/(default)/documents/weeklyChallenges/${docId}`;
  const res = await req('GET', path, bearer);
  if (res.status !== 200) return null;
  return res.body.fields || {};
}

async function setChallengeDoc(bearer, docId, payload) {
  const path = `/v1/projects/${PROJECT}/databases/(default)/documents/weeklyChallenges/${docId}`;
  return req('PATCH', path, bearer, fsDoc(payload));
}

async function expireChallenge(bearer, docId) {
  const path = `/v1/projects/${PROJECT}/databases/(default)/documents/weeklyChallenges/${docId}?updateMask.fieldPaths=status`;
  return req('PATCH', path, bearer, fsDoc({ status: 'expirado' }));
}

async function createInput(bearer, payload) {
  const path = `/v1/projects/${PROJECT}/databases/(default)/documents/inputs`;
  const res = await req('POST', path, bearer, fsDoc(payload));
  if (res.status !== 200) {
    throw new Error(`Falha ao criar input: ${JSON.stringify(res.body)}`);
  }
  return res.body.name.split('/').pop();
}

async function getInput(bearer, id) {
  const path = `/v1/projects/${PROJECT}/databases/(default)/documents/inputs/${id}`;
  const res = await req('GET', path, bearer);
  if (res.status !== 200) return null;
  return res.body.fields || {};
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitInputs(bearer, ids, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const snaps = [];
    for (const id of ids) {
      snaps.push(await getInput(bearer, id));
    }
    const allDone = snaps.every((f) => boolField(f, 'processed') || strField(f, 'error'));
    if (allDone) return snaps;
    await sleep(1500);
  }
  throw new Error(`Timeout aguardando inputs: ${ids.join(',')}`);
}

async function getPairExtratoSince(bearer, pareamentoId, fromMs) {
  const path = `/v1/projects/${PROJECT}/databases/(default)/documents/pareamentos/${pareamentoId}/extrato?pageSize=50&orderBy=createdAtMs%20desc`;
  const res = await req('GET', path, bearer);
  const docs = (res.body && res.body.documents) || [];
  return docs
    .map((d) => d.fields || {})
    .filter((f) => intField(f, 'createdAtMs') >= fromMs)
    .map((f) => ({
      descricao: strField(f, 'descricao'),
      valor: intField(f, 'valor'),
      beneficiarioUid: strField(f, 'beneficiarioUid'),
      tipo: strField(f, 'tipo'),
      createdAtMs: intField(f, 'createdAtMs'),
    }));
}

function challengePayload(tipo, docId, pairUids, pareamentoId, nowMs) {
  if (tipo === 'alma_gemea') {
    return {
      id: docId,
      challengeId: 'alma_gemea',
      titulo: 'Alma Gemea',
      descricao: 'Respondam a mesma pergunta para ganhar 2 foguinhos.',
      pergunta: 'Qual lugar voce escolheria para um date perfeito?',
      reward: 2,
      status: 'pendente',
      pairUids,
      pareamentoId,
      respostas: {},
      respondeuEm: {},
      respondeuNome: {},
      concluido: false,
      rewarded: false,
      createdAtMs: nowMs,
      startedAtMs: nowMs,
      expiresAtMs: nowMs + CYCLE_MS,
    };
  }
  if (tipo === 'preferencias') {
    return {
      id: docId,
      challengeId: 'preferencias',
      tipo: 'escolha',
      titulo: 'Preferencias',
      descricao: 'Escolham a mesma opcao para ganhar 2 foguinhos.',
      opcaoA: 'Netflix e cobertor',
      opcaoB: 'Jantar fora',
      reward: 2,
      status: 'pendente',
      pairUids,
      pareamentoId,
      respostas: {},
      respondeuEm: {},
      concluido: false,
      rewarded: false,
      createdAtMs: nowMs,
      startedAtMs: nowMs,
      expiresAtMs: nowMs + CYCLE_MS,
    };
  }
  return {
    id: docId,
    challengeId: 'roleta',
    tipo: 'roleta',
    titulo: 'Roleta dos Foguinhos',
    descricao: 'Cada um gira a roleta. A soma dos resultados e o bonus!',
    status: 'pendente',
    pairUids,
    pareamentoId,
    respostas: {},
    respondeuEm: {},
    concluido: false,
    rewarded: false,
    createdAtMs: nowMs,
    startedAtMs: nowMs,
    expiresAtMs: nowMs + CYCLE_MS,
  };
}

async function runOne(tipo, ctx) {
  const { bearer, uidA, uidB, pareamentoId, pairKey } = ctx;
  const now = Date.now();
  const ids = {
    alma_gemea: `alma_gemea_${pairKey}`,
    preferencias: `preferencias_${pairKey}`,
    roleta: `roleta_${pairKey}`,
  };

  for (const k of Object.keys(ids)) {
    if (k !== tipo) await expireChallenge(bearer, ids[k]);
  }

  const beforePair = await getPairDoc(bearer, pareamentoId);
  const beforeF1 = intField(beforePair, 'foguinhos_pessoa1');
  const beforeF2 = intField(beforePair, 'foguinhos_pessoa2');
  const beforeConcl = intField(beforePair, 'desafiosConcluidos');

  await setChallengeDoc(
    bearer,
    ids[tipo],
    challengePayload(tipo, ids[tipo], [uidA, uidB].sort(), pareamentoId, now),
  );

  let inputIds;
  if (tipo === 'alma_gemea') {
    inputIds = [
      await createInput(bearer, {
        type: 'weekly_challenge_answer',
        challengeDocId: ids[tipo],
        responderUid: uidA,
        responderName: 'HomemTeste',
        answer: 'PRAIA',
        pareamentoId,
        createdAtMs: Date.now(),
        processed: false,
      }),
      await createInput(bearer, {
        type: 'weekly_challenge_answer',
        challengeDocId: ids[tipo],
        responderUid: uidB,
        responderName: 'Parceira',
        answer: 'PRAIA',
        pareamentoId,
        createdAtMs: Date.now(),
        processed: false,
      }),
    ];
  } else if (tipo === 'preferencias') {
    inputIds = [
      await createInput(bearer, {
        type: 'preference_challenge_answer',
        challengeDocId: ids[tipo],
        responderUid: uidA,
        responderName: 'HomemTeste',
        answer: 'A',
        pareamentoId,
        createdAtMs: Date.now(),
        processed: false,
      }),
      await createInput(bearer, {
        type: 'preference_challenge_answer',
        challengeDocId: ids[tipo],
        responderUid: uidB,
        responderName: 'Parceira',
        answer: 'A',
        pareamentoId,
        createdAtMs: Date.now(),
        processed: false,
      }),
    ];
  } else {
    inputIds = [
      await createInput(bearer, {
        type: 'roulette_spin',
        challengeDocId: ids[tipo],
        responderUid: uidA,
        responderName: 'HomemTeste',
        pareamentoId,
        createdAtMs: Date.now(),
        processed: false,
      }),
      await createInput(bearer, {
        type: 'roulette_spin',
        challengeDocId: ids[tipo],
        responderUid: uidB,
        responderName: 'Parceira',
        pareamentoId,
        createdAtMs: Date.now(),
        processed: false,
      }),
    ];
  }

  const inputSnaps = await waitInputs(bearer, inputIds, 60000);
  const errors = inputSnaps.map((f) => strField(f, 'error')).filter(Boolean);

  await sleep(2000);

  const ch = await getChallengeDoc(bearer, ids[tipo]);
  const afterPair = await getPairDoc(bearer, pareamentoId);
  const afterF1 = intField(afterPair, 'foguinhos_pessoa1');
  const afterF2 = intField(afterPair, 'foguinhos_pessoa2');
  const afterConcl = intField(afterPair, 'desafiosConcluidos');
  const extrato = await getPairExtratoSince(bearer, pareamentoId, now - 1000);

  return {
    tipo,
    inputIds,
    inputErrors: errors,
    challenge: {
      status: strField(ch, 'status'),
      concluido: boolField(ch, 'concluido'),
      rewarded: boolField(ch, 'rewarded'),
      reward: intField(ch, 'reward'),
    },
    saldo: {
      before: { pessoa1: beforeF1, pessoa2: beforeF2, desafiosConcluidos: beforeConcl },
      after: { pessoa1: afterF1, pessoa2: afterF2, desafiosConcluidos: afterConcl },
      delta: { pessoa1: afterF1 - beforeF1, pessoa2: afterF2 - beforeF2, desafiosConcluidos: afterConcl - beforeConcl },
    },
    extrato,
  };
}

async function main() {
  const bearer = token();
  const ua = await getUserByEmail(bearer, EMAIL_A);
  const ub = await getUserByEmail(bearer, EMAIL_B);
  const uidA = ua.uid;
  const uidB = ub.uid;
  const pareamentoId = ua.pareamentoId || ub.pareamentoId;
  if (!pareamentoId) throw new Error('PareamentoId nao encontrado');
  const pairKey = [uidA, uidB].sort().join('_');

  const ctx = { bearer, uidA, uidB, pareamentoId, pairKey };
  const out = [];
  out.push(await runOne('alma_gemea', ctx));
  out.push(await runOne('preferencias', ctx));
  out.push(await runOne('roleta', ctx));

  console.log(JSON.stringify({
    pair: { pareamentoId, uidA, uidB },
    resultados: out,
  }, null, 2));
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
