// Test script to verify environment variables
console.log('=== Environment Variable Test ===');

// Check client-side environment variables
const clientEnv = {
  finnhub: !!(process.env.NEXT_PUBLIC_FINNHUB_KEY || process.env.VITE_FINNHUB_KEY),
  fmp: !!(process.env.NEXT_PUBLIC_FMP_KEY || process.env.VITE_FMP_KEY),
  alphavantage: !!(process.env.NEXT_PUBLIC_ALPHAVANTAGE_KEY || process.env.VITE_ALPHAVANTAGE_KEY)
};

console.log('Client-side API Keys:');
console.log('  Finnhub:', clientEnv.finnhub ? '✅ Available' : '❌ Missing');
console.log('  FMP:', clientEnv.fmp ? '✅ Available' : '❌ Missing');
console.log('  Alpha Vantage:', clientEnv.alphavantage ? '✅ Available' : '❌ Missing');

// Test WebSocket URL construction
if (clientEnv.finnhub) {
  const apiKey = process.env.NEXT_PUBLIC_FINNHUB_KEY || process.env.VITE_FINNHUB_KEY;
  const wsUrl = `wss://ws.finnhub.io?token=${apiKey}`;
  console.log('  WebSocket URL:', wsUrl.substring(0, 30) + '...');
} else {
  console.log('  WebSocket URL: ❌ Cannot construct (no API key)');
}

console.log('\n=== Test Complete ===');
