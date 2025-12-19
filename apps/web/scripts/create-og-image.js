#!/usr/bin/env node

/**
 * Script to create a 1200x630 Open Graph image from logo.png
 * 
 * Requirements:
 * - ImageMagick: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)
 * - Or use online tools: https://www.canva.com/ or https://og-image.vercel.app/
 * 
 * Usage:
 * node scripts/create-og-image.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, '../public/logo.png');
const outputPath = path.join(__dirname, '../public/og-image.png');

console.log('Creating Open Graph image...');
console.log('Logo:', logoPath);
console.log('Output:', outputPath);

// Check if ImageMagick is available
try {
  execSync('which convert', { stdio: 'ignore' });
  console.log('✓ ImageMagick found');
  
  // Create 1200x630 image with logo centered on dark gradient background
  // This creates a nice dark background with the logo centered
  const command = `convert -size 1200x630 xc:'#1a1a1a' \
    \\( "${logoPath}" -resize 400x400 -gravity center \\) \
    -composite \
    -gravity center \
    -pointsize 48 -fill white -annotate +0+200 'StoryStack' \
    -pointsize 24 -fill '#a0a0a0' -annotate +0+250 'storystackstudios.com' \
    "${outputPath}"`;
  
  execSync(command, { stdio: 'inherit' });
  console.log('✓ Open Graph image created successfully!');
  console.log(`✓ Saved to: ${outputPath}`);
} catch (error) {
  console.error('✗ ImageMagick not found or command failed');
  console.error('\nAlternative options:');
  console.log('1. Install ImageMagick:');
  console.log('   macOS: brew install imagemagick');
  console.log('   Linux: sudo apt-get install imagemagick');
  console.log('\n2. Use online tools:');
  console.log('   - https://www.canva.com/ (search for "Open Graph" templates)');
  console.log('   - https://og-image.vercel.app/');
  console.log('   - https://www.bannerbear.com/tools/open-graph-image-generator/');
  console.log('\n3. Manual creation:');
  console.log('   - Size: 1200x630 pixels');
  console.log('   - Format: PNG');
  console.log('   - Save as: public/og-image.png');
  console.log('   - Include: Logo, "StoryStack" text, "storystackstudios.com"');
  process.exit(1);
}

