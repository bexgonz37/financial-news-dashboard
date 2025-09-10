// Simple Test API - Test Everything
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log('=== SIMPLE TEST API ===');
    
    // Test URL generation
    const testUrls = {
      'Yahoo Finance': 'https://finance.yahoo.com/quote/AAPL/news',
      'Bloomberg': 'https://www.bloomberg.com/quote/AAPL:US',
      'MarketWatch': 'https://www.marketwatch.com/investing/stock/aapl',
      'CNBC': 'https://www.cnbc.com/quotes/AAPL'
    };
    
    // Test news data
    const testNews = [
      {
        id: 'test-1',
        title: 'Apple Inc. (AAPL) Reports Strong Q3 Earnings',
        summary: 'Apple Inc. reported strong quarterly earnings with revenue up 15% year-over-year.',
        url: testUrls['Yahoo Finance'],
        source: 'Yahoo Finance',
        publishedAt: new Date().toISOString(),
        ticker: 'AAPL',
        tickers: ['AAPL']
      },
      {
        id: 'test-2',
        title: 'Microsoft Corp. (MSFT) Announces New AI Partnership',
        summary: 'Microsoft Corp. announced a major partnership with OpenAI.',
        url: testUrls['Bloomberg'],
        source: 'Bloomberg',
        publishedAt: new Date().toISOString(),
        ticker: 'MSFT',
        tickers: ['MSFT']
      }
    ];
    
    // Test scanner data
    const testScanner = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 180.50,
        change: 2.30,
        changePercent: 1.29,
        volume: 50000000,
        marketCap: '3000000000000M',
        sector: 'Technology',
        session: 'RTH',
        marketStatus: 'Live',
        dataAge: 'Live',
        isNewListing: false,
        tickerChanged: false,
        aiScore: 8,
        score: 15.5,
        lastUpdated: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        isLive: true
      }
    ];
    
    return res.status(200).json({
      success: true,
      message: 'Simple test API working',
      testUrls: testUrls,
      testNews: testNews,
      testScanner: testScanner,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Simple test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message
    });
  }
}
