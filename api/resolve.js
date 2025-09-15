// /api/resolve
import fetch from 'node-fetch';

function isHttp(u) {
  return !!u && /^https?:\/\//i.test(u);
}

function looksSearchOrTopic(u) {
  const p = u.pathname.toLowerCase();
  const hasQ = ['q','query','s'].some(k => u.searchParams.has(k));
  const isSearch = p.includes('/search') || hasQ;
  const isTopic = /(\/(quote|symbol|ticker|topic|tag)\/)/i.test(p);
  return isSearch || isTopic;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const u = req.query.u;
  if (!u) return res.status(400).json({ ok:false, error:'Missing u' });
  
  try {
    const r = await fetch(u, { method: 'HEAD', redirect: 'follow' });
    const final = r.url || u;
    const U = new URL(final);
    if (!looksSearchOrTopic(U)) {
      return res.status(200).json({ ok:true, final: final });
    }
  } catch {}
  
  try {
    const g = await fetch(u, { method: 'GET', redirect: 'follow' });
    const final = g.url || u;
    const U = new URL(final);
    if (!looksSearchOrTopic(U)) {
      return res.status(200).json({ ok:true, final: final });
    }
  } catch {}
  
  return res.status(200).json({ ok:false, final: u });
};

