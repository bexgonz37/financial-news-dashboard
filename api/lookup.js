// Consolidated Lookup API - Company/ticker search and resolution
import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { comprehensiveSymbolMaster } from '../lib/comprehensive-symbol-master.js';

// URL validation
function isHttp(u) {
  return !!u && /^https?:\/\//i.test(u);
}

function looksSearchOrTopic(u) {
  const p = u.pathname.toLowerCase();
  const hasQ = ['q','query','s'].some(k => u.searchParams.has(k));
  const isSearch = p.includes('/search') || hasQ;
  const isTopic = /(\/(quote|symbol|ticker|topic|tag)\/)/i.test(p);
  return isSearch || isTopic;
}

// Search companies using FMP API
async function searchCompanies(query) {
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) throw new Error('FMP_KEY not configured');
  
  const url = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(query)}&limit=10&apikey=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FMP API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data || [];
}

// Search companies using Alpha Vantage API
async function searchCompaniesAlphaVantage(query) {
  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) throw new Error('ALPHAVANTAGE_KEY not configured');
  
  const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Alpha Vantage API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.bestMatches || [];
}

// Normalize search results
function normalizeSearchResult(item, source) {
  if (source === 'fmp') {
    return {
      symbol: item.symbol,
      name: item.name,
      exchange: item.exchangeShortName,
      marketCap: item.marketCap,
      sector: item.sector,
      industry: item.industry,
      country: item.country,
      source: 'fmp'
    };
  } else if (source === 'alpha_vantage') {
    return {
      symbol: item['1. symbol'],
      name: item['2. name'],
      exchange: item['4. region'],
      marketCap: null,
      sector: null,
      industry: null,
      country: item['4. region'],
      source: 'alpha_vantage'
    };
  }
  return item;
}

// Main handler
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { q: query, type = 'symbol' } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required and must be at least 2 characters'
      });
    }

    const searchQuery = query.trim();
    const results = [];

    // First, try local symbol master
    const localResults = comprehensiveSymbolMaster.searchSymbols(searchQuery);
    if (localResults.length > 0) {
      results.push(...localResults.map(symbol => ({
        symbol: symbol.symbol,
        name: symbol.companyName || symbol.name,
        exchange: symbol.exchange,
        marketCap: symbol.marketCap,
        sector: symbol.sector,
        industry: symbol.industry,
        country: symbol.country,
        source: 'local'
      })));
    }

    // If not enough results, try external APIs
    if (results.length < 5) {
      try {
        const fmpResults = await searchCompanies(searchQuery);
        results.push(...fmpResults.map(item => normalizeSearchResult(item, 'fmp')));
      } catch (error) {
        console.warn('FMP search failed:', error.message);
      }
    }

    if (results.length < 5) {
      try {
        const avResults = await searchCompaniesAlphaVantage(searchQuery);
        results.push(...avResults.map(item => normalizeSearchResult(item, 'alpha_vantage')));
      } catch (error) {
        console.warn('Alpha Vantage search failed:', error.message);
      }
    }

    // Remove duplicates based on symbol
    const uniqueResults = results.filter((item, index, self) => 
      index === self.findIndex(t => t.symbol === item.symbol)
    );

    // Sort by relevance (exact matches first, then by market cap)
    uniqueResults.sort((a, b) => {
      const aExact = a.symbol.toLowerCase() === searchQuery.toLowerCase();
      const bExact = b.symbol.toLowerCase() === searchQuery.toLowerCase();
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      return (b.marketCap || 0) - (a.marketCap || 0);
    });

    return res.status(200).json({
      success: true,
      data: {
        query: searchQuery,
        results: uniqueResults.slice(0, 20), // Limit to 20 results
        total: uniqueResults.length,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('Lookup API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search companies',
      message: error.message
    });
  }
}
