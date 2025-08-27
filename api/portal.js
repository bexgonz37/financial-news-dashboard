// /api/portal.js
import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

    const portal = await stripe.billingPortal.sessions.create({
      // If you later track customers, pass `customer: 'cus_...'` here.
      return_url: process.env.STRIPE_PORTAL_RETURN_URL,
    });

    res.status(200).json({ url: portal.url });
  } catch (err) {
    console.error('Stripe portal error:', err);
    res.status(500).json({ error: 'Unable to create portal session' });
  }
}
