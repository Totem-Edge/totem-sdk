import fs from 'node:fs';
const data = fs.readFileSync(0,'utf8');
try{ const j=JSON.parse(data); console.log(JSON.stringify(j,null,2)); }
catch(e){ console.error(data.trim()); process.exit(1); }