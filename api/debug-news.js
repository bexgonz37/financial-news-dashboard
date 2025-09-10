// Debug News API - Test URL Generation
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log('=== DEBUG NEWS API - TESTING URL GENERATION ===');
    
    // Test URL generation for different sources
    const testSources = ['Yahoo Finance', 'Financial Times', 'Reuters', 'Bloomberg', 'MarketWatch'];
    const testSymbol = 'AAPL';
    
    const testUrls = testSources.map(source => {
      const url = generateNewsUrl(source, testSymbol, 'Test Title');
      return { source, symbol: testSymbol, url };
    });
    
    console.log('Test URLs generated:', testUrls);
    
    return res.status(200).json({
      success: true,
      message: 'Debug news API test',
      testUrls: testUrls,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug news error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to debug news API',
      message: error.message
    });
  }
}

function generateNewsUrl(source, symbol, title) {
  // Generate URLs that go to real, working pages with actual content
  const workingUrls = {
    'Financial Times': `https://www.ft.com/companies/${symbol.toLowerCase()}`,
    'Reuters': `https://www.reuters.com/companies/${symbol.toLowerCase()}`,
    'Bloomberg': `https://www.bloomberg.com/quote/${symbol}:US`,
    'MarketWatch': `https://www.marketwatch.com/investing/stock/${symbol.toLowerCase()}`,
    'CNBC': `https://www.cnbc.com/quotes/${symbol}`,
    'Yahoo Finance': `https://finance.yahoo.com/quote/${symbol}/news`,
    'Seeking Alpha': `https://seekingalpha.com/symbol/${symbol}/news`,
    'InvestorPlace': `https://investorplace.com/stock-lists/${symbol.toLowerCase()}/`,
    'Motley Fool': `https://www.fool.com/quote/${symbol.toLowerCase()}/`,
    'Benzinga': `https://www.benzinga.com/quote/${symbol}`,
    'Zacks': `https://www.zacks.com/stock/quote/${symbol}`,
    'The Street': `https://www.thestreet.com/quote/${symbol}`,
    'Alpha Vantage': `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}`,
    'Financial Modeling Prep': `https://financialmodelingprep.com/company/${symbol}`,
    'Finnhub': `https://finnhub.io/api/v1/company-news?symbol=${symbol}`
  };
  
  const url = workingUrls[source] || `https://finance.yahoo.com/quote/${symbol}/news`;
  console.log(`Generated working URL for ${source} ${symbol}: ${url}`);
  return url;
}
