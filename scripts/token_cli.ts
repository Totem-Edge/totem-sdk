// scripts/token_cli.ts
/**
 * Token minting CLI: generate RSA keys, issue & verify JWTs, print JWKS.
 *
 * Usage examples:
 *  - Generate keys (PEM files):
 *      npx ts-node scripts/token_cli.ts gen-keys --out ./keys
 *  - Issue a token:
 *      npx ts-node scripts/token_cli.ts issue --priv ./keys/private.pem --kid axia-dev --iss https://rpc.axia.to --aud axia-telemetry --pid totem-shared --ttl 300
 *  - Verify a token:
 *      npx ts-node scripts/token_cli.ts verify --pub ./keys/public.pem --aud axia-telemetry --token <JWT>
 *  - Print JWKS (for /.well-known/jwks.json):
 *      npx ts-node scripts/token_cli.ts jwks --pub ./keys/public.pem --kid axia-dev
 */
import * as fs from 'fs';
import * as path from 'path';
import { generateKeyPair } from 'crypto';
import { SignJWT, importPKCS8, importSPKI, exportJWK, jwtVerify } from 'jose';

function arg(key: string, def?: string) {
  const ix = process.argv.indexOf('--' + key);
  if (ix >= 0 && process.argv[ix+1] && !process.argv[ix+1].startsWith('--')) return process.argv[ix+1];
  return def;
}

async function genKeys(outDir: string) {
  await new Promise<void>((resolve, reject) => {
    generateKeyPair('rsa', { modulusLength: 2048 }, (err, pubKey, privKey) => {
      if (err) return reject(err);
      const pubPem = pubKey.export({ type: 'spki', format: 'pem' }) as string;
      const privPem = privKey.export({ type: 'pkcs8', format: 'pem' }) as string;
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'public.pem'), pubPem);
      fs.writeFileSync(path.join(outDir, 'private.pem'), privPem);
      console.log('Wrote', path.join(outDir, 'public.pem'));
      console.log('Wrote', path.join(outDir, 'private.pem'));
      resolve();
    });
  });
}

async function issueToken() {
  const priv = arg('priv'); 
  const kid = arg('kid','axia-key'); 
  const iss = arg('iss','https://rpc.axia.to') || 'https://rpc.axia.to'; 
  const aud = arg('aud','axia-telemetry') || 'axia-telemetry';
  const pid = arg('pid'); 
  const ttl = Number(arg('ttl','300'));
  
  if (!priv || !pid) { 
    console.error('Missing --priv or --pid'); 
    process.exit(1); 
  }
  
  // Fix: Add null checks before reading files
  const key = await importPKCS8(fs.readFileSync(priv,'utf8'), 'RS256');
  const now = Math.floor(Date.now()/1000);
  const token = await new SignJWT({ pid })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(pid)
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(key);
  console.log(token);
}

async function verifyToken() {
  const pub = arg('pub'); 
  const aud = arg('aud','axia-telemetry'); 
  const token = arg('token');
  
  if (!pub || !token) { 
    console.error('Missing --pub or --token'); 
    process.exit(1); 
  }
  
  // Fix: Add null checks before reading files and verifying
  const key = await importSPKI(fs.readFileSync(pub,'utf8'), 'RS256');
  const { payload, protectedHeader } = await jwtVerify(token, key, { 
    audience: aud, 
    clockTolerance: 60 
  });
  console.log('ok', { 
    sub: payload.sub, 
    pid: (payload as any).pid, 
    iss: payload.iss, 
    aud: payload.aud, 
    exp: payload.exp, 
    header: protectedHeader 
  });
}

async function jwks() {
  const pub = arg('pub'); 
  const kid = arg('kid','axia-key');
  
  if (!pub) { 
    console.error('Missing --pub'); 
    process.exit(1); 
  }
  
  // Fix: Add null check before reading file
  const key = await importSPKI(fs.readFileSync(pub,'utf8'), 'RS256');
  const jwk = await exportJWK(key as any);
  (jwk as any).kid = kid; 
  (jwk as any).use = 'sig'; 
  (jwk as any).alg = 'RS256';
  console.log(JSON.stringify({ keys: [jwk] }, null, 2));
}

(async () => {
  const cmd = process.argv[2];
  try {
    if (cmd === 'gen-keys') {
      const out = arg('out','./keys') || './keys'; 
      await genKeys(out);
    } else if (cmd === 'issue') {
      await issueToken();
    } else if (cmd === 'verify') {
      await verifyToken();
    } else if (cmd === 'jwks') {
      await jwks();
    } else {
      console.log('Commands: gen-keys | issue | verify | jwks');
      process.exit(1);
    }
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();