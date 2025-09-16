// Environment variables API endpoint for client-side access
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Return environment variables for client-side use
    return res.status(200).json({
      success: true,
      data: {
        FINNHUB_KEY: process.env.FINNHUB_KEY || '',
        FMP_KEY: process.env.FMP_KEY || '',
        ALPHAVANTAGE_KEY: process.env.ALPHAVANTAGE_KEY || ''
      }
    });
  } catch (error) {
    console.error('Environment variables error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get environment variables',
      message: error.message
    });
  }
}
