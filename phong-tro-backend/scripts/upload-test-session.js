const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createUploadContext, inside, repositoryRoot, defaultUploadRoot } = require("../src/config/uploadFilesystem");
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");

// Read-only canary: never creates a directory, follows a link, or writes here.
function snapshotUploads(directory = path.join(defaultUploadRoot, "meter")) {
  const entries = [];
  function visit(target) {
    let stat;
    try { stat = fs.lstatSync(target); } catch (error) { if (error.code === "ENOENT") return; throw error; }
    const relative = path.relative(directory, target);
    if (stat.isSymbolicLink()) { entries.push({ path: relative, type: "link", value: fs.readlinkSync(target) }); return; }
    if (stat.isDirectory()) { for (const name of fs.readdirSync(target).sort()) visit(path.join(target, name)); }
    else if (stat.isFile()) entries.push({ path: relative, size: stat.size, sha256: digest(fs.readFileSync(target)) });
  }
  visit(directory);
  return { root: directory, count: entries.filter((row) => row.type !== "link").length, hash: digest(JSON.stringify(entries)), entries };
}
function assertUnchanged(before, after) {
  if (before.hash !== after.hash || before.count !== after.count) {
    const a = new Map(before.entries.map((row) => [row.path, JSON.stringify(row)]));
    const b = new Map(after.entries.map((row) => [row.path, JSON.stringify(row)]));
    const changed = [...new Set([...a.keys(), ...b.keys()])].filter((name) => a.get(name) !== b.get(name));
    throw Object.assign(new Error(`REAL_UPLOADS_CHANGED: ${changed.join(", ")}`), { code: "REAL_UPLOADS_CHANGED" });
  }
}
function createSession() {
  const parent = path.resolve(process.env.UPLOAD_TEST_SESSION_ROOT || os.tmpdir());
  if (!inside(os.tmpdir(), parent) || inside(repositoryRoot, parent)) throw new Error("Unsafe OS temporary directory");
  // Check the real parent BEFORE mkdtemp, including a junction redirected into
  // the repository. No configurable cwd/output-dir is accepted here.
  const canonical = fs.realpathSync(parent);
  if (!inside(os.tmpdir(), canonical) || inside(repositoryRoot, canonical)) throw new Error("Unsafe OS temporary directory");
  const root = fs.mkdtempSync(path.join(canonical, "qlpt-upload-"));
  const context = createUploadContext({ root, mode: "test", sessionRoot: root });
  return { context, env: { NODE_ENV: "test", UPLOAD_DIR: root, UPLOAD_TEST_SESSION_ROOT: root } };
}
async function withUploadProtection(action, { snapshot = snapshotUploads, logger = console } = {}) {
  const before = snapshot();
  logger.log(`[UPLOADS before] count=${before.count} sha256=${before.hash}`);
  let session; let checked = false;
  const verify = () => {
    if (checked) return;
    checked = true;
    const after = snapshot();
    logger.log(`[UPLOADS after] count=${after.count} sha256=${after.hash}`);
    assertUnchanged(before, after);
  };
  // exit covers an abrupt process.exit in an action; external SIGKILL/power loss
  // cannot execute JS finally/exit handlers and is not claimed as covered.
  const onExit = () => { try { verify(); } catch (error) { logger.error(error.message); process.exitCode = 1; } };
  process.once("exit", onExit);
  try { session = createSession(); return await action(session); }
  finally {
    try { if (session) session.context.removeTree(session.context.root); }
    finally {
      try { verify(); }
      finally { process.removeListener("exit", onExit); }
    }
  }
}
module.exports = { snapshotUploads, assertUnchanged, createSession, withUploadProtection };
