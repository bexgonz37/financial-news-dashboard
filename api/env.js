// Environment variables endpoint for client access
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const envVars = {
      FINNHUB_KEY: process.env.FINNHUB_KEY || '',
      FMP_KEY: process.env.FMP_KEY || '',
      ALPHAVANTAGE_KEY: process.env.ALPHAVANTAGE_KEY || ''
    };

    return res.status(200).json({
      success: true,
      data: envVars
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