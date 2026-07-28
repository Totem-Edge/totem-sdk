/**
 * Generate PNG icons from SVG for Chrome extension manifest
 * Run: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');

const svgContent = `<svg width="SIZE" height="SIZE" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#0A0A0A" rx="16"/>
  <g transform="translate(10, 20) scale(0.236)">
    <polygon fill="#FAFAFA" points="190.53 120.24 257.3 120.24 257.3 95.26 185.92 95.26 190.53 120.24"/>
    <path fill="#FAFAFA" d="M367.02,79.23h-30.73c-8.64-29.41-35.86-50.95-68.03-50.95h-132.71c-65.93,0-119.57,53.64-119.57,119.57v195.5h361.31l-87.98-119.58,13.45-32.96h98.43l40.7,25.63v-62.34c0-41.28-33.59-74.87-74.87-74.87ZM327.86,318.35h-178.85v-85.4h-25v85.4H40.98v-170.5c0-52.15,42.42-94.57,94.57-94.57h132.71c24.54,0,44.64,19.35,45.85,43.59l-53.24,130.42,66.99,91.05ZM416.89,171.15l-8.48-5.34h-95.44l25.14-61.58h28.91c27.5,0,49.87,22.37,49.87,49.87v17.05Z"/>
  </g>
</svg>`;

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, '..', 'icons');

async function generateIcons() {
  try {
    const sharp = require('sharp');
    
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    for (const size of sizes) {
      const svg = svgContent.replace(/SIZE/g, String(size));
      const buffer = Buffer.from(svg);
      
      await sharp(buffer)
        .resize(size, size)
        .png()
        .toFile(path.join(iconsDir, `icon-${size}.png`));
      
      console.log(`Generated icon-${size}.png`);
    }

    await sharp(Buffer.from(svgContent.replace(/SIZE/g, '128')))
      .resize(128, 128)
      .png()
      .toFile(path.join(iconsDir, 'logo.png'));
    
    console.log('Generated logo.png');
    console.log('Done! Icons generated successfully.');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error('sharp module not found. Install with: npm install sharp');
      console.log('');
      console.log('Alternative: Use an online SVG-to-PNG converter:');
      console.log('1. Open packages/totem-extension/public/icons/logo.svg in browser');
      console.log('2. Export as PNG at 16x16, 32x32, 48x48, and 128x128');
      console.log('3. Save to packages/totem-extension/icons/');
    } else {
      console.error('Error:', err);
    }
  }
}

generateIcons();
