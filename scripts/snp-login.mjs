import { chromium } from "playwright";
import { mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
const folder = path.resolve(".snp-private");
const sessionFile = path.resolve(process.env.SNP_SESSION_FILE || path.join(folder, "session.json"));
await mkdir(folder, { recursive: true });
const status = async (state, message) => writeFile(path.join(folder,"login-status.json"), JSON.stringify({state,message,updatedAt:new Date().toISOString()}), {mode:0o600});
let browser;
try {
  await status("starting","Abriendo Chrome para iniciar sesión en SNP…");
  // Ephemeral browser: Google cookies and passwords are never persisted by this helper.
  browser = await chromium.launch({channel:"chrome",headless:false});
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://snpgalaxy.com", {waitUntil:"domcontentloaded",timeout:45000});
  await status("waiting","Entra con Google y abre Series Nacionales → tu plantilla o clasificación.");
  console.log("Completa manualmente el acceso con Google y abre tu plantilla o clasificación SNP.");
  let saved = false;
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline && !saved && browser.isConnected()) {
    for (const tab of context.pages()) {
      for (const frame of tab.frames()) {
        const url = new URL(frame.url() || "about:blank");
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
    if(!saved)await new Promise(resolve=>setTimeout(resolve,1500));
  }
  if(!saved){await status("error","No se completó el acceso. Vuelve a abrir la ventana de SNP.");process.exitCode=1;}
} catch {
  // Browser errors may contain authenticated URLs; never log the raw exception.
  await status("error","No se pudo abrir SNP en Chrome. Comprueba el acceso a Internet y vuelve a intentarlo.");
  console.error("No se pudo abrir la ventana de conexión SNP.");process.exitCode=1;
} finally { await browser?.close().catch(()=>{}); }
