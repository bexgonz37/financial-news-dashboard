import { BaseProvider } from './base.js';

export class FMPProvider extends BaseProvider {
  constructor(apiKey) {
    super('FMP', { rpm: parseInt(process.env.FMP_RPM) || 60 });
    this.apiKey = apiKey;
    this.baseUrl = 'https://financialmodelingprep.com/api/v3';
  }

  async getQuotes(symbols) {
    if (!this.apiKey) return [];
    
    const symbolsStr = symbols.slice(0, 100).join(','); // FMP batch limit
    const url = `${this.baseUrl}/quote/${symbolsStr}?apikey=${this.apiKey}`;
    
    try {
      const response = await this.makeRequest(url);
      const data = await response.json();
      
      if (!Array.isArray(data)) return [];
      
      return data.map(quote => ({
        symbol: quote.symbol,
        name: quote.name,
        price: parseFloat(quote.price) || 0,
        change: parseFloat(quote.change) || 0,
        changePercent: parseFloat(quote.changesPercentage) || 0,
        volume: parseInt(quote.volume) || 0,
        averageDailyVolume3Month: parseInt(quote.avgVolume) || 0,
        relativeVolume: quote.avgVolume ? (quote.volume / quote.avgVolume) : 1,
        marketState: 'REGULAR',
        marketCap: parseFloat(quote.marketCap) || null,
        pe: parseFloat(quote.pe) || null,
        high52Week: parseFloat(quote.yearHigh) || null,
        low52Week: parseFloat(quote.yearLow) || null,
        lastUpdate: new Date().toISOString(),
        provider: 'fmp'
      }));
    } catch (error) {
      console.warn(`FMP getQuotes failed:`, error.message);
      return [];
    }
  }

  async getNews(params = {}) {
    if (!this.apiKey) return [];
    
    const { limit = 100, ticker = null, search = null } = params;
    let url = `${this.baseUrl}/stock_news?limit=${Math.min(limit, 100)}&apikey=${this.apiKey}`;
    
    if (ticker) {
      url = `${this.baseUrl}/stock_news?tickers=${ticker}&limit=${Math.min(limit, 100)}&apikey=${this.apiKey}`;
    }
    
    try {
      const response = await this.makeRequest(url);
      const data = await response.json();
      
      if (!Array.isArray(data)) return [];
      
      return data.map(item => ({
        id: `fmp_${item.id || Date.now()}`,
        title: item.title || '',
        summary: item.text || '',
        source: item.site || 'FMP',
        publishedAt: new Date(item.publishedDate).toISOString(),
        url: item.url || '',
        ticker: item.symbol || null,
        category: item.category || null
      }));
    } catch (error) {
      console.warn(`FMP getNews failed:`, error.message);
      return [];
    }
  }

  async getOHLC(symbol, interval = '5min', limit = 100) {
    if (!this.apiKey) return [];
    
    const url = `${this.baseUrl}/historical-chart/${interval}/${symbol}?apikey=${this.apiKey}`;
    
    try {
      const response = await this.makeRequest(url);
      const data = await response.json();
      
      if (!Array.isArray(data)) return [];
      
      return data.slice(0, limit).map(candle => ({
        t: new Date(candle.date).getTime(),
        o: parseFloat(candle.open) || 0,
        h: parseFloat(candle.high) || 0,
        l: parseFloat(candle.low) || 0,
        c: parseFloat(candle.close) || 0,
        v: parseInt(candle.volume) || 0
      }));
    } catch (error) {
      console.warn(`FMP getOHLC failed:`, error.message);
      return [];
    }
  }
}
