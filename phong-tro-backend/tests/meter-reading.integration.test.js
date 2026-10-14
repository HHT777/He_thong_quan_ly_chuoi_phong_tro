const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const integration = require("./helpers/integration-env");

const baseUrl = integration.baseUrl;
const sampleImage = path.resolve(__dirname, "../../OCR/meter_ocr/test/image_073.jpg");

async function jsonRequest(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, options);
  const body = await response.json();
  return { response, body };
}

async function login({ username, password }) {
  const { response, body } = await jsonRequest("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ten_dang_nhap: username, mat_khau: password }),
  });
  assert.equal(response.status, 200);
  return body.data.token;
}

test("UC-09/UC-10 real API flow: OCR preview, submit, ownership, confirm and idempotency", async () => {
  const tenantToken = await login(integration.tenant);
  const otherTenantToken = await login(integration.otherTenant);
  const landlordToken = await login(integration.landlord);
  const tenantHeaders = { Authorization: `Bearer ${tenantToken}` };
  const otherTenantHeaders = { Authorization: `Bearer ${otherTenantToken}` };
  const landlordHeaders = { Authorization: `Bearer ${landlordToken}` };
  const generatedPeriod = `${2500 + Math.floor(Math.random() * 400)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}`;
  const period = process.env.TEST_METER_PERIOD || generatedPeriod;

  const context = await jsonRequest(`/api/v1/me/meter-reading-context?period=${period}`, {
    headers: tenantHeaders,
  });
  assert.equal(context.response.status, 200);
  assert.equal(context.body.data.period, period);

  const form = new FormData();
  form.append("period", period);
  form.append("file", new Blob([fs.readFileSync(sampleImage)], { type: "image/jpeg" }), "meter.jpg");
  const preview = await jsonRequest("/api/v1/me/meter-reading-ocr-previews", {
    method: "POST",
    headers: tenantHeaders,
    body: form,
  });
  assert.equal(preview.response.status, 200, JSON.stringify(preview.body));
  assert.ok(["RECOGNIZED", "MANUAL_REQUIRED"].includes(preview.body.data.ocrStatus));
  assert.ok(preview.body.data.uploadToken);
  const readingValue = preview.body.data.suggestedReading ?? Number(context.body.data.previousReading.value) + 1;

  const key = `integration-${Date.now()}`;
  const submit = await jsonRequest("/api/v1/me/meter-readings", {
    method: "POST",
    headers: { ...tenantHeaders, "Idempotency-Key": key, "content-type": "application/json" },
    body: JSON.stringify({
      period,
      readingValue,
      uploadToken: preview.body.data.uploadToken,
    }),
  });
  assert.equal(submit.response.status, 201);
  assert.equal(submit.body.data.status, "CHO_XAC_NHAN");

  const repeatedSubmit = await jsonRequest("/api/v1/me/meter-readings", {
    method: "POST",
    headers: { ...tenantHeaders, "Idempotency-Key": key, "content-type": "application/json" },
    body: JSON.stringify({
      period,
      readingValue,
    }),
  });
  assert.equal(repeatedSubmit.response.status, 201);
  assert.equal(repeatedSubmit.body.data.id, submit.body.data.id);

  const tenantList = await jsonRequest("/api/v1/meter-readings", { headers: tenantHeaders });
  assert.equal(tenantList.response.status, 200);
  assert.ok(tenantList.body.data.some((item) => item.id === submit.body.data.id));
  const otherTenantList = await jsonRequest("/api/v1/meter-readings", { headers: otherTenantHeaders });
  assert.equal(otherTenantList.response.status, 200);
  assert.ok(!otherTenantList.body.data.some((item) => item.id === submit.body.data.id));

  const landlordList = await jsonRequest("/api/v1/meter-readings", { headers: landlordHeaders });
  assert.equal(landlordList.response.status, 200);
  const reading = landlordList.body.data.find((item) => item.id === submit.body.data.id);
  assert.ok(reading);

  const confirmHeaders = {
    ...landlordHeaders,
    "If-Match": `"${reading.version}"`,
    "Idempotency-Key": `confirm-${Date.now()}`,
  };
  const confirm = await jsonRequest(`/api/v1/meter-readings/${reading.id}/confirmations`, {
    method: "POST",
    headers: confirmHeaders,
    body: JSON.stringify({}),
  });
  assert.equal(confirm.response.status, 200);
  assert.equal(confirm.body.data.status, "DA_XAC_NHAN");
  assert.equal(confirm.body.data.readingValue, readingValue);

  const tenantUpdate = await jsonRequest(`/api/v1/meter-readings/${reading.id}`, {
    method: "PATCH",
    headers: { ...tenantHeaders, "If-Match": `"${reading.version}"`, "content-type": "application/json" },
    body: JSON.stringify({ readingValue: reading.readingValue, reason: "not allowed" }),
  });
  assert.equal(tenantUpdate.response.status, 403);
});
