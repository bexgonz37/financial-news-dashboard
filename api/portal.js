const Stripe = require('stripe');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    const { customerId } = req.body;
    
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.STRIPE_RETURN_URL || 'https://yourdomain.com',
    });
    
    return res.status(200).json({
      url: session.url,
    });
    
  } catch (error) {
    console.error('Portal error:', error);
    return res.status(500).json({ error: 'Portal access failed' });
  }
}
