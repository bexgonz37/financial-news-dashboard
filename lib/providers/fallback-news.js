// Fallback news provider for when external APIs fail
export class FallbackNewsProvider {
  constructor() {
    this.name = 'FallbackNews';
  }

  async getNews(params) {
    // Return some sample financial news when external APIs fail
    const sampleNews = [
      {
        title: "Market Update: Major Indices Show Mixed Signals",
        summary: "The S&P 500 and NASDAQ showed divergent performance today as investors weighed economic data against corporate earnings reports.",
        url: "https://example.com/market-update",
        publishedAt: new Date().toISOString(),
        source: "Financial News",
        category: "Market Analysis",
        tickers: ["SPY", "QQQ", "DIA"]
      },
      {
        title: "Tech Sector Faces Headwinds Amid Regulatory Concerns",
        summary: "Technology stocks experienced volatility as regulatory discussions continue to impact investor sentiment across the sector.",
        url: "https://example.com/tech-regulation",
        publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        source: "Tech Finance",
        category: "Technology",
        tickers: ["AAPL", "MSFT", "GOOGL", "META"]
      },
      {
        title: "Energy Sector Rallies on Oil Price Recovery",
        summary: "Energy companies saw significant gains as oil prices rebounded following supply concerns and geopolitical developments.",
        url: "https://example.com/energy-rally",
        publishedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        source: "Energy Daily",
        category: "Energy",
        tickers: ["XOM", "CVX", "COP", "EOG"]
      },
      {
        title: "Healthcare Stocks Respond to FDA Approvals",
        summary: "Several healthcare companies saw positive movement following recent FDA approval announcements for new treatments.",
        url: "https://example.com/healthcare-fda",
        publishedAt: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
        source: "Healthcare Weekly",
        category: "Healthcare",
        tickers: ["JNJ", "PFE", "ABBV", "LLY"]
      },
      {
        title: "Financial Services Sector Mixed on Interest Rate Outlook",
        summary: "Banking and financial services stocks showed mixed performance as investors assess the Federal Reserve's monetary policy stance.",
        url: "https://example.com/financial-rates",
        publishedAt: new Date(Date.now() - 14400000).toISOString(), // 4 hours ago
        source: "Financial Times",
        category: "Financial Services",
        tickers: ["JPM", "BAC", "WFC", "GS"]
      }
    ];

    // Filter by ticker if specified
    let filteredNews = sampleNews;
    if (params.ticker) {
      filteredNews = sampleNews.filter(item => 
        item.tickers && item.tickers.includes(params.ticker.toUpperCase())
      );
    }

    // Filter by search term if specified
    if (params.search) {
      const searchTerm = params.search.toLowerCase();
      filteredNews = filteredNews.filter(item => 
        item.title.toLowerCase().includes(searchTerm) ||
        item.summary.toLowerCase().includes(searchTerm)
      );
    }

    // Limit results
    const limit = params.limit || 10;
    return filteredNews.slice(0, limit);
  }
}
