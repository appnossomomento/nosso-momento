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
  "http://localhost:3000",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
];

setGlobalOptions({
  region: "southamerica-east1",
});

const WEEKLY_CHALLENGE_QUESTIONS = [
  "Qual é a música que representa nossa história?",
  "Qual foi o local do nosso primeiro encontro?",
  "Qual foi o local do nosso primeiro beijo?",
  "Qual foi o primeiro filme que assistimos juntos?",
  "Qual foi a primeira viagem que fizemos juntos?",
  "Qual foi o primeiro presente que trocamos?",
  "Qual é o restaurante onde fomos no nosso primeiro encontro?",
  "Em que mês começamos o relacionamento?",
  "Qual é a nossa comida favorita para pedir juntos?",
  "Qual é a nossa série favorita que assistimos juntos?",
  "Qual é o nosso restaurante favorito para ir em datas especiais?",
  "Qual é o nosso programa favorito para o fim de semana?",
  "Qual tipo de filme preferimos assistir juntos?",
  "Qual é o nosso snack favorito para assistir filmes?",
  "Qual é a nossa música favorita para ouvir juntos?",
  "Qual é o nosso estilo de viagem preferido?",
  "Qual é o destino que mais queremos visitar juntos?",
  "Qual é o país dos nossos sonhos como casal?",
  "Qual é o sonho que queremos realizar juntos primeiro?",
  "Em que cidade queremos envelhecer juntos?",
  "Qual é o animal de estimação que queremos ter juntos?",
  "Qual é a nossa tradição favorita como casal?",
  "Qual é o nosso ritual favorito de fim de semana?",
  "Qual é o nosso prato favorito que cozinhamos juntos?",
  "Qual é a nossa estação do ano preferida para sair juntos?",
];

const WEEKLY_CHALLENGE_CHOICES = [
  {opcaoA: "Pagode", opcaoB: "Baile Funk"},
  {opcaoA: "Praia", opcaoB: "Cachoeira"},
  {opcaoA: "Bar", opcaoB: "Balada"},
  {opcaoA: "Cinema", opcaoB: "Netflix em casa"},
  {opcaoA: "Restaurante chique", opcaoB: "Boteco"},
  {opcaoA: "Pizza", opcaoB: "Hambúrguer"},
  {opcaoA: "Churrasco", opcaoB: "Japonês"},
  {opcaoA: "Sorvete", opcaoB: "Açaí"},
  {opcaoA: "Cozinhar em casa", opcaoB: "Pedir delivery"},
  {opcaoA: "Praia", opcaoB: "Montanha"},
  {opcaoA: "Hotel", opcaoB: "Airbnb"},
  {opcaoA: "Viagem de carro", opcaoB: "Avião"},
  {opcaoA: "Casa com quintal", opcaoB: "Apartamento"},
  {opcaoA: "Gato", opcaoB: "Cachorro"},
  {opcaoA: "Acordar cedo", opcaoB: "Dormir até tarde"},
  {opcaoA: "Férias longas", opcaoB: "Vários finais de semana"},
  {opcaoA: "Show ao vivo", opcaoB: "Festival de música"},
  {opcaoA: "Viajar pelo Brasil", opcaoB: "Exterior"},
  {opcaoA: "Viagem planejada", opcaoB: "Viagem surpresa"},
  {opcaoA: "Zoológico", opcaoB: "Aquário"},
];

// p = 1/6.8 ≈ 0.147 para os 6 comuns; +10 = 0.8p ≈ 0.118 (20% mais raro)
const ROULETTE_OPTIONS = [
  {valor: 1, prob: 0.147},
  {valor: 2, prob: 0.147},
  {valor: -1, prob: 0.147},
  {valor: -2, prob: 0.147},
  {valor: 4, prob: 0.147},
  {valor: -3, prob: 0.147},
  {valor: 10, prob: 0.118},
];

const WEEKLY_CHALLENGE_CYCLE_MS = (3 * 24 + 23) * 60 * 60 * 1000;

module.exports = {
  admin,
  RATE_LIMIT_STORE,
  ALLOWED_ORIGINS,
  WEEKLY_CHALLENGE_QUESTIONS,
  WEEKLY_CHALLENGE_CHOICES,
  ROULETTE_OPTIONS,
  WEEKLY_CHALLENGE_CYCLE_MS,
};
