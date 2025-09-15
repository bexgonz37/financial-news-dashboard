// Fallback quote provider for when external APIs fail
export class FallbackQuotesProvider {
  constructor() {
    this.name = 'FallbackQuotes';
  }

  async getQuotes(symbols) {
    // Sample stock data for major tickers
    const sampleStocks = {
      'AAPL': { name: 'Apple Inc.', price: 175.43, change: 2.15, changePercent: 1.24, volume: 45000000, marketCap: 2800000000000, pe: 28.5, sector: 'Technology' },
      'MSFT': { name: 'Microsoft Corporation', price: 378.85, change: -1.25, changePercent: -0.33, volume: 32000000, marketCap: 2800000000000, pe: 32.1, sector: 'Technology' },
      'GOOGL': { name: 'Alphabet Inc.', price: 142.56, change: 3.42, changePercent: 2.46, volume: 28000000, marketCap: 1800000000000, pe: 25.8, sector: 'Communication Services' },
      'AMZN': { name: 'Amazon.com Inc.', price: 155.23, change: -0.87, changePercent: -0.56, volume: 38000000, marketCap: 1600000000000, pe: 45.2, sector: 'Consumer Discretionary' },
      'TSLA': { name: 'Tesla Inc.', price: 248.50, change: 8.75, changePercent: 3.65, volume: 65000000, marketCap: 790000000000, pe: 65.3, sector: 'Consumer Discretionary' },
      'META': { name: 'Meta Platforms Inc.', price: 485.20, change: 12.30, changePercent: 2.60, volume: 18000000, marketCap: 1230000000000, pe: 24.7, sector: 'Communication Services' },
      'NVDA': { name: 'NVIDIA Corporation', price: 875.28, change: 25.45, changePercent: 2.99, volume: 42000000, marketCap: 2150000000000, pe: 68.9, sector: 'Technology' },
      'NFLX': { name: 'Netflix Inc.', price: 485.67, change: -3.21, changePercent: -0.66, volume: 15000000, marketCap: 215000000000, pe: 42.3, sector: 'Communication Services' },
      'AMD': { name: 'Advanced Micro Devices Inc.', price: 128.45, change: 4.12, changePercent: 3.31, volume: 55000000, marketCap: 205000000000, pe: 35.6, sector: 'Technology' },
      'INTC': { name: 'Intel Corporation', price: 42.18, change: -0.95, changePercent: -2.20, volume: 48000000, marketCap: 175000000000, pe: 15.2, sector: 'Technology' },
      'JPM': { name: 'JPMorgan Chase & Co.', price: 185.67, change: 1.23, changePercent: 0.67, volume: 12000000, marketCap: 540000000000, pe: 12.8, sector: 'Financials' },
      'JNJ': { name: 'Johnson & Johnson', price: 158.92, change: -0.45, changePercent: -0.28, volume: 8000000, marketCap: 420000000000, pe: 15.6, sector: 'Healthcare' },
      'V': { name: 'Visa Inc.', price: 275.34, change: 2.87, changePercent: 1.05, volume: 6000000, marketCap: 580000000000, pe: 32.4, sector: 'Financials' },
      'PG': { name: 'Procter & Gamble Co.', price: 156.78, change: 0.89, changePercent: 0.57, volume: 7000000, marketCap: 370000000000, pe: 24.8, sector: 'Consumer Staples' },
      'UNH': { name: 'UnitedHealth Group Inc.', price: 542.15, change: 8.45, changePercent: 1.58, volume: 3000000, marketCap: 510000000000, pe: 25.3, sector: 'Healthcare' },
      'HD': { name: 'Home Depot Inc.', price: 342.67, change: -2.34, changePercent: -0.68, volume: 4000000, marketCap: 350000000000, pe: 22.1, sector: 'Consumer Discretionary' },
      'MA': { name: 'Mastercard Inc.', price: 445.23, change: 5.67, changePercent: 1.29, volume: 2500000, marketCap: 420000000000, pe: 35.7, sector: 'Financials' },
      'DIS': { name: 'Walt Disney Co.', price: 95.45, change: 1.23, changePercent: 1.31, volume: 12000000, marketCap: 175000000000, pe: 18.9, sector: 'Communication Services' },
      'PYPL': { name: 'PayPal Holdings Inc.', price: 62.34, change: -1.45, changePercent: -2.27, volume: 15000000, marketCap: 68000000000, pe: 15.2, sector: 'Financials' },
      'ADBE': { name: 'Adobe Inc.', price: 485.67, change: 12.45, changePercent: 2.63, volume: 8000000, marketCap: 220000000000, pe: 28.4, sector: 'Technology' }
    };

    const quotes = [];
    
    for (const symbol of symbols) {
      const stock = sampleStocks[symbol];
      if (stock) {
        // Add some randomness to make it look more realistic
        const randomFactor = 0.98 + Math.random() * 0.04; // ±2% variation
        const price = stock.price * randomFactor;
        const change = price - stock.price;
        const changePercent = (change / stock.price) * 100;
        
        quotes.push({
          symbol: symbol,
          name: stock.name,
          price: parseFloat(price.toFixed(2)),
          change: parseFloat(change.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2)),
          volume: Math.floor(stock.volume * (0.8 + Math.random() * 0.4)), // ±20% volume variation
          averageDailyVolume3Month: stock.volume,
          relativeVolume: 0.8 + Math.random() * 0.4, // 0.8 to 1.2
          marketState: 'REGULAR',
          marketCap: stock.marketCap,
          pe: stock.pe,
          high52Week: price * (1.1 + Math.random() * 0.2), // 10-30% above current price
          low52Week: price * (0.7 + Math.random() * 0.2), // 10-30% below current price
          lastUpdate: new Date().toISOString(),
          provider: 'fallback',
          sector: stock.sector
        });
      }
    }
    
    return quotes;
  }
}
