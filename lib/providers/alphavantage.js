import { BaseProvider } from './base.js';

export class AlphaVantageProvider extends BaseProvider {
  constructor(apiKey) {
    super('AlphaVantage', { rpm: parseInt(process.env.AV_RPM) || 5 }); // Very low for free tier
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.alphavantage.co/query';
  }

  async getQuotes(symbols) {
    if (!this.apiKey) return [];
    
    const quotes = [];
    
    // Alpha Vantage doesn't have batch quotes, so we need to make individual calls
    for (const symbol of symbols.slice(0, 2)) { // Very limited due to rate limits
      try {
        const url = `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`;
        const response = await this.makeRequest(url);
        const data = await response.json();
        
        const quote = data['Global Quote'];
        if (quote && quote['05. price']) {
          quotes.push({
            symbol: symbol,
            name: symbol,
            price: parseFloat(quote['05. price']) || 0,
            change: parseFloat(quote['09. change']) || 0,
            changePercent: parseFloat((quote['10. change percent'] || '0%').replace('%', '')) || 0,
            volume: parseInt(quote['06. volume']) || 0,
            averageDailyVolume3Month: 0,
            relativeVolume: 1,
            marketState: 'REGULAR',
            marketCap: null,
            pe: null,
            high52Week: null,
            low52Week: null,
            lastUpdate: new Date().toISOString(),
            provider: 'alphavantage'
          });
        }
      } catch (error) {
        console.warn(`Alpha Vantage getQuote failed for ${symbol}:`, error.message);
      }
    }
    
    return quotes;
  }

  async getNews(params = {}) {
    if (!this.apiKey) return [];
    
    const { limit = 100 } = params;
    const url = `${this.baseUrl}?function=NEWS_SENTIMENT&apikey=${this.apiKey}&limit=${Math.min(limit, 100)}`;
    
    try {
      const response = await this.makeRequest(url);
      const data = await response.json();
      
      if (!data.feed || !Array.isArray(data.feed)) return [];
      
      return data.feed.slice(0, limit).map(item => ({
        id: `av_${item.uuid || Date.now()}`,
        title: item.title || '',
        summary: item.summary || '',
        source: item.source || 'Alpha Vantage',
        publishedAt: new Date(item.time_published).toISOString(),
        url: item.url || '',
        ticker: item.ticker_sentiment?.[0]?.ticker || null,
        category: 'general'
      }));
    } catch (error) {
      console.warn(`Alpha Vantage getNews failed:`, error.message);
      return [];
    }
  }

  async getOHLC(symbol, interval = '5min', limit = 100) {
    if (!this.apiKey) return [];
    
    const functionName = interval === '1min' ? 'TIME_SERIES_INTRADAY' : 'TIME_SERIES_DAILY';
    const intervalParam = interval === '1min' ? '&interval=1min' : '';
    
    const url = `${this.baseUrl}?function=${functionName}&symbol=${symbol}${intervalParam}&apikey=${this.apiKey}`;
    
    try {
      const response = await this.makeRequest(url);
      const data = await response.json();
      
      const timeSeries = data[interval === '1min' ? 'Time Series (1min)' : 'Time Series (Daily)'];
      if (!timeSeries) return [];
      
      const candles = [];
      const entries = Object.entries(timeSeries).slice(0, limit);
      
      for (const [timestamp, values] of entries) {
        candles.push({
          t: new Date(timestamp).getTime(),
          o: parseFloat(values['1. open']) || 0,
          h: parseFloat(values['2. high']) || 0,
          l: parseFloat(values['3. low']) || 0,
          c: parseFloat(values['4. close']) || 0,
          v: parseInt(values['5. volume']) || 0
        });
      }
      
      return candles.reverse(); // Most recent first
    } catch (error) {
      console.warn(`Alpha Vantage getOHLC failed:`, error.message);
      return [];
    }
  }
}
