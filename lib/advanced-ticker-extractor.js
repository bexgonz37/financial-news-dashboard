// Advanced Ticker Extraction with 4-Stage Resolver and Scoring
import { loadSymbolMaster } from './symbol-master.js';

let symbolMaster = null;

// Initialize symbol master
async function ensureSymbolMaster() {
  if (!symbolMaster) {
    console.log('Initializing symbol master for ticker extraction...');
    symbolMaster = await loadSymbolMaster();
    console.log(`Symbol master initialized with ${symbolMaster.length} symbols`);
  }
  return symbolMaster;
}

// Extract tickers using 4-stage resolver with scoring
export async function extractTickers(article) {
  await ensureSymbolMaster();
  
  if (!symbolMaster || symbolMaster.length === 0) {
    console.warn('Symbol master is empty, cannot extract tickers');
    return { tickers: [], inferredTickersConfidence: 0, matchDetails: [] };
  }
  
  const title = article.title || '';
  const summary = article.summary || '';
  const content = article.content || '';
  const url = article.url || '';
  
  const combinedText = `${title} ${summary}`;
  const combinedTextLower = combinedText.toLowerCase();
  const titleLower = title.toLowerCase();
  
  const candidates = new Map(); // symbol -> { score, matchStage, matchedPhrase, context }
  
  // Stage 1: Exact symbol mention (highest priority)
  const exactSymbolMatches = combinedText.match(/\b([A-Z]{1,5})\b/g);
  if (exactSymbolMatches) {
    for (const match of exactSymbolMatches) {
      const symbol = symbolMaster.find(s => s.symbol === match && s.isActive);
      if (symbol) {
        const inTitle = titleLower.includes(match.toLowerCase());
        const score = 100 + (inTitle ? 0 : -20); // Penalty for body-only matches
        const context = inTitle ? 'title' : 'body';
        
        candidates.set(match, {
          score,
          matchStage: 'exact_symbol',
          matchedPhrase: match,
          context,
          marketCap: symbol.marketCap || 0
        });
      }
    }
  }
  
  // Stage 2: Cashtag patterns ($SYMBOL)
  const cashtagMatches = combinedText.match(/\$([A-Z]{1,5})\b/g);
  if (cashtagMatches) {
    for (const match of cashtagMatches) {
      const ticker = match.substring(1);
      const symbol = symbolMaster.find(s => s.symbol === ticker && s.isActive);
      if (symbol) {
        const inTitle = titleLower.includes(`$${ticker.toLowerCase()}`);
        const score = 100 + (inTitle ? 0 : -20);
        const context = inTitle ? 'title' : 'body';
        
        candidates.set(ticker, {
          score,
          matchStage: 'cashtag',
          matchedPhrase: match,
          context,
          marketCap: symbol.marketCap || 0
        });
      }
    }
  }
  
  // Stage 3: Exact company name match (normalized)
  for (const symbol of symbolMaster) {
    if (!symbol.isActive || !symbol.companyName) continue;
    
    const normalizedName = normalizeCompanyName(symbol.companyName);
    const normalizedText = normalizeCompanyName(combinedText);
    
    if (normalizedText.includes(normalizedName)) {
      const inTitle = normalizeCompanyName(title).includes(normalizedName);
      const score = 90 + (inTitle ? 0 : -20);
      const context = inTitle ? 'title' : 'body';
      
      // Only add if better than existing match
      const existing = candidates.get(symbol.symbol);
      if (!existing || score > existing.score) {
        candidates.set(symbol.symbol, {
          score,
          matchStage: 'exact_company_name',
          matchedPhrase: symbol.companyName,
          context,
          marketCap: symbol.marketCap || 0
        });
      }
    }
  }
  
  // Stage 4: Alias match
  for (const symbol of symbolMaster) {
    if (!symbol.isActive || !symbol.aliases) continue;
    
    for (const alias of symbol.aliases) {
      if (!alias || alias.length < 3) continue;
      
      const normalizedAlias = normalizeCompanyName(alias);
      const normalizedText = normalizeCompanyName(combinedText);
      
      if (normalizedText.includes(normalizedAlias)) {
        const inTitle = normalizeCompanyName(title).includes(normalizedAlias);
        const score = 75 + (inTitle ? 0 : -20);
        const context = inTitle ? 'title' : 'body';
        
        // Only add if better than existing match
        const existing = candidates.get(symbol.symbol);
        if (!existing || score > existing.score) {
          candidates.set(symbol.symbol, {
            score,
            matchStage: 'alias',
            matchedPhrase: alias,
            context,
            marketCap: symbol.marketCap || 0
          });
        }
      }
    }
  }
  
  // Stage 5: Fuzzy company name match (only if no high-confidence matches)
  const highConfidenceMatches = Array.from(candidates.values()).filter(c => c.score >= 85);
  if (highConfidenceMatches.length === 0) {
    for (const symbol of symbolMaster) {
      if (!symbol.isActive || !symbol.companyName) continue;
      
      const similarity = calculateSimilarity(
        normalizeCompanyName(symbol.companyName),
        normalizeCompanyName(combinedText)
      );
      
      if (similarity >= 0.92) {
        const inTitle = calculateSimilarity(
          normalizeCompanyName(symbol.companyName),
          normalizeCompanyName(title)
        ) >= 0.92;
        
        const score = 60 + (inTitle ? 0 : -20);
        const context = inTitle ? 'title' : 'body';
        
        const existing = candidates.get(symbol.symbol);
        if (!existing || score > existing.score) {
          candidates.set(symbol.symbol, {
            score,
            matchStage: 'fuzzy',
            matchedPhrase: symbol.companyName,
            context,
            marketCap: symbol.marketCap || 0
          });
        }
      }
    }
  }
  
  // Filter and sort candidates
  const validCandidates = Array.from(candidates.entries())
    .filter(([symbol, data]) => data.score >= 85) // Only high-confidence matches
    .sort((a, b) => {
      const [symbolA, dataA] = a;
      const [symbolB, dataB] = b;
      
      // Sort by score (desc), then by market cap (desc), then by context (title first)
      if (dataA.score !== dataB.score) return dataB.score - dataA.score;
      if (dataA.marketCap !== dataB.marketCap) return dataB.marketCap - dataA.marketCap;
      return dataA.context === 'title' ? -1 : 1;
    });
  
  // Apply caps: max 1 ticker for company-specific articles, max 3 for multi-company
  const isMultiCompany = validCandidates.length > 1 && 
    validCandidates.some(([_, data]) => data.matchStage === 'exact_symbol' || data.matchStage === 'cashtag');
  
  const maxTickers = isMultiCompany ? 3 : 1;
  const selectedCandidates = validCandidates.slice(0, maxTickers);
  
  const tickers = selectedCandidates.map(([symbol, _]) => symbol);
  const matchDetails = selectedCandidates.map(([symbol, data]) => ({
    symbol,
    matchStage: data.matchStage,
    score: data.score,
    matchedPhrase: data.matchedPhrase,
    context: data.context
  }));
  
  const avgConfidence = matchDetails.length > 0 
    ? matchDetails.reduce((sum, detail) => sum + detail.score, 0) / matchDetails.length / 100
    : 0;
  
  console.log(`🎯 Ticker extraction: ${tickers.length} tickers, avg confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  if (matchDetails.length > 0) {
    console.log(`   Details: ${matchDetails.map(d => `${d.symbol} (${d.matchStage}, ${d.score})`).join(', ')}`);
  }
  
  return {
    tickers,
    inferredTickersConfidence: avgConfidence,
    matchDetails
  };
}

// Helper function to normalize company names
function normalizeCompanyName(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Helper function to calculate string similarity (Jaro-Winkler approximation)
function calculateSimilarity(str1, str2) {
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

// Extract tickers from URL (for URL-based hints)
function extractTickersFromUrl(url) {
  const tickers = [];
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Look for ticker patterns in URL path
    const tickerMatches = pathname.match(/\/([A-Z]{1,5})\b/g);
    if (tickerMatches) {
      tickerMatches.forEach(match => {
        const ticker = match.substring(1);
        if (ticker.length >= 1 && ticker.length <= 5) {
          tickers.push(ticker);
        }
      });
    }
  } catch (error) {
    // Invalid URL, ignore
  }
  
  return tickers;
}