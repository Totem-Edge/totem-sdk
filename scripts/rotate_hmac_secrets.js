import fs from 'fs';import crypto from 'crypto';import fetch from 'node-fetch';
const FILE=process.env.HMAC_SECRETS_FILE||'./secrets.hmac.json';const ADMIN_TOKEN=process.env.INGESTOR_ADMIN_TOKEN||'';
const INGESTOR_URL=process.env.INGESTOR_URL||'http://localhost:8081/v1/keys/hmac/reload';const ROTATE_DEFAULT=(process.env.ROTATE_DEFAULT||'true')==='true';
const ROTATE_PROJECTS=process.env.ROTATE_PROJECTS?process.env.ROTATE_PROJECTS.split(',').map(s=>s.trim()).filter(Boolean):[];
const SLACK_WEBHOOK_URL=process.env.SLACK_WEBHOOK_URL||'';function randSecret(n=48){return crypto.randomBytes(n).toString('hex');}
const j=JSON.parse(fs.readFileSync(FILE,'utf8'));if(ROTATE_DEFAULT){j.default=j.default||{};j.default.previous=j.default.current||j.default.previous||randSecret(24);j.default.current=randSecret(24);j.default.version=new Date().toISOString();}
for(const pid of ROTATE_PROJECTS){j.projects=j.projects||{};const obj=j.projects[pid]||{};obj.previous=obj.current||obj.previous||randSecret(24);obj.current=randSecret(24);obj.version=new Date().toISOString();j.projects[pid]=obj;}
fs.writeFileSync(FILE,JSON.stringify(j,null,2));console.log('Secrets rotated and written to',FILE);
if(ADMIN_TOKEN){fetch(INGESTOR_URL,{method:'POST',headers:{'X-Admin-Token':ADMIN_TOKEN}}).then(async r=>{const t=await r.text();console.log('Reload response',r.status,t);
if(SLACK_WEBHOOK_URL){const payload={text:`HMAC secrets rotated. Reload status ${r.status}. Version: ${j.default?.version||'n/a'}`};return fetch(SLACK_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});}}).catch(e=>console.error('Reload failed',e));}