import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("creating an unlinked resident clears the building and room filters before reload", () => {
  const source = readFileSync(new URL("../src/modules/residents-contracts/residents.tab.js", import.meta.url), "utf8");
  assert.match(source, /create: \{[^\n]*onCreated: \(\) => \{ sessionStorage\.removeItem\("qlpt:residents-contracts-building"\); sessionStorage\.removeItem\("qlpt:residents-contracts-room"\); \}/);
  const view = readFileSync(new URL("../src/shared/components/view.js", import.meta.url), "utf8");
  assert.ok(view.indexOf("config.create.onCreated?.(body)") < view.indexOf("await renderList(context, config)", view.indexOf("config.create.onCreated?.(body)")));
});
