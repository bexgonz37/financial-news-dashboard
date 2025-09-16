// Build script to inject environment variables for client-side use
const fs = require('fs');
const path = require('path');

// Read environment variables
const envVars = {
  FINNHUB_KEY: process.env.FINNHUB_KEY || '',
  FMP_KEY: process.env.FMP_KEY || '',
  ALPHAVANTAGE_KEY: process.env.ALPHAVANTAGE_KEY || ''
};

// Create environment injection script
const envScript = `
// Environment variables injected at build time
window.ENV = {
  FINNHUB_KEY: '${envVars.FINNHUB_KEY}',
  FMP_KEY: '${envVars.FMP_KEY}',
  ALPHAVANTAGE_KEY: '${envVars.ALPHAVANTAGE_KEY}'
};

// Make available to modules
if (typeof process !== 'undefined') {
  process.env.FINNHUB_KEY = '${envVars.FINNHUB_KEY}';
  process.env.FMP_KEY = '${envVars.FMP_KEY}';
  process.env.ALPHAVANTAGE_KEY = '${envVars.ALPHAVANTAGE_KEY}';
}

if (typeof import.meta !== 'undefined' && import.meta.env) {
  import.meta.env.VITE_FINNHUB_KEY = '${envVars.FINNHUB_KEY}';
  import.meta.env.VITE_FMP_KEY = '${envVars.FMP_KEY}';
  import.meta.env.VITE_ALPHAVANTAGE_KEY = '${envVars.ALPHAVANTAGE_KEY}';
}
`;

// Write to public directory
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

fs.writeFileSync(path.join(publicDir, 'env.js'), envScript);

console.log('Environment variables injected for client-side use');
console.log('Keys available:', Object.keys(envVars).filter(key => envVars[key]));
