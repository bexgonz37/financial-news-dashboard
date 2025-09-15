// Fallback news provider for when external APIs fail
export class FallbackNewsProvider {
  constructor() {
    this.name = 'FallbackNews';
  }

  // Add missing methods to prevent errors
  async getQuotes(symbols) {
    return []; // News provider doesn't provide quotes
  }

  async getOHLC(symbol, interval, limit) {
    return []; // News provider doesn't provide OHLC
  }

  async getNews(params) {
    // Return some sample financial news when external APIs fail
    const sampleNews = [
      {
        title: "Apple Inc. Reports Strong Q4 Earnings with iPhone Sales Surge",
        summary: "Apple Inc. (AAPL) reported better-than-expected earnings with iPhone sales showing strong growth. The company's stock price rose 3% in after-hours trading.",
        url: "https://example.com/apple-earnings",
        publishedAt: new Date().toISOString(),
        source: "Financial News",
        category: "Earnings",
        tickers: ["AAPL"]
      },
      {
        title: "Microsoft Corporation Announces New Azure Cloud Services",
        summary: "Microsoft Corporation (MSFT) announced new Azure cloud services and Office 365 updates. The company's stock gained 2.5% following the announcement.",
        url: "https://example.com/microsoft-azure",
        publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        source: "Tech Finance",
        category: "Technology",
        tickers: ["MSFT"]
      },
      {
        title: "Tesla Inc. Reports Record Vehicle Deliveries in Q4",
        summary: "Tesla Inc. (TSLA) reported record vehicle deliveries with strong Model 3 and Model Y sales. Elon Musk's company saw 15% growth in deliveries.",
        url: "https://example.com/tesla-deliveries",
        publishedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        source: "Energy Daily",
        category: "Automotive",
        tickers: ["TSLA"]
      },
      {
        title: "Johnson & Johnson Reports Strong Pharmaceutical Sales",
        summary: "Johnson & Johnson (JNJ) reported strong pharmaceutical sales with new drug approvals. The healthcare giant's stock rose 1.8%.",
        url: "https://example.com/jnj-pharma",
        publishedAt: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
        source: "Healthcare Weekly",
        category: "Healthcare",
        tickers: ["JNJ"]
      },
      {
        title: "JPMorgan Chase Reports Strong Trading Revenue",
        summary: "JPMorgan Chase & Co. (JPM) reported strong trading revenue in Q4. The bank's stock gained 2.1% following the earnings report.",
        url: "https://example.com/jpm-trading",
        publishedAt: new Date(Date.now() - 14400000).toISOString(), // 4 hours ago
        source: "Financial Times",
        category: "Financial Services",
        tickers: ["JPM"]
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
