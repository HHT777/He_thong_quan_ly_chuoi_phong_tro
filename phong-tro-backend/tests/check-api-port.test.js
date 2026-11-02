const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { assertApiPortAvailable } = require("../scripts/check-api-port");

test("API port preflight rejects a listener and accepts a free port", async () => {
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, resolve));
  const port = listener.address().port;
  try {
    await assert.rejects(assertApiPortAvailable(port), new RegExp(`Cổng API ${port} đã được sử dụng`));
  } finally {
    await new Promise((resolve) => listener.close(resolve));
  }
  await assert.doesNotReject(assertApiPortAvailable(port));
});
