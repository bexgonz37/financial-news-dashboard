// Comprehensive Symbol Master - Complete US-listed universe with search
import { unifiedProviderManager } from './unified-provider-manager.js';

class ComprehensiveSymbolMaster {
  constructor() {
    this.symbols = new Map(); // symbol -> symbol data
    this.aliases = new Map(); // normalized name -> [symbols]
    this.lastUpdate = null;
    this.updateInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.isUpdating = false;
    
    // Start initial load and schedule updates
    this.loadSymbols();
    setInterval(() => this.loadSymbols(), this.updateInterval);
  }

  async loadSymbols() {
    if (this.isUpdating) return;
    
    this.isUpdating = true;
    console.log('🔄 Loading comprehensive symbol master...');
    
    try {
      const symbols = await this.fetchSymbolsFromProviders();
      this.buildIndexes(symbols);
      this.lastUpdate = new Date();
      
      console.log(`✅ Symbol master loaded: ${symbols.length} symbols, ${this.aliases.size} aliases`);
    } catch (error) {
      console.error('❌ Failed to load symbol master:', error.message);
    } finally {
      this.isUpdating = false;
    }
  }

  async fetchSymbolsFromProviders() {
    const allSymbols = new Map();
    const errors = [];

    // Try FMP first
    try {
      const fmpSymbols = await this.fetchFMPSymbols();
      fmpSymbols.forEach(symbol => {
        allSymbols.set(symbol.symbol, { ...symbol, source: 'fmp' });
      });
      console.log(`📊 FMP: ${fmpSymbols.length} symbols`);
    } catch (error) {
      errors.push(`FMP: ${error.message}`);
    }

    // Try Finnhub
    try {
      const finnhubSymbols = await this.fetchFinnhubSymbols();
      finnhubSymbols.forEach(symbol => {
        if (allSymbols.has(symbol.symbol)) {
          // Merge data, prefer FMP for most fields
          const existing = allSymbols.get(symbol.symbol);
          allSymbols.set(symbol.symbol, {
            ...existing,
            ...symbol,
            source: 'fmp+finnhub'
          });
        } else {
          allSymbols.set(symbol.symbol, { ...symbol, source: 'finnhub' });
        }
      });
      console.log(`📊 Finnhub: ${finnhubSymbols.length} symbols`);
    } catch (error) {
      errors.push(`Finnhub: ${error.message}`);
    }

    if (allSymbols.size === 0) {
      throw new Error(`No symbols loaded from any provider. Errors: ${errors.join(', ')}`);
    }

    return Array.from(allSymbols.values());
  }

  async fetchFMPSymbols() {
    // FMP symbols endpoint
    const url = `https://financialmodelingprep.com/api/v3/stock/list?apikey=${process.env.FMP_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`FMP API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return data
      .filter(s => s.exchange && ['NASDAQ', 'NYSE', 'AMEX'].includes(s.exchange))
      .map(s => ({
        symbol: s.symbol,
        companyName: s.name,
        exchange: s.exchange,
        isActive: s.isActive !== false,
        sector: s.sector || 'Unknown',
        industry: s.industry || 'Unknown',
        marketCap: s.marketCap || null,
        country: s.country || 'US',
        currency: s.currency || 'USD',
        aliases: this.generateAliases(s.name)
      }));
  }

  async fetchFinnhubSymbols() {
    // Finnhub symbols endpoint
    const url = `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${process.env.FINNHUB_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return data
      .filter(s => s.type === 'Common Stock' || s.type === 'ETF')
      .map(s => ({
        symbol: s.symbol,
        companyName: s.description || s.symbol,
        exchange: s.exchange,
        isActive: true,
        sector: 'Unknown',
        industry: 'Unknown',
        marketCap: null,
        country: 'US',
        currency: 'USD',
        aliases: this.generateAliases(s.description || s.symbol)
      }));
  }

  generateAliases(companyName) {
    if (!companyName) return [];
    
    const aliases = [];
    const normalized = this.normalizeName(companyName);
    
    // Add the normalized name itself
    aliases.push(normalized);
    
    // Add common abbreviations
    const words = normalized.split(' ');
    if (words.length > 1) {
      const abbreviation = words.map(w => w[0]).join('');
      if (abbreviation.length >= 2) {
        aliases.push(abbreviation);
      }
    }
    
    // Add common variations
    const variations = [
      normalized.replace(/\s+inc\.?$/i, ''),
      normalized.replace(/\s+corp\.?$/i, ''),
      normalized.replace(/\s+llc\.?$/i, ''),
      normalized.replace(/\s+limited$/i, ''),
      normalized.replace(/\s+company$/i, ''),
      normalized.replace(/\s+co\.?$/i, ''),
      normalized.replace(/\s+&/g, ' and '),
      normalized.replace(/\s+and\s+/g, ' & ')
    ];
    
    variations.forEach(variation => {
      if (variation !== normalized && variation.length > 2) {
        aliases.push(variation);
      }
    });
    
    return [...new Set(aliases)]; // Remove duplicates
  }

  normalizeName(name) {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  buildIndexes(symbols) {
    this.symbols.clear();
    this.aliases.clear();
    
    symbols.forEach(symbol => {
      // Store symbol data
      this.symbols.set(symbol.symbol, symbol);
      
      // Build alias index
      const allNames = [symbol.companyName, ...symbol.aliases];
      allNames.forEach(name => {
        const normalized = this.normalizeName(name);
        if (normalized.length > 2) {
          if (!this.aliases.has(normalized)) {
            this.aliases.set(normalized, []);
          }
          this.aliases.get(normalized).push(symbol.symbol);
        }
      });
    });
  }

  // Search symbols by query
  search(query, limit = 10) {
    if (!query || query.length < 2) return [];
    
    const normalizedQuery = this.normalizeName(query);
    const results = [];
    
    // Exact symbol match
    if (this.symbols.has(query.toUpperCase())) {
      const symbol = this.symbols.get(query.toUpperCase());
      results.push({
        symbol: symbol.symbol,
        companyName: symbol.companyName,
        exchange: symbol.exchange,
        matchType: 'exact_symbol',
        score: 100
      });
    }
    
    // Alias matches
    for (const [alias, symbols] of this.aliases) {
      if (alias.includes(normalizedQuery)) {
        symbols.forEach(symbolKey => {
          const symbol = this.symbols.get(symbolKey);
          if (symbol && symbol.isActive) {
            const score = alias === normalizedQuery ? 95 : 80;
            results.push({
              symbol: symbol.symbol,
              companyName: symbol.companyName,
              exchange: symbol.exchange,
              matchType: 'alias',
              score,
              matchedAlias: alias
            });
          }
        });
      }
    }
    
    // Fuzzy matches
    for (const [symbolKey, symbol] of this.symbols) {
      if (!symbol.isActive) continue;
      
      const similarity = this.calculateSimilarity(normalizedQuery, this.normalizeName(symbol.companyName));
      if (similarity >= 0.7) {
        results.push({
          symbol: symbol.symbol,
          companyName: symbol.companyName,
          exchange: symbol.exchange,
          matchType: 'fuzzy',
          score: Math.floor(similarity * 100),
          similarity
        });
      }
    }
    
    // Sort by score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Calculate string similarity (Jaro-Winkler)
  calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0 || len2 === 0) return 0.0;
    
    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    if (matchWindow < 0) return 0.0;
    
    const str1Matches = new Array(len1).fill(false);
    const str2Matches = new Array(len2).fill(false);
    
    let matches = 0;
    let transpositions = 0;
    
    // Find matches
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, len2);
      
      for (let j = start; j < end; j++) {
        if (str2Matches[j] || str1[i] !== str2[j]) continue;
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }
    
    if (matches === 0) return 0.0;
    
    // Count transpositions
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!str1Matches[i]) continue;
      while (!str2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }
    
    const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
    
    // Winkler prefix bonus
    let prefix = 0;
    for (let i = 0; i < Math.min(len1, len2, 4); i++) {
      if (str1[i] === str2[i]) prefix++;
      else break;
    }
    
    return jaro + (prefix * 0.1 * (1 - jaro));
  }

  // Get symbol by symbol key
  getSymbol(symbol) {
    return this.symbols.get(symbol);
  }

  // Get all active symbols
  getAllActiveSymbols() {
    return Array.from(this.symbols.values()).filter(s => s.isActive);
  }

  // Get symbols by exchange
  getSymbolsByExchange(exchange) {
    return Array.from(this.symbols.values()).filter(s => s.isActive && s.exchange === exchange);
  }

  // Get symbols by sector
  getSymbolsBySector(sector) {
    return Array.from(this.symbols.values()).filter(s => s.isActive && s.sector === sector);
  }

  // Get statistics
  getStats() {
    const symbols = Array.from(this.symbols.values());
    const active = symbols.filter(s => s.isActive);
    
    const exchanges = {};
    const sectors = {};
    
    active.forEach(symbol => {
      exchanges[symbol.exchange] = (exchanges[symbol.exchange] || 0) + 1;
      sectors[symbol.sector] = (sectors[symbol.sector] || 0) + 1;
    });
    
    return {
      total: symbols.length,
      active: active.length,
      exchanges,
      sectors,
      lastUpdate: this.lastUpdate,
      aliases: this.aliases.size
    };
  }
}

// Export singleton instance
export const comprehensiveSymbolMaster = new ComprehensiveSymbolMaster();
