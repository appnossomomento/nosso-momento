/* eslint-disable require-jsdoc */
"use strict";

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {GoogleAuth} = require("google-auth-library");

/**
 * Executa export diário do Firestore para o bucket GCS.
 * Roda às 03:00 (horário de Brasília = 06:00 UTC).
 * O bucket deve existir: gs://nosso-momento-app-backups/
 */
exports.backupFirestore = onSchedule(
    {
      schedule: "0 6 * * *",
      timeZone: "UTC",
      region: "southamerica-east1",
      memory: "256MiB",
      timeoutSeconds: 120,
    },
    async () => {
      const projectId = process.env.GCLOUD_PROJECT || "nosso-momento-app";

      const bucket = `gs://${projectId}-backups`;
      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const outputUri = `${bucket}/firestore/${timestamp}`;

      const url =
      `https://firestore.googleapis.com/v1/projects/${projectId}` +
      `/databases/(default):exportDocuments`;

      const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/datastore"],
      });
      const client = await auth.getClient();

      const response = await client.request({
        url,
        method: "POST",
        data: {outputUriPrefix: outputUri},
      });

      console.log("backupFirestore:iniciado", {
        projectId,
        outputUri,
        operationName: response.data.name,
      });
    },
);
