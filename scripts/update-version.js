#!/usr/bin/env node

/**
 * Version Update Script
 * 
 * Updates version numbers consistently across all configuration files:
 * - app.json: version, ios.buildNumber, android.versionCode
 * - package.json: version
 * 
 * Usage:
 *   node scripts/update-version.js [buildNumber]
 * 
 * If buildNumber is not provided, it will increment the current build number.
 */

const fs = require('fs');
const path = require('path');

const APP_JSON_PATH = path.join(__dirname, '..', 'app.json');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

function readJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function incrementVersion(version) {
  const parts = version.split('.');
  const patch = parseInt(parts[2] || 0) + 1;
  return `${parts[0]}.${parts[1]}.${patch}`;
}

function main() {
  const buildNumberArg = process.argv[2];
  const incrementAppVersion = process.argv.includes('--increment-app-version');
  
  // Read current configs
  const appJson = readJson(APP_JSON_PATH);
  const packageJson = readJson(PACKAGE_JSON_PATH);
  
  // Determine new build number
  const currentIOSBuild = parseInt(appJson.expo.ios.buildNumber);
  const currentAndroidBuild = appJson.expo.android.versionCode;
  const newBuildNumber = buildNumberArg ? parseInt(buildNumberArg) : Math.max(currentIOSBuild, currentAndroidBuild) + 1;
  
  // Update build numbers in app.json
  appJson.expo.ios.buildNumber = newBuildNumber.toString();
  appJson.expo.android.versionCode = newBuildNumber;
  
  // Optionally increment app version (for major releases)
  if (incrementAppVersion) {
    appJson.expo.version = incrementVersion(appJson.expo.version);
    packageJson.version = appJson.expo.version;
  } else {
    // Always sync package.json version with app.json version
    packageJson.version = appJson.expo.version;
  }
  
  // Write updated configs
  writeJson(APP_JSON_PATH, appJson);
  writeJson(PACKAGE_JSON_PATH, packageJson);
  
  console.log('✅ Version numbers updated:');
  console.log(`   App version: ${appJson.expo.version}`);
  console.log(`   iOS build number: ${appJson.expo.ios.buildNumber}`);
  console.log(`   Android version code: ${appJson.expo.android.versionCode}`);
  console.log(`   Package version: ${packageJson.version}`);
}

main();

