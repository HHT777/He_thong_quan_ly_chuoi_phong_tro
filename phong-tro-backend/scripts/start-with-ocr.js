const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
require("dotenv").config();

const repoRoot = path.resolve(__dirname, "../..");
const ocrRoot = path.join(repoRoot, "phong-tro-ocr");
const requirementsPath = path.join(ocrRoot, "requirements.txt");
const venvPath = path.join(ocrRoot, ".venv");
const windows = process.platform === "win32";
const venvPython = path.join(venvPath, windows ? "Scripts/python.exe" : "bin/python");
const startupTimeoutMs = Number(process.env.OCR_STARTUP_TIMEOUT_MS || 180000);
let ocrProcess = null;

function runSetup(command, args, label) {
  console.log(`[OCR] ${label}`);
  const result = spawnSync(command, args, { cwd: ocrRoot, stdio: "inherit", shell: false });
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label}: tiến trình kết thúc với mã ${result.status}`);
}

function findPython() {
  const candidates = process.env.OCR_PYTHON
    ? [[process.env.OCR_PYTHON, []]]
    : windows
      ? [["py", ["-3"]], ["python", []]]
      : [["python3", []], ["python", []]];
  for (const [command, prefix] of candidates) {
    const result = spawnSync(command, [...prefix, "--version"], { encoding: "utf8", timeout: 10000, windowsHide: true });
    if (!result.error && result.status === 0) return { command, prefix };
  }
  throw new Error("Không tìm thấy Python 3. Cài Python 3 rồi chạy lại npm start; có thể đặt OCR_PYTHON nếu Python chưa có trong PATH.");
}

function ensurePythonEnvironment() {
  if (!fs.existsSync(requirementsPath)) throw new Error(`Thiếu ${requirementsPath}`);
  for (const model of ["digit_detection.pt", "number_detection.pt"]) {
    if (!fs.existsSync(path.join(ocrRoot, "models", model))) throw new Error(`Thiếu model OCR: phong-tro-ocr/models/${model}`);
  }

  let pythonCommand = venvPython;
  if (!fs.existsSync(venvPython)) {
    const systemPython = findPython();
    runSetup(systemPython.command, [...systemPython.prefix, "-m", "venv", venvPath], "Tạo môi trường Python cho OCR lần đầu");
  }

  const requirementsHash = crypto.createHash("sha256").update(fs.readFileSync(requirementsPath)).digest("hex");
  const markerPath = path.join(venvPath, ".requirements-sha256");
  let installedHash = "";
  try { installedHash = fs.readFileSync(markerPath, "utf8").trim(); } catch {}
  if (installedHash !== requirementsHash) {
    runSetup(pythonCommand, ["-m", "pip", "install", "--disable-pip-version-check", "-r", requirementsPath], "Cài các thư viện OCR lần đầu hoặc sau khi requirements thay đổi");
    fs.writeFileSync(markerPath, `${requirementsHash}\n`);
  }
  return pythonCommand;
}

function resolveOcrEndpoint() {
  let endpoint;
  try { endpoint = new URL(process.env.OCR_BASE_URL || "http://127.0.0.1:8000"); }
  catch { throw new Error("OCR_BASE_URL không phải URL hợp lệ."); }
  if (!/^https?:$/.test(endpoint.protocol)) throw new Error("OCR_BASE_URL phải dùng HTTP hoặc HTTPS.");
  const host = endpoint.hostname.replace(/^\[|\]$/g, "");
  const local = ["127.0.0.1", "localhost", "::1"].includes(host);
  return { endpoint, host, local, port: endpoint.port || (endpoint.protocol === "https:" ? "443" : "80") };
}

async function isHealthy(endpoint) {
  try {
    const response = await fetch(new URL("/health", endpoint));
    if (!response.ok) return false;
    const body = await response.json();
    return body.success === true;
  } catch { return false; }
}

function launchOcr(python, host, port) {
  console.log(`[OCR] Khởi động dịch vụ tại http://${host}:${port}`);
  ocrProcess = spawn(python, ["-m", "uvicorn", "app.main:app", "--host", host, "--port", String(port)], {
    cwd: ocrRoot,
    stdio: "inherit",
    windowsHide: true,
    env: process.env,
  });
  ocrProcess.once("error", (error) => { ocrProcess.spawnError = error; });
  process.once("exit", () => {
    if (ocrProcess && ocrProcess.exitCode === null) ocrProcess.kill();
  });
}

async function waitForOcr(endpoint) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (ocrProcess?.spawnError) throw new Error(`Không khởi động được OCR: ${ocrProcess.spawnError.message}`);
    if (ocrProcess?.exitCode !== null && ocrProcess?.exitCode !== undefined) {
      throw new Error(`Dịch vụ OCR đã dừng khi khởi động (mã ${ocrProcess.exitCode}).`);
    }
    if (await isHealthy(endpoint)) {
      console.log("[OCR] Sẵn sàng nhận ảnh công tơ.");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`OCR chưa sẵn sàng sau ${Math.round(startupTimeoutMs / 1000)} giây.`);
}

async function start() {
  const { endpoint, host, local, port } = resolveOcrEndpoint();
  if (local && await isHealthy(endpoint)) {
    console.log("[OCR] Đang dùng dịch vụ OCR đã chạy sẵn.");
  } else if (!local) {
    console.log(`[OCR] Dùng dịch vụ OCR bên ngoài: ${endpoint.origin}`);
  } else {
    const python = ensurePythonEnvironment();
    launchOcr(python, host === "localhost" ? "127.0.0.1" : host, port);
    await waitForOcr(endpoint);
  }

  console.log("[API] Khởi động backend…");
  require(path.join(__dirname, "../src/index.js"));
}

start().catch((error) => {
  console.error(`[Khởi động] ${error.message}`);
  if (ocrProcess && ocrProcess.exitCode === null) ocrProcess.kill();
  process.exitCode = 1;
});
