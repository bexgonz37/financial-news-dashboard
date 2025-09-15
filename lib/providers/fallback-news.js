// Fallback news provider - NO FALLBACK DATA, live data only
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
    // NO FALLBACK DATA - Return empty array if external APIs fail
    console.log('FallbackNewsProvider: No external APIs available, returning empty news array');
    return Promise.resolve([]);
  }
}