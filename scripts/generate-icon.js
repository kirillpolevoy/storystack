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
  const padding = 200; // Padding around the square icon
  const iconSize = size - (padding * 2); // 624x624 square
  const centerX = size / 2; // 512
  const centerY = size / 2; // 512
  
  // Exact proportions from login screen:
  // Login: 96x96 square, borderRadius 24, fontSize 48, letterSpacing -1.5
  // borderRadius ratio: 24/96 = 0.25 (25%)
  // fontSize ratio: 48/96 = 0.5 (50%)
  // letterSpacing ratio: -1.5/96 = -0.015625 per pixel
  
  const borderRadius = iconSize * 0.25; // 156 (exactly 25% like login screen)
  const fontSize = iconSize * 0.5; // 312 (exactly 50% like login screen: 48/96)
  const letterSpacing = iconSize * (-1.5 / 96); // -9.75 (proportional to login screen)
  
  // Create SVG for the icon - matching login screen design exactly
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background (white/transparent for app icon) -->
      <rect width="${size}" height="${size}" fill="#ffffff"/>
      
      <!-- Main square icon with rounded corners (exactly matching login screen) -->
      <rect 
        x="${padding}" 
        y="${padding}" 
        width="${iconSize}" 
        height="${iconSize}" 
        rx="${borderRadius}" 
        ry="${borderRadius}" 
        fill="#b38f5b"
      />
      
      <!-- Inner glow effect (matching login screen exactly) -->
      <rect 
        x="${padding}" 
        y="${padding}" 
        width="${iconSize}" 
        height="${iconSize}" 
        rx="${borderRadius}" 
        ry="${borderRadius}" 
        fill="rgba(255, 255, 255, 0.2)"
      />
      
      <!-- Main S letter - perfectly centered (matching login screen exactly) -->
      <text 
        x="${centerX}" 
        y="${centerY}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="${fontSize}" 
        font-weight="800" 
        fill="#ffffff" 
        text-anchor="middle" 
        dominant-baseline="central"
        letter-spacing="${letterSpacing}"
      >S</text>
    </svg>
  `;

  try {
    // Convert SVG to PNG for icon
    const iconPath = path.join(__dirname, '../assets/icon.png');
    
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(iconPath);
    
    console.log('✅ App icon generated successfully!');
    console.log(`📁 Saved to: ${iconPath}`);
    console.log(`📐 Size: ${size}x${size} pixels`);
    
    // Also generate splash screen (same design but with white background)
    // Splash screens are typically larger - use 2048x2048 for better quality
    const splashSize = 2048;
    const splashPadding = 400;
    const splashIconSize = splashSize - (splashPadding * 2);
    const splashCenterX = splashSize / 2;
    const splashCenterY = splashSize / 2;
    const splashBorderRadius = splashIconSize * 0.25;
    const splashFontSize = splashIconSize * 0.5;
    const splashLetterSpacing = splashIconSize * (-1.5 / 96);
    
    const splashSvg = `
      <svg width="${splashSize}" height="${splashSize}" xmlns="http://www.w3.org/2000/svg">
        <!-- Background (white for splash screen) -->
        <rect width="${splashSize}" height="${splashSize}" fill="#ffffff"/>
        
        <!-- Main square icon with rounded corners -->
        <rect 
          x="${splashPadding}" 
          y="${splashPadding}" 
          width="${splashIconSize}" 
          height="${splashIconSize}" 
          rx="${splashBorderRadius}" 
          ry="${splashBorderRadius}" 
          fill="#b38f5b"
        />
        
        <!-- Inner glow effect -->
        <rect 
          x="${splashPadding}" 
          y="${splashPadding}" 
          width="${splashIconSize}" 
          height="${splashIconSize}" 
          rx="${splashBorderRadius}" 
          ry="${splashBorderRadius}" 
          fill="rgba(255, 255, 255, 0.2)"
        />
        
        <!-- Main S letter - perfectly centered -->
        <text 
          x="${splashCenterX}" 
          y="${splashCenterY}" 
          font-family="system-ui, -apple-system, sans-serif" 
          font-size="${splashFontSize}" 
          font-weight="800" 
          fill="#ffffff" 
          text-anchor="middle" 
          dominant-baseline="central"
          letter-spacing="${splashLetterSpacing}"
        >S</text>
      </svg>
    `;
    
    const splashPath = path.join(__dirname, '../assets/splash.png');
    
    await sharp(Buffer.from(splashSvg))
      .resize(splashSize, splashSize)
      .png()
      .toFile(splashPath);
    
    console.log('✅ Splash screen generated successfully!');
    console.log(`📁 Saved to: ${splashPath}`);
    console.log(`📐 Size: ${splashSize}x${splashSize} pixels`);
    console.log('');
    console.log('🔄 Next steps:');
    console.log('1. Rebuild the app: npx expo prebuild --clean');
    console.log('2. Run on device: npx expo run:ios');
    console.log('3. The new icon and splash will appear after rebuilding');
    
  } catch (error) {
    console.error('❌ Error generating icon:', error);
    process.exit(1);
  }
}

generateIcon();

