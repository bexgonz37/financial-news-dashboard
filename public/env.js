
// Environment variables injected at build time
window.ENV = {
  FINNHUB_KEY: '',
  FMP_KEY: '',
  ALPHAVANTAGE_KEY: ''
};

// Make available to modules
if (typeof process !== 'undefined') {
  process.env.FINNHUB_KEY = '';
  process.env.FMP_KEY = '';
  process.env.ALPHAVANTAGE_KEY = '';
}

if (typeof import.meta !== 'undefined' && import.meta.env) {
  import.meta.env.VITE_FINNHUB_KEY = '';
  import.meta.env.VITE_FMP_KEY = '';
  import.meta.env.VITE_ALPHAVANTAGE_KEY = '';
}
