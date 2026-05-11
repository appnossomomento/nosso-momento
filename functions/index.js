/* eslint-disable require-jsdoc */
// Inicializa Firebase Admin e define opcoes globais primeiro
require("./lib/config");

const notifications = require("./handlers/notifications");
const memories = require("./handlers/memories");
const extrato = require("./handlers/extrato");
const moments = require("./handlers/moments");
const profile = require("./handlers/profile");
const milestones = require("./handlers/milestones");
const challenges = require("./handlers/challenges");
const waitlist = require("./handlers/waitlist");
const adminHandler = require("./handlers/admin");
const processInputHandler = require("./handlers/processInput");

exports.enviarNotificacaoPush = notifications.enviarNotificacaoPush;
exports.setNotificationToken = notifications.setNotificationToken;

exports.getMemorias = memories.getMemorias;
exports.createMemoriaPhoto = memories.createMemoriaPhoto;
exports.deleteMemoria = memories.deleteMemoria;

exports.getExtrato = extrato.getExtrato;

exports.handleMomentTaskUpdate = moments.handleMomentTaskUpdate;

exports.propagateProfileChange = profile.propagateProfileChange;

exports.checkMonthlyMilestones = milestones.checkMonthlyMilestones;

exports.rotateWeeklyChallenges = challenges.rotateWeeklyChallenges;
exports.resetWeeklyChallengesAdmin = challenges.resetWeeklyChallengesAdmin;

exports.joinWaitlist = waitlist.joinWaitlist;

exports.createInput = adminHandler.createInput;

exports.processInput = processInputHandler.processInput;

const backupHandler = require("./handlers/backup");
exports.backupFirestore = backupHandler.backupFirestore;
