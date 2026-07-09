#!/usr/bin/env node
// scripts/dashboard-generator.ts - Multi-template dashboard generator with tenant provisioning

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';

const program = new Command();

interface Tenant {
  id: string;
  name: string;
  project_id: string;
  plan_tier?: string;
  folder?: string;
}

interface DashboardTemplate {
  title: string;
  uid: string;
  [key: string]: any;
}

interface ProvisioningConfig {
  apiVersion: 1;
  providers: {
    name: string;
    type: string;
    disableDeletion: boolean;
    options: {
      path: string;
    };
  }[];
}

program
  .name('dashboard-generator')
  .description('Generate multi-tenant dashboards with provisioning')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate dashboards from templates')
  .requiredOption('-t, --templates <paths...>', 'Template dashboard JSON files')
  .requiredOption('-T, --tenants <path>', 'Tenants JSON file')
  .requiredOption('-o, --out <dir>', 'Output directory')
  .option('-p, --prometheus-uid <uid>', 'Prometheus datasource UID', 'prom-main')
  .option('-m, --mount-path <path>', 'Docker mount path for dashboards', '/var/lib/grafana/dashboards')
  .option('-f, --folder-prefix <prefix>', 'Folder prefix for organization', 'Customers')
  .option('-r, --provider-prefix <prefix>', 'Provisioning provider prefix', 'Customers')
  .action(async (options) => {
    try {
      console.log('🚀 Starting dashboard generation...');
      
      // Load tenants
      const tenantsContent = await fs.readFile(options.tenants, 'utf8');
      const tenants: Tenant[] = JSON.parse(tenantsContent);
      console.log(`📋 Loaded ${tenants.length} tenants`);
      
      // Create output directory
      await fs.mkdir(options.out, { recursive: true });
      
      let totalGenerated = 0;
      
      // Process each template
      for (const templatePath of options.templates) {
        console.log(`📄 Processing template: ${templatePath}`);
        
        const templateContent = await fs.readFile(templatePath, 'utf8');
        const template: DashboardTemplate = JSON.parse(templateContent);
        
        // Generate dashboards for each tenant
        for (const tenant of tenants) {
          const dashboard = await generateTenantDashboard(template, tenant, options.prometheusUid);
          
          // Determine output path
          const folderName = tenant.folder || `${options.folderPrefix}_${tenant.id}`;
          const outputDir = path.join(options.out, folderName);
          await fs.mkdir(outputDir, { recursive: true });
          
          const fileName = `${dashboard.uid}.json`;
          const outputPath = path.join(outputDir, fileName);
          
          await fs.writeFile(outputPath, JSON.stringify(dashboard, null, 2));
          totalGenerated++;
          
          console.log(`  ✅ Generated: ${outputPath}`);
        }
      }
      
      // Generate provisioning configuration
      await generateProvisioningConfig(tenants, options);
      
      console.log(`🎉 Generated ${totalGenerated} dashboards successfully!`);
      console.log(`📁 Output directory: ${options.out}`);
      
    } catch (error) {
      console.error('❌ Dashboard generation failed:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate generated dashboards')
  .requiredOption('-d, --dir <directory>', 'Directory containing dashboards')
  .option('-p, --prometheus-uid <uid>', 'Expected Prometheus UID', 'prom-main')
  .action(async (options) => {
    try {
      console.log('🔍 Validating dashboards...');
      
      const results = await validateDashboards(options.dir, options.prometheusUid);
      
      console.log(`📊 Validation Results:`);
      console.log(`   ✅ Valid dashboards: ${results.valid}`);
      console.log(`   ❌ Invalid dashboards: ${results.invalid}`);
      console.log(`   📄 Total checked: ${results.total}`);
      
      if (results.errors.length > 0) {
        console.log('');
        console.log('❌ Validation Errors:');
        results.errors.forEach(error => {
          console.log(`   ${error.file}: ${error.message}`);
        });
        process.exit(1);
      }
      
      console.log('✅ All dashboards are valid!');
      
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  });

async function generateTenantDashboard(
  template: DashboardTemplate, 
  tenant: Tenant, 
  prometheusUid: string
): Promise<DashboardTemplate> {
  // Clone template
  const dashboard = JSON.parse(JSON.stringify(template));
  
  // Update title and UID for tenant
  dashboard.title = `${template.title} - ${tenant.name}`;
  dashboard.uid = `${template.uid}-${tenant.id}`;
  
  // Lock dashboard to tenant project_id in templating
  if (dashboard.templating && dashboard.templating.list) {
    dashboard.templating.list = dashboard.templating.list.map((variable: any) => {
      if (variable.name === 'tenant_project_id' || variable.name === 'project_id') {
        return {
          ...variable,
          type: 'constant',
          query: tenant.project_id,
          current: {
            value: tenant.project_id,
            text: tenant.project_id
          },
          hide: 2 // Hide from UI
        };
      }
      return variable;
    });
  }
  
  // Update datasource UIDs in panels
  if (dashboard.panels) {
    dashboard.panels = await updatePanelDatasources(dashboard.panels, prometheusUid);
  }
  
  // Replace template variables in queries
  dashboard.panels = replaceTenantVariables(dashboard.panels, tenant);
  
  // Add tenant metadata
  dashboard.tags = [...(dashboard.tags || []), `tenant:${tenant.id}`, `plan:${tenant.plan_tier || 'unknown'}`];
  
  return dashboard;
}

async function updatePanelDatasources(panels: any[], prometheusUid: string): Promise<any[]> {
  return panels.map(panel => {
    if (panel.type === 'row') {
      return panel;
    }
    
    if (panel.targets) {
      panel.targets = panel.targets.map((target: any) => ({
        ...target,
        datasource: {
          type: 'prometheus',
          uid: prometheusUid
        }
      }));
    }
    
    return panel;
  });
}

function replaceTenantVariables(panels: any[], tenant: Tenant): any[] {
  const panelsStr = JSON.stringify(panels);
  const replaced = panelsStr
    .replace(/\$tenant_project_id/g, tenant.project_id)
    .replace(/\$\{tenant_project_id\}/g, tenant.project_id)
    .replace(/\$project_id/g, tenant.project_id)
    .replace(/\$\{project_id\}/g, tenant.project_id);
  
  return JSON.parse(replaced);
}

async function generateProvisioningConfig(tenants: Tenant[], options: any): Promise<void> {
  const config: ProvisioningConfig = {
    apiVersion: 1,
    providers: []
  };
  
  // Create provider for each unique folder
  const folders = new Set(tenants.map(t => t.folder || `${options.folderPrefix}_${t.id}`));
  
  for (const folder of folders) {
    config.providers.push({
      name: `${options.providerPrefix}_${folder}`,
      type: 'file',
      disableDeletion: false,
      options: {
        path: path.join(options.mountPath, folder)
      }
    });
  }
  
  const provisioningPath = path.join(options.out, 'provisioning.yaml');
  const yamlContent = `# Grafana Dashboard Provisioning Configuration
# Generated by dashboard-generator

apiVersion: 1

providers:
${config.providers.map(provider => `  - name: ${provider.name}
    type: ${provider.type}
    disableDeletion: ${provider.disableDeletion}
    options:
      path: ${provider.options.path}`).join('\n')}
`;
  
  await fs.writeFile(provisioningPath, yamlContent);
  console.log(`📋 Generated provisioning config: ${provisioningPath}`);
}

interface ValidationResult {
  valid: number;
  invalid: number;
  total: number;
  errors: { file: string; message: string }[];
}

async function validateDashboards(directory: string, expectedPrometheusUid: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: 0,
    invalid: 0,
    total: 0,
    errors: []
  };
  
  async function validateDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await validateDir(fullPath);
      } else if (entry.name.endsWith('.json')) {
        result.total++;
        
        try {
          const content = await fs.readFile(fullPath, 'utf8');
          const dashboard = JSON.parse(content);
          
          // Validate dashboard structure
          if (!dashboard.title || !dashboard.uid) {
            result.errors.push({
              file: fullPath,
              message: 'Missing required fields: title or uid'
            });
            result.invalid++;
            continue;
          }
          
          // Check for unresolved variables
          const dashboardStr = JSON.stringify(dashboard);
          if (dashboardStr.includes('$project_id') && !dashboardStr.includes('"project_id"')) {
            result.errors.push({
              file: fullPath,
              message: 'Unresolved $project_id variable found'
            });
            result.invalid++;
            continue;
          }
          
          // Validate Prometheus UID
          let hasValidDatasource = false;
          if (dashboard.panels) {
            for (const panel of dashboard.panels) {
              if (panel.targets) {
                for (const target of panel.targets) {
                  if (target.datasource && target.datasource.uid === expectedPrometheusUid) {
                    hasValidDatasource = true;
                    break;
                  }
                }
              }
              if (hasValidDatasource) break;
            }
          }
          
          if (!hasValidDatasource && dashboard.panels && dashboard.panels.length > 0) {
            result.errors.push({
              file: fullPath,
              message: `No panels with expected Prometheus UID: ${expectedPrometheusUid}`
            });
            result.invalid++;
            continue;
          }
          
          result.valid++;
          
        } catch (error) {
          result.errors.push({
            file: fullPath,
            message: `Parse error: ${error}`
          });
          result.invalid++;
        }
      }
    }
  }
  
  await validateDir(directory);
  return result;
}

// Add fetch polyfill for Node.js < 18
if (typeof fetch === 'undefined') {
  const { default: fetch } = await import('node-fetch');
  (globalThis as any).fetch = fetch;
}

program.parse();