#!/usr/bin/env node

/**
 * Validate CI/CD setup locally
 * This script runs the same checks that the CI pipeline will run
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runCommand(command, description) {
  console.log(`\n🔍 ${description}...`);
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    console.log(`✅ ${description} - PASSED`);
    return { success: true, output };
  } catch (error) {
    console.log(`❌ ${description} - FAILED`);
    console.log(`Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function validateCISetup() {
  console.log('🚀 Validating CI/CD Setup for CloudAdmin\n');

  const checks = [
    {
      command: 'npm run build',
      description: 'Application build',
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    const result = runCommand(check.command, check.description);
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('\n📊 Validation Summary:');
  console.log(`✅ Required checks passed: ${passed}`);
  console.log(`❌ Required checks failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 All required CI checks passed! Your code is ready for the pipeline.');
  } else {
    console.log('\n❌ Required CI checks failed. Please fix the issues before pushing.');
    process.exit(1);
  }
}

function checkRequiredFiles() {
  console.log('📁 Checking required files...');

  const requiredFiles = [
    '.github/workflows/ci.yml',
    '.github/workflows/build-and-deploy.yml',
    '.github/workflows/pr-validation.yml',
  ];

  let allFilesExist = true;

  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - MISSING`);
      allFilesExist = false;
    }
  }

  if (!allFilesExist) {
    console.log('\n⚠️  Some required files are missing. Please ensure all CI files are in place.');
    process.exit(1);
  }

  console.log('✅ All required files present');
}

try {
  checkRequiredFiles();
  validateCISetup();
} catch (error) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}
