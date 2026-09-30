// Scan only files eligible for Git. Never print matched credential values.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

try { process.loadEnvFile(".env.local"); } catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const secrets = [process.env.SNP_EMAIL, process.env.SNP_PASSWORD, process.env.POSITIONS_ADMIN_PASSWORD, process.env.SUPABASE_SECRET_KEY].filter(Boolean);
const root = process.cwd().replaceAll("\\", "/");
const files = [...new Set(execFileSync("git", ["-c", `safe.directory=${root}`, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], {encoding:"utf8"}).split("\0").filter(Boolean))];
const findings = [];
let scanned = 0;
for (const file of files) {
  if (/^(?:\.env(?:$|\.)|\.snp-private\/|\.snp-cache\/|\.club-private\/)/.test(file) && file !== ".env.example") {
    findings.push({file, reason:"Archivo privado incluido en Git"});
  }
  if (!/\.(?:tsx?|m?js|json|ya?ml|md|html|txt|css|svg)$/.test(file) && ![".env.example", ".gitignore"].includes(file)) continue;
  const content = readFileSync(path.resolve(file), "utf8");
  scanned++;
  if (secrets.some(secret => content.includes(secret))) findings.push({file, reason:"Credencial configurada encontrada"});
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}/.test(content)) findings.push({file, reason:"Posible clave privada o token"});
}
console.log(JSON.stringify({eligibleFiles:files.length, textFilesScanned:scanned, findings}, null, 2));
if (findings.length) process.exitCode = 1;
