import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { FMPProvider } from '../lib/providers/fmp.js';
import { FinnhubProvider } from '../lib/providers/finnhub.js';
import { AlphaVantageProvider } from '../lib/providers/alphavantage.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { ticker, type = 'quote', interval = '5min', limit = 100 } = req.query;
    
    if (!ticker) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing ticker parameter' 
      });
    }

    console.log(`Data API request: ${ticker}, ${type}, ${interval}, ${limit}`);

    // Initialize providers
    const providers = [];
    if (process.env.FMP_KEY) {
      providers.push(new FMPProvider(process.env.FMP_KEY));
    }
    if (process.env.FINNHUB_KEY) {
      providers.push(new FinnhubProvider(process.env.FINNHUB_KEY));
    }
    if (process.env.ALPHAVANTAGE_KEY) {
      providers.push(new AlphaVantageProvider(process.env.ALPHAVANTAGE_KEY));
    }

    if (providers.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No API keys available',
        data: type === 'quote' ? {} : { candles: [] }
      });
    }

    let quoteResult = null;
    let ohlcResult = null;
    const providerErrors = [];
    
    if (type === 'quote') {
      // Get quote data
      const providerPromises = providers.map(async (provider) => {
        try {
          const quotes = await provider.getQuotes([ticker]);
          return { provider: provider.name, data: quotes[0] || null, error: null };
        } catch (error) {
          console.warn(`${provider.name} quote failed:`, error.message);
          return { provider: provider.name, data: null, error: error.message };
        }
      });

      const results = await Promise.allSettled(providerPromises);
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { provider, data, error } = result.value;
          if (error) {
            providerErrors.push(`${provider}: ${error}`);
          } else if (data) {
            quoteResult = data;
            break; // Use first successful provider
          }
        } else {
          providerErrors.push(`Provider error: ${result.reason.message}`);
        }
      }

      if (!quoteResult) {
        return res.status(500).json({ 
          success: false, 
          error: 'No quote data available',
          message: `All providers failed: ${providerErrors.join(', ')}`,
          providerErrors: providerErrors,
          data: {}
        });
      }

      return res.status(200).json({
        success: true,
        data: quoteResult,
        lastUpdate: new Date().toISOString(),
        providerErrors: providerErrors
      });

    } else if (type === 'ohlc') {
      // Get OHLC data
      const providerPromises = providers.map(async (provider) => {
        try {
          const candles = await provider.getOHLC(ticker, interval, limit);
          return { provider: provider.name, data: candles, error: null };
        } catch (error) {
          console.warn(`${provider.name} OHLC failed:`, error.message);
          return { provider: provider.name, data: [], error: error.message };
        }
      });

      const results = await Promise.allSettled(providerPromises);
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { provider, data, error } = result.value;
          if (error) {
            providerErrors.push(`${provider}: ${error}`);
          } else if (data.length > 0) {
            ohlcResult = data;
            break; // Use first successful provider
          }
        } else {
          providerErrors.push(`Provider error: ${result.reason.message}`);
        }
      }

      if (!ohlcResult || ohlcResult.length === 0) {
        return res.status(500).json({ 
          success: false, 
          error: 'No OHLC data available',
          message: `All providers failed: ${providerErrors.join(', ')}`,
          providerErrors: providerErrors,
          data: { candles: [] }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          candles: ohlcResult,
          count: ohlcResult.length,
          ticker: ticker,
          interval: interval,
          lastUpdate: new Date().toISOString()
        },
        providerErrors: providerErrors
      });

    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid type parameter. Use "quote" or "ohlc"' 
      });
    }

  } catch (error) {
    console.error('Data API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      data: {}
    });
  }
}
