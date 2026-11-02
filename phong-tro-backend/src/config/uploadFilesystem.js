const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "../..");
const repositoryRoot = path.resolve(backendRoot, "..");
const defaultUploadRoot = path.join(backendRoot, "uploads");
const unsafe = () => Object.assign(new Error("Upload filesystem target is outside the authorized session/root"), { status: 500, code: "UPLOAD_FS_UNSAFE_PATH" });
function inside(root, target, allowRoot = true) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (allowRoot || relative !== "") && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

// No filesystem calls or directory creation at import/context construction.
// Re-evaluate the process test floor at EACH operation, even on cached contexts.
function createUploadContext({ root, mode = "production", sessionRoot, io = fs } = {}) {
  if (!root) throw unsafe();
  const resolvedRoot = path.resolve(root);
  const session = sessionRoot && path.resolve(sessionRoot);
  const testMode = () => mode === "test" || process.env.NODE_ENV === "test" || Boolean(process.env.UPLOAD_TEST_SESSION_ROOT);
  function validateContext() {
    if (resolvedRoot === path.parse(resolvedRoot).root) throw unsafe();
    if (testMode()) {
      const declared = session || process.env.UPLOAD_TEST_SESSION_ROOT;
      if (!declared || !inside(os.tmpdir(), declared, false) || inside(repositoryRoot, declared)
        || !inside(declared, resolvedRoot) || inside(repositoryRoot, resolvedRoot)) throw unsafe();
      if (process.env.UPLOAD_TEST_SESSION_ROOT && !inside(process.env.UPLOAD_TEST_SESSION_ROOT, resolvedRoot)) throw unsafe();
    }
  }
  validateContext();
  function resolve(...parts) {
    validateContext();
    const target = path.resolve(resolvedRoot, ...parts);
    if (!inside(resolvedRoot, target)) throw unsafe();
    return target;
  }
  function check(target) {
    const absolute = resolve(target);
    // Reject reparse/symlink components, not just a lexical '..'. No mutation
    // is attempted until all existing ancestors have been inspected.
    const parsed = path.parse(absolute);
    let current = parsed.root;
    for (const component of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
      current = path.join(current, component);
      try {
        if (io.lstatSync(current).isSymbolicLink()) throw unsafe();
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    return absolute;
  }
  const context = {
    root: resolvedRoot, mode, sessionRoot: session,
    resolve, check,
    exists(target) { return io.existsSync(check(target)); },
    list(target) { return io.readdirSync(check(target)); },
    stat(target) { return io.statSync(check(target)); },
    mkdir(target) { return io.mkdirSync(check(target), { recursive: true }); },
    writeFile(target, value, options = { flag: "wx" }) { return io.writeFileSync(check(target), value, options); },
    createWriteStream(target) { return io.createWriteStream(check(target), { flags: "wx" }); },
    unlink(target) { if (path.resolve(target) === resolvedRoot) throw unsafe(); return io.unlinkSync(check(target)); },
    rename(source, target) { const from = check(source), to = check(target); if (from === resolvedRoot || to === resolvedRoot) throw unsafe(); return io.renameSync(from, to); },
    copyFile(source, target) { const from = check(source), to = check(target); return io.copyFileSync(from, to, fs.constants.COPYFILE_EXCL); },
    utimes(target, atime, mtime) { return io.utimesSync(check(target), atime, mtime); },
    removeTree(target) {
      const absolute = check(target);
      if (!testMode()) throw unsafe(); // Only runner-owned temporary trees.
      function inspect(directory) {
        if (!io.existsSync(directory)) return;
        for (const name of io.readdirSync(directory)) {
          const child = check(path.join(directory, name));
          if (io.lstatSync(child).isDirectory()) inspect(child);
        }
      }
      inspect(absolute);
      return io.rmSync(check(absolute), { recursive: true, force: true });
    },
  };
  return Object.freeze(context);
}
function getUploadContext(env = process.env) {
  const test = env.NODE_ENV === "test" || Boolean(env.UPLOAD_TEST_SESSION_ROOT);
  if (test && (!env.UPLOAD_DIR || !env.UPLOAD_TEST_SESSION_ROOT)) throw unsafe();
  return createUploadContext({ root: path.resolve(backendRoot, env.UPLOAD_DIR || "uploads"), mode: test ? "test" : "production", sessionRoot: env.UPLOAD_TEST_SESSION_ROOT });
}
module.exports = { createUploadContext, getUploadContext, inside, repositoryRoot, defaultUploadRoot };
