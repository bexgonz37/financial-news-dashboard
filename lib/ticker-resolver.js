// Enhanced ticker resolution with caching and deterministic logic
import fmpLimiter from './fmp-limiter.js';

class TickerResolver {
  constructor() {
    this.resolutionCache = new Map();
    this.cacheExpiry = 60 * 60 * 1000; // 1 hour
    this.companyMaster = null;
    this.lastMasterFetch = 0;
    this.masterCacheDuration = 6 * 60 * 60 * 1000; // 6 hours
  }

  // Normalize symbol (strip exchange prefixes, handle special cases)
  normalizeSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') return null;
    
    let normalized = symbol.toUpperCase().trim();
    
    // Strip exchange prefixes
    normalized = normalized.replace(/^(NASDAQ|NYSE|AMEX):/i, '');
    
    // Handle special cases
    const specialCases = {
      'BRK.B': 'BRK-B',
      'BRK.A': 'BRK-A',
      'BF.B': 'BF-B',
      'BF.A': 'BF-A'
    };
    
    return specialCases[normalized] || normalized;
  }

  // Check if symbol is US equity
  isUSEquity(symbol) {
    if (!symbol) return false;
    
    // Basic US equity patterns
    const usPattern = /^[A-Z]{1,5}$/;
    const usWithDots = /^[A-Z]{1,4}[.-][A-Z]$/;
    
    return usPattern.test(symbol) || usWithDots.test(symbol);
  }

  // Get company master data (cached)
  async getCompanyMaster() {
    const now = Date.now();
    
    if (this.companyMaster && (now - this.lastMasterFetch) < this.masterCacheDuration) {
      return this.companyMaster;
    }
    
    try {
      const response = await fetch('/api/company-master');
      const data = await response.json();
      
      if (data.success) {
        this.companyMaster = {
          nameToSymbol: new Map(Object.entries(data.data.nameToSymbol || {})),
          symbolToName: new Map(Object.entries(data.data.symbolToName || {})),
          lastUpdate: data.data.lastUpdate
        };
        this.lastMasterFetch = now;
        console.log(`✅ Company master loaded: ${this.companyMaster.nameToSymbol.size} companies`);
      }
    } catch (error) {
      console.warn('Failed to fetch company master:', error);
    }
    
    return this.companyMaster;
  }

  // Search FMP for company (through limiter)
  async searchFMP(query) {
    try {
      const fmpKey = process.env.FMP_KEY;
      if (!fmpKey) return null;
      
      const url = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(query)}&limit=3&apikey=${fmpKey}`;
      const response = await fmpLimiter.makeRequest(url);
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data || [];
    } catch (error) {
      console.warn('FMP search failed:', error);
      return null;
    }
  }

  // Main resolution function
  async resolveTicker(title, summary = '', symbols = []) {
    const cacheKey = `${title.toLowerCase()}|${summary.toLowerCase()}`;
    const now = Date.now();
    
    // Check cache first
    if (this.resolutionCache.has(cacheKey)) {
      const cached = this.resolutionCache.get(cacheKey);
      if (now - cached.timestamp < this.cacheExpiry) {
        return cached.result;
      }
    }
    
    let result = {
      ticker: null,
      confidence: 0,
      reason: 'unresolved'
    };
    
    // Step 1: Provider symbols first
    if (symbols && symbols.length > 0) {
      for (const symbol of symbols) {
        const normalized = this.normalizeSymbol(symbol);
        if (normalized && this.isUSEquity(normalized)) {
          result = {
            ticker: normalized,
            confidence: 0.95,
            reason: 'provider_symbol'
          };
          break;
        }
      }
    }
    
    // Step 2: Company master lookup
    if (!result.ticker) {
      const master = await this.getCompanyMaster();
      if (master && master.nameToSymbol) {
        const searchText = `${title} ${summary}`.toLowerCase();
        
        // Try exact matches first
        for (const [name, symbol] of master.nameToSymbol) {
          if (searchText.includes(name)) {
            result = {
              ticker: symbol,
              confidence: 0.8,
              reason: 'master_exact'
            };
            break;
          }
        }
        
        // Try partial matches
        if (!result.ticker) {
          const words = searchText.split(/\s+/).filter(w => w.length > 3);
          for (const word of words) {
            for (const [name, symbol] of master.nameToSymbol) {
              if (name.includes(word) || word.includes(name)) {
                result = {
                  ticker: symbol,
                  confidence: 0.7,
                  reason: 'master_partial'
                };
                break;
              }
            }
            if (result.ticker) break;
          }
        }
      }
    }
    
    // Step 3: FMP search (only if confidence < 0.6)
    if (!result.ticker || result.confidence < 0.6) {
      const searchResults = await this.searchFMP(title);
      if (searchResults && searchResults.length > 0) {
        const best = searchResults[0];
        if (best.symbol && this.isUSEquity(best.symbol)) {
          const score = best.score || 0.5;
          if (score >= 0.6) {
            result = {
              ticker: this.normalizeSymbol(best.symbol),
              confidence: score,
              reason: 'search'
            };
          }
        }
      }
    }
    
    // Cache the result
    this.resolutionCache.set(cacheKey, {
      result,
      timestamp: now
    });
    
    return result;
  }
}

// Singleton instance
const tickerResolver = new TickerResolver();

export default tickerResolver;
