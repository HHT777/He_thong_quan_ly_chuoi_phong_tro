import test from "node:test";
import assert from "node:assert/strict";
import { loadBuildingScope } from "../src/modules/residents-contracts/building-scope.js";

test("FR-035 building filter follows rooms and contracts across all pages", async () => {
  const previousStorage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => "building-a", setItem() {} };
  const calls = [];
  const api = { async get(path) {
    calls.push(path);
    if (path === "/phong?limit=100&page=1") return { data: [{ ma_phong: "room-b", ma_can: "building-b", canTro: { ten_can: "B" } }], pagination: { hasNext: true } };
    if (path === "/phong?limit=100&page=2") return { data: [{ ma_phong: "room-a", ma_can: "building-a", canTro: { ten_can: "A" } }], pagination: { hasNext: false } };
    if (path === "/hop-dong?limit=100&page=1") return { data: [{ ma_hop_dong: "contract-a", ma_phong: "room-a" }, { ma_hop_dong: "contract-b", ma_phong: "room-b" }], pagination: { hasNext: false } };
    throw new Error(`Unexpected ${path}`);
  } };
  try {
    const scope = await loadBuildingScope(api, { contracts: true });
    assert.equal(scope.selected, "building-a");
    assert.equal(scope.matchesRoom("room-a"), true);
    assert.equal(scope.matchesRoom("room-b"), false);
    assert.equal(scope.matchesContractId("contract-a"), true);
    assert.equal(scope.matchesContractId("contract-b"), false);
    assert.equal(scope.matchesResident({ hopDongs: [{ ma_phong: "room-b" }, { ma_phong: "room-a" }] }), true);
    assert.equal(scope.matchesResident({ hopDongs: [{ ma_phong: "room-b" }] }), false);
    assert.ok(calls.includes("/phong?limit=100&page=2"));
  } finally {
    globalThis.sessionStorage = previousStorage;
  }
});
