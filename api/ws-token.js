// API endpoint to get WebSocket token for client-side use
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = process.env.FINNHUB_KEY;
    
    if (!token) {
      return res.status(500).json({ 
        success: false, 
        error: 'WebSocket token not configured' 
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        token: token,
        wsUrl: `wss://ws.finnhub.io?token=${token}`
      }
    });

  } catch (error) {
    console.error('WebSocket token error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get WebSocket token',
      message: error.message
    });
  }
}
