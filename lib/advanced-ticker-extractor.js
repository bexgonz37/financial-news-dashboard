// Advanced Ticker Extraction with Multi-Strategy Entity Linking
import { loadSymbolMaster, searchSymbols } from './symbol-master.js';

let symbolMaster = null;

// Initialize symbol master
async function initializeSymbolMaster() {
  if (!symbolMaster) {
    console.log('Initializing symbol master for ticker extraction...');
    symbolMaster = await loadSymbolMaster();
    console.log(`Symbol master initialized with ${symbolMaster.length} symbols`);
  }
  return symbolMaster;
}

// Extract tickers using multiple strategies
export async function extractTickers(article) {
  console.log('🔍 Starting ticker extraction...');
  await initializeSymbolMaster();
  
  if (!symbolMaster || symbolMaster.length === 0) {
    console.warn('❌ Symbol master is empty, cannot extract tickers');
    return { tickers: [], inferredTickersConfidence: 0 };
  }
  
  console.log(`✅ Symbol master loaded with ${symbolMaster.length} symbols`);
  
  console.log(`Extracting tickers from article: "${article.title?.substring(0, 50)}..."`);
  console.log(`Symbol master has ${symbolMaster.length} symbols`);
  
  const title = article.title || '';
  const summary = article.summary || '';
  const content = article.content || '';
  const url = article.url || '';
  
  const combinedText = `${title} ${summary} ${content}`;
  const combinedTextLower = combinedText.toLowerCase();
  
  const tickers = new Set();
  const confidenceScores = new Map();
  
  // Strategy 1: Exact $TICKER patterns
  const cashtagMatches = combinedText.match(/\$([A-Z]{1,5})\b/g);
  if (cashtagMatches) {
    console.log(`Found cashtag matches: ${cashtagMatches.join(', ')}`);
    cashtagMatches.forEach(match => {
      const ticker = match.substring(1).toUpperCase();
      const symbol = symbolMaster.find(s => s.symbol === ticker);
      if (symbol && symbol.isActive) {
        tickers.add(ticker);
        confidenceScores.set(ticker, 0.95);
        console.log(`Added cashtag ticker: ${ticker}`);
      }
    });
  }
  
  // Strategy 2: Parenthetical patterns (TICKER)
  const parenMatches = combinedText.match(/\(([A-Z]{1,5})\)/g);
  if (parenMatches) {
    console.log(`Found parenthetical matches: ${parenMatches.join(', ')}`);
    parenMatches.forEach(match => {
      const ticker = match.substring(1, match.length - 1).toUpperCase();
      const symbol = symbolMaster.find(s => s.symbol === ticker);
      if (symbol && symbol.isActive) {
        tickers.add(ticker);
        confidenceScores.set(ticker, 0.90);
        console.log(`Added parenthetical ticker: ${ticker}`);
      }
    });
  }
  
  // Strategy 3: Company name fuzzy matching against live symbol master
  for (const symbol of symbolMaster) {
    if (!symbol.isActive) continue;
    
    let maxScore = 0;
    let bestMatch = null;
    
    // Prioritize company name over aliases for better small-cap matching
    const searchTerms = [symbol.companyName, ...symbol.aliases];
    
    for (const term of searchTerms) {
      if (!term || term.length < 3) continue;
      
      const termLower = term.toLowerCase();
      
      // Exact match (highest priority)
      if (combinedTextLower.includes(termLower)) {
        const score = 0.90; // Higher score for exact matches
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
  
  // Strategy 4: URL heuristics
  if (url) {
    const urlLower = url.toLowerCase();
    
    // SeekingAlpha patterns
    const saMatch = urlLower.match(/seekingalpha\.com\/.*\/([a-z]{1,5})/);
    if (saMatch) {
      const ticker = saMatch[1].toUpperCase();
      const symbol = symbolMaster.find(s => s.symbol === ticker);
      if (symbol && symbol.isActive) {
        tickers.add(ticker);
        confidenceScores.set(ticker, 0.80);
      }
    }
    
    // PRNewswire patterns
    const prMatch = urlLower.match(/prnewswire\.com\/.*\/([a-z]{1,5})/);
    if (prMatch) {
      const ticker = prMatch[1].toUpperCase();
      const symbol = symbolMaster.find(s => s.symbol === ticker);
      if (symbol && symbol.isActive) {
        tickers.add(ticker);
        confidenceScores.set(ticker, 0.75);
      }
    }
    
    // Yahoo Finance patterns
    const yfMatch = urlLower.match(/finance\.yahoo\.com\/quote\/([a-z]{1,5})/);
    if (yfMatch) {
      const ticker = yfMatch[1].toUpperCase();
      const symbol = symbolMaster.find(s => s.symbol === ticker);
      if (symbol && symbol.isActive) {
        tickers.add(ticker);
        confidenceScores.set(ticker, 0.85);
      }
    }
  }
  
  // Strategy 5: Domain-specific patterns
  const domainPatterns = [
    { pattern: /(?:ticker|symbol):\s*([A-Z]{1,5})/gi, confidence: 0.90 },
    { pattern: /(?:stock|equity):\s*([A-Z]{1,5})/gi, confidence: 0.85 },
    { pattern: /(?:NYSE|NASDAQ|AMEX):\s*([A-Z]{1,5})/gi, confidence: 0.95 },
    { pattern: /(?:trading|investing)\s+([A-Z]{1,5})/gi, confidence: 0.70 }
  ];
  
  for (const { pattern, confidence } of domainPatterns) {
    const matches = combinedText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const tickerMatch = match.match(/([A-Z]{1,5})/);
        if (tickerMatch) {
          const ticker = tickerMatch[1].toUpperCase();
          const symbol = symbolMaster.find(s => s.symbol === ticker);
          if (symbol && symbol.isActive) {
            tickers.add(ticker);
            confidenceScores.set(ticker, Math.max(confidenceScores.get(ticker) || 0, confidence));
          }
        }
      });
    }
  }
  
  // Filter by confidence threshold and sort by confidence
  const finalTickers = Array.from(tickers)
    .filter(ticker => (confidenceScores.get(ticker) || 0) >= 0.5)
    .sort((a, b) => (confidenceScores.get(b) || 0) - (confidenceScores.get(a) || 0));
  
  // Calculate overall confidence
  const avgConfidence = finalTickers.length > 0 
    ? finalTickers.reduce((sum, ticker) => sum + (confidenceScores.get(ticker) || 0), 0) / finalTickers.length
    : 0;
  
  console.log(`Found ${finalTickers.length} tickers: [${finalTickers.join(', ')}] with confidence ${avgConfidence.toFixed(2)}`);
  
  return {
    tickers: finalTickers,
    inferredTickersConfidence: avgConfidence
  };
}

// Extract tickers from simple text (for backward compatibility)
export function extractTickersFromText(text) {
  if (!text || typeof text !== 'string') {
    return { tickers: [], inferredTickersConfidence: 0 };
  }
  
  return extractTickers({ title: text, summary: '', content: '', url: '' });
}
