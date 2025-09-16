// Server-side ticker resolution with caching
import tickerResolver from '../lib/ticker-resolver.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, summary, symbols } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }
    
    const result = await tickerResolver.resolveTicker(title, summary || '', symbols || []);
    
    return res.status(200).json({
      success: true,
      result
    });
    
  } catch (error) {
    console.error('Ticker resolution error:', error);
    return res.status(500).json({
      success: false,
      error: 'Resolution failed',
      message: error.message
    });
  }
}
