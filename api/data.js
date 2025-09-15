import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { providerManager } from '../lib/provider-manager.js';

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

    if (type === 'quote') {
      // Get quote data using ProviderManager
      const result = await providerManager.getQuotes([ticker]);
      
      if (result.quotes.length === 0) {
        return res.status(200).json({ 
          success: true, 
          data: {},
          errors: result.errors
        });
      }

      return res.status(200).json({
        success: true,
        data: result.quotes[0],
        lastUpdate: new Date().toISOString(),
        errors: result.errors
      });

    } else if (type === 'ohlc') {
      // Get OHLC data using ProviderManager
      const result = await providerManager.getOHLC(ticker, interval, limit);
      
      if (result.candles.length === 0) {
        return res.status(200).json({ 
          success: true, 
          data: { candles: [] },
          errors: result.errors
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          candles: result.candles,
          count: result.candles.length,
          ticker: ticker,
          interval: interval,
          lastUpdate: new Date().toISOString()
        },
        errors: result.errors
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
