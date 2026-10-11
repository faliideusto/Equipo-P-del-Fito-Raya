import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile, rename, rm, access } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
const folder = path.resolve(".snp-private");
const sessionFile = path.resolve(process.env.SNP_SESSION_FILE || path.join(folder, "session.json"));
await mkdir(folder, { recursive: true });
const status = async (state, message) => writeFile(path.join(folder,"login-status.json"), JSON.stringify({state,message,updatedAt:new Date().toISOString()}), {mode:0o600});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function chromePath() {
  const candidates = [process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"].filter(Boolean);
  for (const candidate of candidates) { try { await access(candidate); return candidate; } catch {} }
  throw new Error("Chrome not found");
}
const freePort = () => new Promise((resolve, reject) => { const server = createServer(); server.unref(); server.on("error", reject); server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); }); });
let chrome; let browser; let profile;
try {
  await status("starting","Abriendo Chrome para iniciar sesión en SNP…");
  // Google rejects sign-in in automation-controlled browsers. Launch the normal
  // Chrome binary with a throwaway profile and only attach over DevTools to read
  // SNP cookies; the profile (including Google cookies) is deleted afterwards.
  profile = await mkdtemp(path.join(tmpdir(), "fito-snp-login-"));
  const port = await freePort();
  chrome = spawn(await chromePath(), [`--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "https://snpgalaxy.com"], { stdio: "ignore" });
  for (let attempt = 0; attempt < 40 && !browser; attempt++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch { await sleep(500); }
  }
  if (!browser) throw new Error("DevTools not available");
  const context = browser.contexts()[0];
  await status("waiting","Entra con Google y abre Series Nacionales → tu plantilla o clasificación.");
  console.log("Completa manualmente el acceso con Google y abre tu plantilla o clasificación SNP.");
  let saved = false;
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline && !saved && browser.isConnected()) {
    for (const tab of context.pages()) {
      for (const frame of tab.frames()) {
        let url;
        try { url = new URL(frame.url() || "about:blank"); } catch { continue; }
        if (url.hostname !== "seriesnacionalesdepadel.snpgalaxy.com") continue;
        const sportTable = await frame.locator("table tbody tr").count().catch(()=>0);
        if (!sportTable) continue;
        const text = await frame.locator("body").innerText().catch(()=>"");
        if (!/Clasificación|RANKING NACIONAL|Ranking Nacional/.test(text)) continue;
        const cookies = (await context.cookies()).filter(cookie => ["snpgalaxy.com","seriesnacionalesdepadel.snpgalaxy.com"].includes(cookie.domain.replace(/^\./,"")));
        const session = {cookies,frameUrl:frame.url(),savedAt:new Date().toISOString()};
        await mkdir(path.dirname(sessionFile),{recursive:true});
        await writeFile(sessionFile+".tmp",JSON.stringify(session),{mode:0o600});
        await rename(sessionFile+".tmp",sessionFile);
        await status("saved","Sesión SNP guardada. Ya puedes comprobar la conexión.");
        console.log("Sesión SNP guardada. No se ha guardado la contraseña ni el acceso de Google.");
        saved = true; break;
      }
      if(saved)break;
    }
    if(!saved)await sleep(1500);
  }
  if(!saved){await status("error","No se completó el acceso. Vuelve a abrir la ventana de SNP.");process.exitCode=1;}
} catch {
  // Browser errors may contain authenticated URLs; never log the raw exception.
  await status("error","No se pudo abrir SNP en Chrome. Comprueba que Google Chrome está instalado y vuelve a intentarlo.");
  console.error("No se pudo abrir la ventana de conexión SNP.");process.exitCode=1;
} finally {
  await browser?.close().catch(()=>{});
  chrome?.kill();
  if (profile) { await sleep(500); await rm(profile, { recursive: true, force: true }).catch(()=>{}); }
}
