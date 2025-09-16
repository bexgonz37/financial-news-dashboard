// OHLC Mini-Chart API with shared cache and graceful fallback
import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { providerQueue } from '../lib/provider-queue.js';
import { sharedCache } from '../lib/shared-cache.js';

// Fetch OHLC from FMP
async function fetchFMPOHLC(symbol, range = '1d') {
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) throw new Error('FMP_KEY not configured');
  
  let interval = '1min';
  let limit = 390; // 1 day of 1-minute bars
  
  if (range === '5d') {
    interval = '5min';
    limit = 390; // 5 days of 5-minute bars
  } else if (range === '1m') {
    interval = '1hour';
    limit = 720; // 1 month of hourly bars
  }
  
  const response = await fetch(`https://financialmodelingprep.com/api/v3/historical-chart/${interval}/${symbol}?apikey=${apiKey}&limit=${limit}`, {
    cache: 'no-store',
    timeout: 10000
  });
  
  if (!response.ok) {
    throw new Error(`FMP OHLC API error: ${response.status}`);
  }
  
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  
  return data.map(item => ({
    timestamp: new Date(item.date).getTime(),
    open: parseFloat(item.open),
    high: parseFloat(item.high),
    low: parseFloat(item.low),
    close: parseFloat(item.close),
    volume: parseInt(item.volume)
  })).sort((a, b) => a.timestamp - b.timestamp);
}

// Fetch OHLC from Finnhub
async function fetchFinnhubOHLC(symbol, range = '1d') {
  const apiKey = process.env.FINNHUB_KEY;
  if (!apiKey) throw new Error('FINNHUB_KEY not configured');
  
  const now = Math.floor(Date.now() / 1000);
  let from, to, resolution;
  
  if (range === '1d') {
    from = now - 24 * 60 * 60; // 1 day
    to = now;
    resolution = '1';
  } else if (range === '5d') {
    from = now - 5 * 24 * 60 * 60; // 5 days
    to = now;
    resolution = '5';
  } else if (range === '1m') {
    from = now - 30 * 24 * 60 * 60; // 1 month
    to = now;
    resolution = '60';
  }
  
  const response = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`, {
    cache: 'no-store',
    timeout: 10000
  });
  
  if (!response.ok) {
    throw new Error(`Finnhub OHLC API error: ${response.status}`);
  }
  
  const data = await response.json();
  if (data.s !== 'ok' || !data.t || !data.o) return [];
  
  const ohlc = [];
  for (let i = 0; i < data.t.length; i++) {
    ohlc.push({
      timestamp: data.t[i] * 1000,
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i] || 0
    });
  }
  
  return ohlc.sort((a, b) => a.timestamp - b.timestamp);
}

// Fetch OHLC from AlphaVantage
async function fetchAlphaVantageOHLC(symbol, range = '1d') {
  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) throw new Error('ALPHAVANTAGE_KEY not configured');
  
  let function_name = 'TIME_SERIES_INTRADAY';
  let interval = '1min';
  
  if (range === '5d') {
    function_name = 'TIME_SERIES_INTRADAY';
    interval = '5min';
  } else if (range === '1m') {
    function_name = 'TIME_SERIES_DAILY';
    interval = 'daily';
  }
  
  const response = await fetch(`https://www.alphavantage.co/query?function=${function_name}&symbol=${symbol}&interval=${interval}&apikey=${apiKey}`, {
    cache: 'no-store',
    timeout: 15000
  });
  
  if (!response.ok) {
    throw new Error(`AlphaVantage OHLC API error: ${response.status}`);
  }
  
  const data = await response.json();
  const timeSeriesKey = Object.keys(data).find(key => key.includes('Time Series'));
  
  if (!timeSeriesKey || !data[timeSeriesKey]) return [];
  
  const timeSeries = data[timeSeriesKey];
  const ohlc = [];
  
  for (const [timestamp, values] of Object.entries(timeSeries)) {
    ohlc.push({
      timestamp: new Date(timestamp).getTime(),
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume'])
    });
  }
  
  return ohlc.sort((a, b) => a.timestamp - b.timestamp);
}

// Main API handler
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { symbol, symbols, range = '1d' } = req.query;
    
    if (!symbol && !symbols) {
      return res.status(400).json({ error: 'symbol or symbols parameter required' });
    }
    
    const symbolList = symbols ? symbols.split(',').map(s => s.trim().toUpperCase()) : [symbol.toUpperCase()];
    const results = {};
    const errors = [];
    
    for (const sym of symbolList) {
      try {
        // Check cache first
        const cacheKey = `ohlc:${sym}:${range}`;
        const cached = sharedCache.get(cacheKey);
        
        if (cached) {
          results[sym] = cached;
          console.log(`Serving cached OHLC for ${sym}`);
          continue;
        }
        
        // Try to fetch from providers
        let ohlcData = [];
        let providerUsed = null;
        
        // Try FMP first
        try {
          if (providerQueue.canMakeRequest('fmp')) {
            ohlcData = await fetchFMPOHLC(sym, range);
            providerQueue.handleResponse('fmp', true);
            providerUsed = 'fmp';
            console.log(`FMP: ${ohlcData.length} OHLC bars for ${sym}`);
          }
        } catch (error) {
          providerQueue.handleResponse('fmp', false, error);
          console.warn(`FMP OHLC failed for ${sym}:`, error.message);
        }
        
        // Try Finnhub if FMP failed
        if (ohlcData.length === 0) {
          try {
            if (providerQueue.canMakeRequest('finnhub')) {
              ohlcData = await fetchFinnhubOHLC(sym, range);
              providerQueue.handleResponse('finnhub', true);
              providerUsed = 'finnhub';
              console.log(`Finnhub: ${ohlcData.length} OHLC bars for ${sym}`);
            }
          } catch (error) {
            providerQueue.handleResponse('finnhub', false, error);
            console.warn(`Finnhub OHLC failed for ${sym}:`, error.message);
          }
        }
        
        // Try AlphaVantage as last resort
        if (ohlcData.length === 0) {
          try {
            if (providerQueue.canMakeRequest('alphavantage')) {
              ohlcData = await fetchAlphaVantageOHLC(sym, range);
              providerQueue.handleResponse('alphavantage', true);
              providerUsed = 'alphavantage';
              console.log(`AlphaVantage: ${ohlcData.length} OHLC bars for ${sym}`);
            }
          } catch (error) {
            providerQueue.handleResponse('alphavantage', false, error);
            console.warn(`AlphaVantage OHLC failed for ${sym}:`, error.message);
          }
        }
        
        if (ohlcData.length > 0) {
          // Cache the data
          sharedCache.set(cacheKey, ohlcData, 'ohlc');
          results[sym] = ohlcData;
        } else {
          // Return empty series with no data indicator
          results[sym] = {
            data: [],
            noData: true,
            message: 'No OHLC data available',
            provider: providerUsed
          };
          errors.push(`${sym}: No OHLC data available from any provider`);
        }
        
      } catch (error) {
        console.error(`Error fetching OHLC for ${sym}:`, error);
        results[sym] = {
          data: [],
          noData: true,
          message: 'Error fetching OHLC data',
          error: error.message
        };
        errors.push(`${sym}: ${error.message}`);
      }
    }
    
    return res.status(200).json({
      success: true,
      data: results,
      range,
      timestamp: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('OHLC Mini API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
