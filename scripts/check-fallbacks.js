#!/usr/bin/env node

// CI Guard: Check for fallback references in production code
const fs = require('fs');
const path = require('path');

const FORBIDDEN_TERMS = [
  'fallback',
  'mock',
  'sample',
  'expandedUniverse',
  'demo'
];

// Additional patterns to check for
const FORBIDDEN_PATTERNS = [
  /fallback/i,
  /mock/i,
  /sample/i,
  /expandedUniverse/i,
  /demo/i
];

const PRODUCTION_PATHS = [
  'api/',
  'lib/',
  'index.html'
];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];
  
  lines.forEach((line, index) => {
    // Skip comments and strings
    if (line.trim().startsWith('//') || 
        line.trim().startsWith('*') ||
        line.trim().startsWith('#') ||
        line.trim().startsWith('/*')) {
      return;
    }
    
    // Check for forbidden patterns (more specific)
    FORBIDDEN_PATTERNS.forEach(pattern => {
      if (pattern.test(line)) {
        // Skip if it's in a string literal or regex
        if (!line.includes('"') && !line.includes("'") && !line.includes('`') && !line.includes('/')) {
          violations.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            term: pattern.source
          });
        }
      }
    });
  });
  
  return violations;
}

function checkDirectory(dirPath) {
  const violations = [];
  
  try {
    const stat = fs.statSync(dirPath);
    if (stat.isFile()) {
      if (dirPath.endsWith('.js') || dirPath.endsWith('.html')) {
        return checkFile(dirPath);
      }
      return [];
    }
    
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const fullPath = path.join(dirPath, file);
      const fileStat = fs.statSync(fullPath);
      
      if (fileStat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        violations.push(...checkDirectory(fullPath));
      } else if (file.endsWith('.js') || file.endsWith('.html')) {
        violations.push(...checkFile(fullPath));
      }
    });
  } catch (error) {
    console.warn(`Warning: Could not check ${dirPath}: ${error.message}`);
  }
  
  return violations;
}

console.log('🔍 Checking for fallback references in production code...');

const allViolations = [];
PRODUCTION_PATHS.forEach(prodPath => {
  if (fs.existsSync(prodPath)) {
    allViolations.push(...checkDirectory(prodPath));
  }
});

if (allViolations.length > 0) {
  console.error('❌ FALLBACK REFERENCES FOUND:');
  allViolations.forEach(violation => {
    console.error(`  ${violation.file}:${violation.line} - Found "${violation.term}"`);
    console.error(`    ${violation.content}`);
  });
  console.error('\n🚫 Build failed: Remove all fallback references from production code');
  process.exit(1);
} else {
  console.log('✅ No fallback references found in production code');
  process.exit(0);
}
