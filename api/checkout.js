const Stripe = require('stripe');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    const { amount, currency = 'usd', description } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      description: description || 'Financial Dashboard Subscription',
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
    
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'Checkout failed' });
  }
}
