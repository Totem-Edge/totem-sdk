#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Totem Extension Verification\n');

let errors = [];
let warnings = [];

// Check 1: Verify dist directory structure
function checkDistStructure() {
    console.log('📁 Checking dist directory structure...');
    
    const distPath = path.join(__dirname, 'dist');
    if (!fs.existsSync(distPath)) {
        errors.push('❌ dist directory does not exist');
        return;
    }
    
    const requiredFiles = [
        'manifest.json',
        'index.html', 
        'background.js',
        'content-script.js',
        'popup.js',
        'notify.js'
    ];
    
    const requiredDirs = [
        'icons'
    ];
    
    for (const file of requiredFiles) {
        const filePath = path.join(distPath, file);
        if (!fs.existsSync(filePath)) {
            errors.push(`❌ Missing required file: ${file}`);
        } else {
            console.log(`✅ ${file} exists`);
        }
    }
    
    for (const dir of requiredDirs) {
        const dirPath = path.join(distPath, dir);
        if (!fs.existsSync(dirPath)) {
            errors.push(`❌ Missing required directory: ${dir}`);
        } else {
            console.log(`✅ ${dir}/ directory exists`);
        }
    }
}

// Check 2: Validate manifest.json
function checkManifest() {
    console.log('\n📄 Validating manifest.json...');
    
    try {
        const manifestPath = path.join(__dirname, 'dist', 'manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        // Check critical fields
        if (manifest.manifest_version !== 3) {
            errors.push('❌ Manifest version should be 3');
        }
        
        if (!manifest.name || manifest.name !== 'Totem') {
            errors.push('❌ Extension name should be "Totem"');
        }
        
        // Check file paths are correct (no "dist/" or "src/" prefixes)
        if (manifest.background?.service_worker !== 'background.js') {
            errors.push(`❌ Background service_worker path incorrect: ${manifest.background?.service_worker}`);
        }
        
        if (manifest.action?.default_popup !== 'index.html') {
            errors.push(`❌ Default popup path incorrect: ${manifest.action?.default_popup}`);
        }
        
        const contentScript = manifest.content_scripts?.[0]?.js?.[0];
        if (contentScript !== 'content-script.js') {
            errors.push(`❌ Content script path incorrect: ${contentScript}`);
        }
        
        console.log('✅ Manifest structure valid');
        console.log(`✅ Name: ${manifest.name}`);
        console.log(`✅ Version: ${manifest.version}`);
        console.log(`✅ Background: ${manifest.background?.service_worker}`);
        console.log(`✅ Popup: ${manifest.action?.default_popup}`);
        
    } catch (err) {
        errors.push(`❌ Failed to parse manifest.json: ${err.message}`);
    }
}

// Check 3: Validate HTML file
function checkHTML() {
    console.log('\n🌐 Validating index.html...');
    
    try {
        const htmlPath = path.join(__dirname, 'dist', 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        
        if (!html.includes('<div id="root">')) {
            errors.push('❌ HTML missing root div element');
        }
        
        if (!html.includes('popup.js')) {
            errors.push('❌ HTML missing popup.js script reference');
        }
        
        if (!html.includes('width: 340px') || !html.includes('height: 520px')) {
            warnings.push('⚠️  HTML might not have correct extension dimensions');
        }
        
        console.log('✅ HTML structure valid');
        
    } catch (err) {
        errors.push(`❌ Failed to read index.html: ${err.message}`);
    }
}

// Check 4: Validate JavaScript bundle sizes
function checkBundleSizes() {
    console.log('\n📦 Checking bundle sizes...');
    
    const jsFiles = ['background.js', 'popup.js', 'content-script.js', 'notify.js'];
    
    for (const file of jsFiles) {
        const filePath = path.join(__dirname, 'dist', file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const sizeKB = Math.round(stats.size / 1024);
            console.log(`✅ ${file}: ${sizeKB} KB`);
            
            if (sizeKB > 1000) {
                warnings.push(`⚠️  ${file} is quite large (${sizeKB} KB)`);
            }
        }
    }
}

// Check 5: Validate icons
function checkIcons() {
    console.log('\n🎨 Checking icons...');
    
    const iconSizes = ['16', '48', '128'];
    const iconsDir = path.join(__dirname, 'dist', 'icons');
    
    for (const size of iconSizes) {
        const iconPath = path.join(iconsDir, `icon-${size}.png`);
        if (fs.existsSync(iconPath)) {
            console.log(`✅ icon-${size}.png exists`);
        } else {
            errors.push(`❌ Missing icon-${size}.png`);
        }
    }
    
    // Check logo
    const logoPath = path.join(iconsDir, 'logo.png');
    if (fs.existsSync(logoPath)) {
        console.log('✅ logo.png exists');
    } else {
        errors.push('❌ Missing logo.png');
    }
}

// Run all checks
checkDistStructure();
checkManifest();
checkHTML();
checkBundleSizes();
checkIcons();

// Summary
console.log('\n📊 Verification Summary:');
console.log(`✅ Checks passed: ${errors.length === 0 ? 'All' : 'Some'}`);

if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(`   ${warning}`));
}

if (errors.length > 0) {
    console.log('\n❌ Errors found:');
    errors.forEach(error => console.log(`   ${error}`));
    console.log('\n🚨 Extension may not load correctly in Chrome!');
    process.exit(1);
} else {
    console.log('\n🎉 Extension verification successful!');
    console.log('📋 Ready to load in Chrome:');
    console.log('   1. Open chrome://extensions/');
    console.log('   2. Enable Developer mode');
    console.log('   3. Click "Load unpacked"');
    console.log('   4. Select: packages/totem-extension/dist');
}