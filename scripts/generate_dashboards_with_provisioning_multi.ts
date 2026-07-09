// scripts/generate_dashboards_with_provisioning_multi.ts
/**
 * Generate dashboards for N templates per tenant, assign Prometheus UID,
 * and emit one provider YAML per tenant folder.
 *
 * Usage:
 *   npx ts-node scripts/generate_dashboards_with_provisioning_multi.ts \
 *     --templates ./tmpl/customer_single.json,./tmpl/customer_client_credits.json \
 *     --tenants ./tenants.json \
 *     --out ./out \
 *     --prometheus-uid prom-main \
 *     --mount-path /var/lib/grafana/dashboards/customers \
 *     --folder-prefix Customers \
 *     --provider-prefix Customers
 */
import * as fs from 'fs';
import * as path from 'path';

type Tenant = { name: string; projectId: string; slug?: string };
type Dashboard = any;

function arg(name: string, def?: string) {
  const i = process.argv.indexOf('--'+name);
  if (i >= 0 && process.argv[i+1] && !process.argv[i+1].startsWith('--')) return process.argv[i+1];
  return def;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
}

function setTenantPid(d: Dashboard, pid: string) {
  const list = d.templating?.list;
  if (Array.isArray(list)) {
    const v = list.find((x:any) => x?.name === 'project_id');
    if (v) { v.query = pid; v.current = { text: pid, value: pid }; }
  }
}

function assignPromUID(d: Dashboard, uid: string) {
  const ds = { type: 'prometheus', uid };
  // templating
  if (d.templating?.list) {
    for (const v of d.templating.list) if (v?.type === 'query') v.datasource = ds;
  }
  // panels
  if (Array.isArray(d.panels)) {
    for (const p of d.panels) {
      p.datasource = ds;
      if (Array.isArray(p.targets)) for (const t of p.targets) t.datasource = ds;
    }
  }
}

function writeProviderYaml(outRoot: string, slug: string, tenantName: string, providerPrefix: string, folderPrefix: string, mountPath: string) {
  const y = `apiVersion: 1
providers:
- name: '${providerPrefix}: ${tenantName}'
  orgId: 1
  folder: '${folderPrefix}/${tenantName}'
  type: file
  allowUiUpdates: false
  editable: false
  options:
    path: '${mountPath}/${slug}'
`;
  const file = path.join(outRoot, slug, `provision_${slug}.yaml`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, y);
}

function main() {
  const templatesArg = arg('templates');
  const tenantsPath = arg('tenants');
  const outRoot = arg('out','./out') || './out';
  const promUid = arg('prometheus-uid','prom-main');
  const mountPath = arg('mount-path','/var/lib/grafana/dashboards/customers');
  const folderPrefix = arg('folder-prefix','Customers');
  const providerPrefix = arg('provider-prefix','Customers');

  if (!templatesArg || !tenantsPath) {
    console.error('Missing --templates or --tenants');
    process.exit(1);
  }
  const tmplPaths = templatesArg.split(',').map(s => s.trim()).filter(Boolean);
  const tenants: Tenant[] = JSON.parse(fs.readFileSync(tenantsPath,'utf8'));

  for (const t of tenants) {
    if (!t.name || !t.projectId) { console.warn('Skipping tenant', t); continue; }
    const slug = t.slug || slugify(t.name);
    const outDir = path.join(outRoot, slug);
    fs.mkdirSync(outDir, { recursive: true });
    
    // Fix: Ensure all parameters are defined before calling writeProviderYaml
    const safeProviderPrefix = providerPrefix || 'Customers';
    const safeFolderPrefix = folderPrefix || 'Customers';
    const safeMountPath = mountPath || '/var/lib/grafana/dashboards/customers';
    
    writeProviderYaml(outRoot, slug, t.name, safeProviderPrefix, safeFolderPrefix, safeMountPath);

    for (const p of tmplPaths) {
      const base = path.basename(p).replace(/\.json$/i,'');
      const d: Dashboard = JSON.parse(fs.readFileSync(p,'utf8'));
      setTenantPid(d, t.projectId);
      
      // Fix: Ensure promUid is defined before calling assignPromUID
      const safePromUid = promUid || 'prom-main';
      assignPromUID(d, safePromUid);
      
      // Title: "Axia — <Tenant> — <TemplateTitle>"
      d.title = `Axia — ${t.name} — ${d.title || base}`;
      d.uid = `cust-${slug}-${base}`.slice(0, 60);
      const outFile = path.join(outDir, `${slug}_${base}.json`);
      fs.writeFileSync(outFile, JSON.stringify(d, null, 2));
      console.log('Wrote', outFile);
    }
  }
}

main();