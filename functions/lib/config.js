/* eslint-disable require-jsdoc */
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const RATE_LIMIT_STORE = new Map();

// --- CORS: whitelist de origens permitidas ---
const ALLOWED_ORIGINS = [
  "https://nossomomento.app",
  "https://www.nossomomento.app",
  "https://nosso-momento-app.web.app",
  "https://nosso-momento-app.firebaseapp.com",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
];

setGlobalOptions({
  region: "southamerica-east1",
});

const WEEKLY_CHALLENGE_QUESTIONS = [
  "Qual é a música que representa vocês dois?",
  "Qual o local que nós demos o primeiro beijo?",
  "Qual foi o primeiro filme que vimos juntos?",
  "Qual é a nossa comida favorita para pedir juntos?",
];
const WEEKLY_CHALLENGE_CYCLE_MS = (3 * 24 + 23) * 60 * 60 * 1000;

module.exports = {
  admin,
  RATE_LIMIT_STORE,
  ALLOWED_ORIGINS,
  WEEKLY_CHALLENGE_QUESTIONS,
  WEEKLY_CHALLENGE_CYCLE_MS,
};
