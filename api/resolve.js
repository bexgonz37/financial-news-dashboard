// /api/resolve
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const u = req.query.u;
  if (!u) return res.status(400).json({ ok:false, error:'Missing u' });
  
  try {
    const r = await fetch(u, { method: 'HEAD', redirect: 'follow' });
    return res.status(200).json({ ok:true, final: r.url || u });
  } catch {
    return res.status(200).json({ ok:false, final: u });
  }
};

