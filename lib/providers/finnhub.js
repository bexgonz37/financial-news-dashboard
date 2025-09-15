import { BaseProvider } from './base.js';

export class FinnhubProvider extends BaseProvider {
  constructor(apiKey) {
    super('Finnhub', apiKey, parseInt(process.env.FINNHUB_RPM) || 60);
    this.baseUrl = 'https://finnhub.io/api/v1';
  }

  async getQuotes(symbols) {
    if (!this.apiKey) return [];
    
    const quotes = [];
    
    // Finnhub doesn't have batch quotes, so we need to make individual calls
    for (const symbol of symbols.slice(0, 10)) { // Limit to 10 to avoid rate limits
      try {
        const url = `${this.baseUrl}/quote?symbol=${symbol}&token=${this.apiKey}`;
        const response = await this.makeRequest(url);
        const data = await response.json();
        
        if (data.c && data.c > 0) { // Valid quote
          quotes.push({
            symbol: symbol,
            name: symbol,
            price: parseFloat(data.c) || 0,
            change: parseFloat(data.d) || 0,
            changePercent: parseFloat(data.dp) || 0,
            volume: 0, // Finnhub quote doesn't include volume
            averageDailyVolume3Month: 0,
            relativeVolume: 1,
            marketState: 'REGULAR',
            marketCap: null,
            pe: null,
            high52Week: parseFloat(data.h) || null,
            low52Week: parseFloat(data.l) || null,
            lastUpdate: new Date().toISOString(),
            provider: 'finnhub'
          });
        }
      } catch (error) {
        console.warn(`Finnhub getQuote failed for ${symbol}:`, error.message);
      }
    }
    
    return quotes;
  }

  async getNews(params = {}) {
    if (!this.apiKey) return [];
    
    const { limit = 100, ticker = null } = params;
    const url = `${this.baseUrl}/news?category=general&token=${this.apiKey}`;
    
    try {
      const response = await this.makeRequest(url);
      const data = await response.json();
      
      if (!Array.isArray(data)) return [];
      
      return data.slice(0, limit).map(item => ({
        id: `fh_${item.id || Date.now()}`,
        title: item.headline || '',
        summary: item.summary || '',
        source: item.source || 'Finnhub',
        publishedAt: new Date(item.datetime * 1000).toISOString(),
        url: item.url || '',
        ticker: ticker,
        category: 'general'
      }));
    } catch (error) {
      console.warn(`Finnhub getNews failed:`, error.message);
      return [];
    }
  }

  async getOHLC(symbol, interval = '5', limit = 100) {
    if (!this.apiKey) return [];
    
    const to = Math.floor(Date.now() / 1000);
    const from = to - (limit * parseInt(interval) * 60); // Approximate time range
    
    const url = `${this.baseUrl}/stock/candle?symbol=${symbol}&resolution=${interval}&from=${from}&to=${to}&token=${this.apiKey}`;
    
    try {
      const response = await this.makeRequest(url);
      const data = await response.json();
      
      if (data.s !== 'ok' || !Array.isArray(data.c)) return [];
      
      const candles = [];
      for (let i = 0; i < data.c.length; i++) {
        candles.push({
          t: data.t[i] * 1000, // Convert to milliseconds
          o: parseFloat(data.o[i]) || 0,
          h: parseFloat(data.h[i]) || 0,
          l: parseFloat(data.l[i]) || 0,
          c: parseFloat(data.c[i]) || 0,
          v: parseInt(data.v[i]) || 0
        });
      }
      
      return candles.slice(0, limit);
    } catch (error) {
      console.warn(`Finnhub getOHLC failed:`, error.message);
      return [];
    }
  }
}
