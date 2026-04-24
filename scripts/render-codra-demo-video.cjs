const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const chromePath = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((candidate) => fs.existsSync(candidate));

if (!chromePath) {
  console.error('Chrome or Edge is required to render the Codra demo video.');
  process.exit(1);
}

const port = 9366;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'codra-video-'));
const htmlPath = path.join(root, 'demo', 'codra-demo-video.html');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
const outputPath = path.join(root, 'demo', `codra-demo-video-${stamp}.webm`);
const pageUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function waitForPage() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const pages = await getJson(`http://127.0.0.1:${port}/json/list`);
      const page = pages.find((item) => item.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Chrome may still be starting.
    }
    await sleep(250);
  }
  throw new Error('Chrome DevTools Protocol page was not available.');
}

async function main() {
  const chrome = spawn(
    chromePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--allow-file-access-from-files',
      '--autoplay-policy=no-user-gesture-required',
      '--window-size=1920,1080',
      pageUrl,
    ],
    { stdio: 'ignore' },
  );

  let ws;
  try {
    const pageInfo = await waitForPage();
    ws = new WebSocket(pageInfo.webSocketDebuggerUrl);
    let sequence = 0;
    const pending = new Map();

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    function send(method, params = {}) {
      const id = ++sequence;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    }

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: pageUrl });
    await sleep(1000);

    const result = await send('Runtime.evaluate', {
      expression: 'window.renderCodraDemo()',
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
      timeout: 45000,
    });

    const dataUrl = result.result?.value;
    if (!dataUrl || !dataUrl.startsWith('data:video/webm;base64,')) {
      throw new Error('Renderer did not return a WebM data URL.');
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(outputPath);
  } finally {
    if (ws) ws.close();
    try {
      execFileSync('taskkill', ['/pid', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      chrome.kill();
    }
    await sleep(500);
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      // Windows can keep Chrome Crashpad metrics locked briefly after shutdown.
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
