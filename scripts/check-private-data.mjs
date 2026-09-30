import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';
process.loadEnvFile('.env.local');
const secrets=[process.env.SNP_EMAIL,process.env.SNP_PASSWORD].filter(Boolean);
let scanned=0,leaks=0;
async function visit(dir){for(const e of await readdir(dir,{withFileTypes:true})){const name=path.join(dir,e.name);if(e.isDirectory())await visit(name);else if(/\.(js|json)$/.test(e.name)){const text=await readFile(name,'utf8');scanned++;if(secrets.some(s=>text.includes(s)))leaks++;}}}
await visit('.next/static');await visit('.snp-cache');
console.log(JSON.stringify({filesScanned:scanned,credentialLeaks:leaks}));if(leaks)process.exitCode=1;
