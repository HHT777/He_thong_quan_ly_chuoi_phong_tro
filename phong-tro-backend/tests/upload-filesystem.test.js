const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { createUploadContext, getUploadContext, defaultUploadRoot } = require("../src/config/uploadFilesystem");
const { snapshotUploads, assertUnchanged, withUploadProtection } = require("../scripts/upload-test-session");
const service = require("../src/services/meterReading.service");
const models = require("../src/models");
const session = getUploadContext();
const root = session.resolve("filesystem-tests");
session.mkdir(root);
test.after(() => session.removeTree(root));

test("upload guard rejects real repo paths in test mode before any filesystem or DB call", async (t) => {
  let calls = 0;
  const io = new Proxy({}, { get() { return () => { calls += 1; assert.fail("unsafe root must be rejected before I/O"); }; } });
  for (const operation of ["unlink", "mkdir", "writeFile", "removeTree", "rename", "copyFile"]) {
    assert.throws(() => {
      const context = createUploadContext({ root: defaultUploadRoot, mode: "test", sessionRoot: session.root, io });
      context[operation](path.join(defaultUploadRoot, "meter", "never-touch"), "never-touch");
    }, { code: "UPLOAD_FS_UNSAFE_PATH" });
  }
  t.mock.method(models.ChiSoDien, "findAll", async () => assert.fail("unsafe cleanup must not read DB"));
  await assert.rejects(async () => service.cleanupExpiredUploads(Date.now(), createUploadContext({ root: defaultUploadRoot, mode: "test", sessionRoot: session.root, io })), { code: "UPLOAD_FS_UNSAFE_PATH" });
  assert.equal(calls, 0);
});

test("upload test-mode guard rejects an OS-temp target outside its declared session (negative probe uses temp only)", () => {
  assert.ok(root.startsWith(path.resolve(os.tmpdir()) + path.sep));
  assert.throws(() => createUploadContext({ root: session.resolve("other-temp-target"), mode: "test", sessionRoot: root }), { code: "UPLOAD_FS_UNSAFE_PATH" });
});

test("upload containment guard rejects escape and similar prefixes before I/O (negative probe uses temp only)", () => {
  let touched = 0;
  const io = { lstatSync: () => ({ isSymbolicLink: () => false }), unlinkSync: () => { touched += 1; } };
  const context = createUploadContext({ root, mode: "test", sessionRoot: session.root, io });
  assert.throws(() => context.unlink(session.resolve("outside-target")), { code: "UPLOAD_FS_UNSAFE_PATH" });
  assert.throws(() => context.writeFile(`${root}-other/file`, "x"), { code: "UPLOAD_FS_UNSAFE_PATH" });
  assert.equal(touched, 0);
});

test("upload guard rejects a symlink or Windows junction component before mutation", () => {
  const link = path.join(root, "link"); let touched = 0;
  const io = {
    lstatSync: (target) => ({ isSymbolicLink: () => target === link }),
    writeFileSync: () => { touched += 1; }, unlinkSync: () => { touched += 1; },
  };
  const context = createUploadContext({ root, mode: "test", sessionRoot: session.root, io });
  assert.throws(() => context.writeFile(path.join(link, "image"), "x"), { code: "UPLOAD_FS_UNSAFE_PATH" });
  assert.throws(() => context.unlink(path.join(link, "image")), { code: "UPLOAD_FS_UNSAFE_PATH" });
  assert.equal(touched, 0);
});

test("explicit upload contexts remain independent of env changes and shared module cache", () => {
  const a = createUploadContext({ root: path.join(root, "a"), mode: "test", sessionRoot: session.root });
  const b = createUploadContext({ root: path.join(root, "b"), mode: "test", sessionRoot: session.root });
  assert.notEqual(a.resolve("meter", "x"), b.resolve("meter", "x"));
  const original = process.env.UPLOAD_DIR;
  try { process.env.UPLOAD_DIR = defaultUploadRoot; assert.throws(() => getUploadContext(), { code: "UPLOAD_FS_UNSAFE_PATH" }); assert.equal(a.resolve("meter"), path.join(root, "a", "meter")); }
  finally { process.env.UPLOAD_DIR = original; }
});

test("production upload mutations and referenced cleanup still work only inside a simulated OS-temp root", () => {
  const simulatedRoot = path.join(root, "production-simulation");
  session.mkdir(simulatedRoot);
  const code = `
    const assert=require('node:assert/strict'),path=require('node:path');
    const {createUploadContext}=require('./src/config/uploadFilesystem');
    const root=process.argv[1];
    const context=createUploadContext({root,mode:'production'});
    const dir=context.resolve('meter');context.mkdir(dir);
    const a=context.resolve('meter','a');context.writeFile(a,'a');
    const b=context.resolve('meter','b');context.rename(a,b);
    const c=context.resolve('meter','c');context.copyFile(b,c);context.unlink(c);
    const models=require('./src/models'); models.ChiSoDien.findAll=async()=>[{anh_cong_to_url:process.platform==='win32'?b.toUpperCase():b}];
    const orphan=context.resolve('meter','orphan'); context.writeFile(orphan,'orphan');
    context.utimes(b,new Date(0),new Date(0));context.utimes(orphan,new Date(0),new Date(0));
    require('./src/services/meterReading.service').cleanupExpiredUploads(Date.now(),context).then(removed=>{
      assert.equal(removed,1);assert(context.exists(b));assert(!context.exists(orphan));context.unlink(b);
      process.env.NODE_ENV='test';process.env.UPLOAD_TEST_SESSION_ROOT=path.join(root,'different-session');
      assert.throws(()=>context.unlink(path.join(root,'never-touch')),{code:'UPLOAD_FS_UNSAFE_PATH'});
    }).catch(e=>{console.error(e.message);process.exitCode=1;});
  `;
  const env = { ...process.env, NODE_ENV: "production", UPLOAD_DIR: simulatedRoot };
  delete env.UPLOAD_TEST_SESSION_ROOT;
  const result = spawnSync(process.execPath, ["-e", code, simulatedRoot], { cwd: path.resolve(__dirname, ".."), env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("upload canary detects changes by content, not just count or length, in a temporary fixture", () => {
  const fakeRoot = path.join(root, "canary"); session.mkdir(fakeRoot);
  const before = snapshotUploads(fakeRoot); session.writeFile(path.join(fakeRoot, "x"), "aa");
  assert.throws(() => assertUnchanged(before, snapshotUploads(fakeRoot)), { code: "REAL_UPLOADS_CHANGED" });
  const first = snapshotUploads(fakeRoot); session.writeFile(path.join(fakeRoot, "x"), "bb", { flag: "w" });
  assert.throws(() => assertUnchanged(first, snapshotUploads(fakeRoot)), { code: "REAL_UPLOADS_CHANGED" });
});

test("upload runner always checks its canary in finally on failure and reports changed uploads", async () => {
  const record = [];
  const baseline = { count: 0, hash: "same", entries: [] };
  const logger = { log: (text) => record.push(text), error() {} };
  await assert.rejects(withUploadProtection(async () => { throw new Error("simulated test failure"); }, { snapshot: () => baseline, logger }), /simulated test failure/);
  assert.equal(record.length, 2);
  let calls = 0;
  await assert.rejects(withUploadProtection(async () => 0, { logger, snapshot: () => ++calls === 1 ? baseline : { count: 1, hash: "changed", entries: [{ path: "simulated-only" }] } }), { code: "REAL_UPLOADS_CHANGED" });
});

test("upload mutation inventory centralizes product FS calls and every direct test upload write is guarded", () => {
  const source = (p) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");
  const routes = source("src/routes/meterReading.routes.js"), serviceSource = source("src/services/meterReading.service.js");
  assert.doesNotMatch(routes + serviceSource, /fs\.(?:promises\.)?(?:unlink|mkdir|writeFile|rm|rename|copyFile|createWriteStream)(?:Sync)?\s*\(/);
  assert.doesNotMatch(routes, /multer\(\{\s*dest:/);
  const runner = source("scripts/run-test-suite.js");
  assert.match(runner, /withUploadProtection/); assert.match(runner, /runNodeTests\(testFiles\(false\), env\)/);
  assert.doesNotMatch(runner, /fs\.rmSync\(uploadDir/);
  const primitive = /\bfs\.(?:promises\.)?(?:writeFile|unlink|rm|rmdir|rename|copyFile|mkdir|mkdtemp|utimes)(?:Sync)?\s*\(/;
  for (const name of fs.readdirSync(__dirname).filter((n) => n.endsWith(".test.js"))) {
    assert.doesNotMatch(source(`tests/${name}`), primitive, name);
  }
});

test("upload canary exit handler runs even when a child action calls process.exit", () => {
  const code = "require('./scripts/upload-test-session').withUploadProtection(async()=>{process.exit(7);});";
  const result = spawnSync(process.execPath, ["-e", code], { cwd: path.resolve(__dirname, ".."), env: { ...process.env }, encoding: "utf8" });
  assert.equal(result.status, 7, result.stderr);
  assert.match(result.stdout, /\[UPLOADS before\]/);
  assert.match(result.stdout, /\[UPLOADS after\]/);
});
