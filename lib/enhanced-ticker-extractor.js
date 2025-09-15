// Enhanced Ticker Extractor - Professional Day Trading Dashboard
// Deterministic multi-stage ticker extraction with no mega-cap bias

import { initializeSymbolMaster, searchSymbols } from './symbol-master-enhanced.js';

let symbolMaster = null;

// Initialize symbol master
async function ensureSymbolMaster() {
  if (!symbolMaster) {
    await initializeSymbolMaster();
    symbolMaster = await initializeSymbolMaster();
  }
  return symbolMaster;
}

// Extract tickers from news article using deterministic multi-stage approach
export async function extractTickers(article) {
  await ensureSymbolMaster();
  
  if (!symbolMaster || symbolMaster.length === 0) {
    console.warn('Symbol master is empty, cannot extract tickers');
    return { tickers: [], inferredTickersConfidence: 0 };
  }
  
  console.log(`🔍 Extracting tickers from: "${article.title?.substring(0, 50)}..."`);
  console.log(`📊 Symbol master has ${symbolMaster.length} symbols`);
  
  const title = article.title || '';
  const summary = article.summary || '';
  const content = article.content || '';
  const url = article.url || '';
  
  const combinedText = `${title} ${summary} ${content}`;
  const combinedTextLower = combinedText.toLowerCase();
  
  const tickers = new Set();
  const confidenceScores = new Map();
  
  // Stage 1: Exact symbol match patterns (highest priority)
  const cashtagMatches = combinedText.match(/\$([A-Z]{1,5})\b/g);
  if (cashtagMatches) {
    console.log(`  💰 Found cashtag matches: ${cashtagMatches.join(', ')}`);
    cashtagMatches.forEach(match => {
      const ticker = match.substring(1).toUpperCase();
      const symbol = symbolMaster.find(s => s.symbol === ticker);
      if (symbol && symbol.isActive) {
        tickers.add(ticker);
        confidenceScores.set(ticker, 0.95);
        console.log(`    ✅ Added cashtag ticker: ${ticker}`);
      }
    });
  }
  
  // Stage 2: Parenthetical patterns (TICKER)
  const parenMatches = combinedText.match(/\(([A-Z]{1,5})\)/g);
  if (parenMatches) {
    console.log(`  📝 Found parenthetical matches: ${parenMatches.join(', ')}`);
    parenMatches.forEach(match => {
      const ticker = match.substring(1, match.length - 1).toUpperCase();
      const symbol = symbolMaster.find(s => s.symbol === ticker);
      if (symbol && symbol.isActive) {
        tickers.add(ticker);
        confidenceScores.set(ticker, 0.90);
        console.log(`    ✅ Added parenthetical ticker: ${ticker}`);
      }
    });
  }
  
  // Stage 3: Company name exact matching against live symbol master
  for (const symbol of symbolMaster) {
    if (!symbol.isActive) continue;
    
    let maxScore = 0;
    let bestMatch = null;
    
    // Check company name and aliases
    const searchTerms = [symbol.companyName, ...symbol.aliases];
    
    for (const term of searchTerms) {
      if (!term || term.length < 3) continue;
      
      const termLower = term.toLowerCase();
      
      // Exact match (highest priority for company names)
      if (combinedTextLower.includes(termLower)) {
        const score = 0.90; // High score for exact matches
        if (score > maxScore) {
          maxScore = score;
          bestMatch = symbol.symbol;
        }
      }
      
      // Partial match (word boundaries) - good for company names
      const words = termLower.split(/\s+/);
      if (words.length > 1) {
        const matchedWords = words.filter(word => 
          word.length > 2 && combinedTextLower.includes(word)
        );
        if (matchedWords.length >= Math.ceil(words.length * 0.6)) {
          const score = 0.75 + (matchedWords.length / words.length) * 0.15;
          if (score > maxScore) {
            maxScore = score;
            bestMatch = symbol.symbol;
          }
        }
      }
      
      // Abbreviation matching (lower priority)
      if (term.length > 5) {
        const abbreviation = term.split(/\s+/).map(word => word[0]).join('');
        if (abbreviation.length >= 3 && combinedTextLower.includes(abbreviation.toLowerCase())) {
          const score = 0.65;
          if (score > maxScore) {
            maxScore = score;
            bestMatch = symbol.symbol;
          }
        }
      }
    }
    
    // Only add if we have a confident match
    if (bestMatch && maxScore > 0.6) {
      tickers.add(bestMatch);
      confidenceScores.set(bestMatch, Math.max(confidenceScores.get(bestMatch) || 0, maxScore));
    }
  }
  
  // Stage 4: URL-based hints (if available)
  if (url) {
    const urlTickers = extractTickersFromUrl(url);
    urlTickers.forEach(ticker => {
      const symbol = symbolMaster.find(s => s.symbol === ticker);
      if (symbol && symbol.isActive) {
        tickers.add(ticker);
        confidenceScores.set(ticker, Math.max(confidenceScores.get(ticker) || 0, 0.70));
      }
    });
  }
  
  // Convert to array and sort by confidence
  const tickerArray = Array.from(tickers).sort((a, b) => {
    const scoreA = confidenceScores.get(a) || 0;
    const scoreB = confidenceScores.get(b) || 0;
    return scoreB - scoreA;
  });
  
  // Calculate overall confidence
  const totalConfidence = tickerArray.reduce((sum, ticker) => sum + (confidenceScores.get(ticker) || 0), 0);
  const avgConfidence = tickerArray.length > 0 ? totalConfidence / tickerArray.length : 0;
  
  console.log(`  🎯 Extracted ${tickerArray.length} tickers: [${tickerArray.join(', ')}]`);
  console.log(`  📈 Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  
  return {
    tickers: tickerArray,
    inferredTickersConfidence: avgConfidence,
    confidenceScores: Object.fromEntries(confidenceScores)
  };
}

// Extract tickers from URL patterns
function extractTickersFromUrl(url) {
  const tickers = [];
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Common patterns: /stock/AAPL, /quote/TSLA, /ticker/GOOGL
    const patterns = [
      /\/stock\/([A-Z]{1,5})/i,
      /\/quote\/([A-Z]{1,5})/i,
      /\/ticker\/([A-Z]{1,5})/i,
      /\/symbol\/([A-Z]{1,5})/i
    ];
    
    patterns.forEach(pattern => {
      const match = pathname.match(pattern);
      if (match) {
        tickers.push(match[1].toUpperCase());
      }
    });
    
    // Query parameters
    const queryParams = ['symbol', 'ticker', 'stock'];
    queryParams.forEach(param => {
      const value = urlObj.searchParams.get(param);
      if (value && /^[A-Z]{1,5}$/i.test(value)) {
        tickers.push(value.toUpperCase());
      }
    });
    
  } catch (error) {
    console.warn('Error parsing URL for tickers:', error.message);
  }
  
  return tickers;
}

// Validate ticker against symbol master
export function validateTicker(ticker) {
  if (!symbolMaster) return false;
  return symbolMaster.some(s => s.symbol === ticker.toUpperCase() && s.isActive);
}

// Get ticker info
export function getTickerInfo(ticker) {
  if (!symbolMaster) return null;
  return symbolMaster.find(s => s.symbol === ticker.toUpperCase());
}

// Search for similar tickers
export function findSimilarTickers(query, limit = 5) {
  if (!symbolMaster) return [];
  return searchSymbols(query, limit);
}

// Get extraction statistics
export function getExtractionStats() {
  return {
    symbolMasterSize: symbolMaster ? symbolMaster.length : 0,
    symbolMasterLoaded: !!symbolMaster
  };
}
