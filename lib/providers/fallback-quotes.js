// Fallback quote provider - NO FALLBACK DATA, live data only
export class FallbackQuotesProvider {
  constructor() {
    this.name = 'FallbackQuotes';
  }

  // Add missing methods to prevent errors
  async getNews(params) {
    return []; // Quotes provider doesn't provide news
  }

  async getOHLC(symbol, interval, limit) {
    // NO FALLBACK DATA - Return empty array if external APIs fail
    console.log('FallbackQuotesProvider: No external APIs available, returning empty OHLC array');
    return Promise.resolve([]);
  }

  async getQuotes(symbols) {
    // NO FALLBACK DATA - Return empty array if external APIs fail
    console.log('FallbackQuotesProvider: No external APIs available, returning empty quotes array');
    return Promise.resolve([]);
  }
}