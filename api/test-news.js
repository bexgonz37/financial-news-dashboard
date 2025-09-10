// Test News API - Simple test to see what's happening
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log('=== TESTING NEWS API ===');
    console.log('API Keys check:', {
      ALPHAVANTAGE_KEY: process.env.ALPHAVANTAGE_KEY ? 'SET' : 'MISSING',
      FMP_KEY: process.env.FMP_KEY ? 'SET' : 'MISSING',
      FINNHUB_KEY: process.env.FINNHUB_KEY ? 'SET' : 'MISSING'
    });

    // Test Yahoo Finance first
    console.log('Testing Yahoo Finance...');
    try {
      const response = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=AAPL%20stock%20news&quotesCount=0&newsCount=5&_t=${Date.now()}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Yahoo Finance response:', JSON.stringify(data, null, 2));
        
        if (data.news && data.news.length > 0) {
          const news = data.news.map((item, index) => ({
            id: `test_yahoo_${index}`,
            title: item.title || 'No title',
            summary: item.summary || 'No summary available',
            url: item.link || '#',
            source: 'Yahoo Finance',
            publishedAt: new Date(item.providerPublishTime * 1000).toISOString(),
            ticker: 'AAPL', // Hardcoded for test
            tickers: ['AAPL'],
            sentimentScore: 0.5,
            relevanceScore: 0.8
          }));
          
          return res.status(200).json({
            success: true,
            data: {
              news: news,
              sources: ['yahoo'],
              total: news.length,
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    } catch (error) {
      console.error('Yahoo Finance test error:', error.message);
    }

    // If Yahoo Finance fails, return test data
    const testNews = [{
      id: 'test_1',
      title: 'Apple Inc. (AAPL) Reports Strong Q3 Earnings',
      summary: 'Apple Inc. reported strong quarterly earnings with revenue up 15% year-over-year.',
      url: 'https://finance.yahoo.com/quote/AAPL/news',
      source: 'Test Source',
      publishedAt: new Date().toISOString(),
      ticker: 'AAPL',
      tickers: ['AAPL'],
      sentimentScore: 0.7,
      relevanceScore: 0.9
    }];

    return res.status(200).json({
      success: true,
      data: {
        news: testNews,
        sources: ['test'],
        total: testNews.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Test news error:', error);
    return res.status(500).json({
      success: false,
      error: 'Test failed',
      data: { news: [], sources: [], total: 0, timestamp: new Date().toISOString() }
    });
  }
}
