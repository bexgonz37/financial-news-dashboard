// Verification test for environment variables and functionality
console.log('=== DASHBOARD VERIFICATION TEST ===');

// Test 1: Environment Variables
async function testEnvironmentVariables() {
  console.log('1. Testing Environment Variables...');
  try {
    const response = await fetch('/api/env');
    const data = await response.json();
    
    if (data.success) {
      const keys = {
        finnhub: !!data.data.FINNHUB_KEY,
        fmp: !!data.data.FMP_KEY,
        alphavantage: !!data.data.ALPHAVANTAGE_KEY
      };
      console.log('   Environment Variables:', keys);
      return keys;
    } else {
      console.error('   Failed to get environment variables:', data.error);
      return { finnhub: false, fmp: false, alphavantage: false };
    }
  } catch (error) {
    console.error('   Environment variable test failed:', error);
    return { finnhub: false, fmp: false, alphavantage: false };
  }
}

// Test 2: News API
async function testNewsAPI() {
  console.log('2. Testing News API...');
  try {
    const response = await fetch('/api/news?limit=5');
    const data = await response.json();
    
    if (data.success && data.data.news) {
      const count = data.data.news.length;
      console.log(`   News API: ${count} items (status: ${response.status})`);
      return { success: true, count, status: response.status };
    } else {
      console.error('   News API failed:', data.error || 'No data');
      return { success: false, count: 0, status: response.status };
    }
  } catch (error) {
    console.error('   News API test failed:', error);
    return { success: false, count: 0, status: 'error' };
  }
}

// Test 3: WebSocket Connection
async function testWebSocket() {
  console.log('3. Testing WebSocket Connection...');
  try {
    // Import WebSocket quotes
    const { wsQuotes } = await import('./src/ws/quotes.js');
    
    // Set up connection test
    let connected = false;
    let error = null;
    
    const originalOnOpen = wsQuotes.ws?.onopen;
    const originalOnError = wsQuotes.ws?.onerror;
    
    wsQuotes.ws = {
      onopen: () => { connected = true; },
      onerror: (err) => { error = err; },
      onclose: () => {},
      onmessage: () => {}
    };
    
    // Try to connect
    await wsQuotes.connect();
    
    // Wait a bit for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`   WebSocket: ${connected ? 'CONNECTED' : 'FAILED'} ${error ? `(${error})` : ''}`);
    return { connected, error: error?.message || null };
  } catch (error) {
    console.error('   WebSocket test failed:', error);
    return { connected: false, error: error.message };
  }
}

// Run all tests
async function runAllTests() {
  const envTest = await testEnvironmentVariables();
  const newsTest = await testNewsAPI();
  const wsTest = await testWebSocket();
  
  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Framework: Vanilla JS on Vercel`);
  console.log(`Config: Environment variables via /api/env`);
  console.log(`Environment Variables: ${JSON.stringify(envTest)}`);
  console.log(`News API: ${newsTest.success ? 'SUCCESS' : 'FAILED'} (${newsTest.count} items, status ${newsTest.status})`);
  console.log(`WebSocket: ${wsTest.connected ? 'CONNECTED' : 'FAILED'} ${wsTest.error ? `(${wsTest.error})` : ''}`);
  
  const overallSuccess = envTest.finnhub && newsTest.success && newsTest.count > 0;
  console.log(`Overall: ${overallSuccess ? 'SUCCESS' : 'FAILED'}`);
  
  return {
    framework: 'Vanilla JS on Vercel',
    config: 'Environment variables via /api/env',
    envTest,
    newsTest,
    wsTest,
    success: overallSuccess
  };
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests };
} else {
  // Run if called directly
  runAllTests();
}
