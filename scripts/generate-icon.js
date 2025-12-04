/**
 * Generate App Icon Script
 * Creates a 1024x1024 PNG icon with the premium gold S design
 * 
 * Requirements: Install sharp first: npm install --save-dev sharp
 * Then run: node scripts/generate-icon.js
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Error: sharp is not installed.');
  console.log('📦 Install it with: npm install --save-dev sharp');
  console.log('Then run: node scripts/generate-icon.js');
  process.exit(1);
}

async function generateIcon() {
  const size = 1024;
  const padding = 200; // Padding around the S
  const iconSize = size - (padding * 2);
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = iconSize / 2;
  
  // Create SVG for the icon
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="${size}" height="${size}" fill="#b38f5b"/>
      
      <!-- Inner glow circle -->
      <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="rgba(255, 255, 255, 0.2)"/>
      
      <!-- Main S letter -->
      <text 
        x="${centerX}" 
        y="${centerY + radius * 0.35}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="${iconSize * 0.6}" 
        font-weight="800" 
        fill="#ffffff" 
        text-anchor="middle" 
        dominant-baseline="middle"
        letter-spacing="-${iconSize * 0.015}"
      >S</text>
    </svg>
  `;

  try {
    // Convert SVG to PNG
    const outputPath = path.join(__dirname, '../assets/icon.png');
    
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log('✅ App icon generated successfully!');
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`📐 Size: ${size}x${size} pixels`);
    console.log('');
    console.log('🔄 Next steps:');
    console.log('1. Rebuild the app: npx expo prebuild --clean');
    console.log('2. Run on device: npx expo run:ios');
    console.log('3. The new icon will appear after rebuilding');
    
  } catch (error) {
    console.error('❌ Error generating icon:', error);
    process.exit(1);
  }
}

generateIcon();

