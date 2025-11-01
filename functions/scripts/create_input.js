/*
Usage:
  Option A: set env var to service account JSON path
    set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
    node functions\scripts\create_input.js <fromUid> <toUid> [amount]

  Option B: pass service account path as third arg
    node functions\scripts\create_input.js <fromUid> <toUid>
      <serviceAccountJsonPath>

This script uses the Firebase Admin SDK to create a document in `inputs/` with
basic fields expected by your `processInput` function.
*/

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

/**
 * Cria um documento em `inputs/` usando Admin SDK. Usado para testes locais.
 */
async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    console.error(
        "Usage: node create_input.js <fromUid> <toUid> " +
        "[serviceAccountJsonPath] [amount]",
    );
    process.exit(1);
  }
  const fromUid = argv[0];
  const toUid = argv[1];
  // If third arg looks like a path to json, use it as service account key
  let serviceAccountPath;
  let amount = 1;
  if (argv[2] && argv[2].endsWith(".json") && fs.existsSync(argv[2])) {
    serviceAccountPath = argv[2];
    if (argv[3]) amount = Number(argv[3]) || 1;
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (argv[2]) amount = Number(argv[2]) || 1;
  } else if (argv[2]) {
    // maybe user passed amount as third arg
    amount = Number(argv[2]) || 1;
  }

  if (serviceAccountPath && !admin.apps.length) {
    const sa = require(path.resolve(serviceAccountPath));
    admin.initializeApp({credential: admin.credential.cert(sa)});
  } else if (!admin.apps.length) {
    // initialize default (will use ADC if available)
    admin.initializeApp();
  }

  const db = admin.firestore();
  try {
    const docRef = await db.collection("inputs").add({
      fromUid,
      toUid,
      type: "gift",
      amount: Number(amount) || 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
    });
    console.log("Created input document with id:", docRef.id);
    console.log("Verifique os logs da função e o documento usuarios/{toUid}");
    console.log("para conferir.");
    process.exit(0);
  } catch (err) {
    console.error("Error creating input:", err);
    process.exit(2);
  }
}

main();
