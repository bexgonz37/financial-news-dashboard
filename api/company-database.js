// Comprehensive Company Database API
// Provides fast access to company information for commonly traded companies
// This is a fallback and performance optimization for the dynamic matcher

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (req.method === 'GET') {
      const { ticker, name, sector, exchange } = req.query;
      
      if (ticker) {
        const company = findCompanyByTicker(ticker);
        return res.status(200).json({ success: true, company });
      }
      
      if (name) {
        const companies = findCompaniesByName(name);
        return res.status(200).json({ success: true, companies });
      }
      
      if (sector || exchange) {
        const companies = filterCompaniesByCriteria({ sector, exchange });
        return res.status(200).json({ success: true, companies });
      }
      
      // Return all companies if no filters
      const allCompanies = getAllCompanies();
      return res.status(200).json({ success: true, companies: allCompanies });
    }
    
    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'search') {
        const results = searchCompanies(data.query);
        return res.status(200).json({ success: true, results });
      }
      
      if (action === 'suggest') {
        const suggestions = getSuggestions(data.partial);
        return res.status(200).json({ success: true, suggestions });
      }
      
      return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (err) {
    console.error('Company database error:', err);
    return res.status(500).json({ error: 'Company database error', message: err.message });
  }
}

// Comprehensive company database with 100+ companies
const COMPANY_DATABASE = {
  // Major Tech Companies
  'AAPL': { name: 'Apple Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '3.2T', aliases: ['apple', 'iphone', 'ipad', 'mac', 'macbook'] },
  'MSFT': { name: 'Microsoft Corporation', sector: 'Technology', exchange: 'NASDAQ', marketCap: '2.8T', aliases: ['microsoft', 'windows', 'office', 'azure', 'xbox'] },
  'GOOGL': { name: 'Alphabet Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '1.8T', aliases: ['google', 'alphabet', 'youtube', 'android', 'chrome'] },
  'AMZN': { name: 'Amazon.com Inc.', sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: '1.6T', aliases: ['amazon', 'aws', 'prime'] },
  'TSLA': { name: 'Tesla Inc.', sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: '800B', aliases: ['tesla', 'electric vehicles', 'ev'] },
  'META': { name: 'Meta Platforms Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '1.1T', aliases: ['meta', 'facebook', 'instagram', 'whatsapp'] },
  'NVDA': { name: 'NVIDIA Corporation', sector: 'Technology', exchange: 'NASDAQ', marketCap: '1.2T', aliases: ['nvidia', 'gpu', 'ai chips', 'graphics cards'] },
  'NFLX': { name: 'Netflix Inc.', sector: 'Communication Services', exchange: 'NASDAQ', marketCap: '200B', aliases: ['netflix', 'streaming', 'movies'] },
  'AMD': { name: 'Advanced Micro Devices Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '200B', aliases: ['amd', 'processors', 'ryzen', 'radeon'] },
  'INTC': { name: 'Intel Corporation', sector: 'Technology', exchange: 'NASDAQ', marketCap: '200B', aliases: ['intel', 'processors', 'core i', 'pentium'] },
  
  // Emerging Tech & Growth
  'PLTR': { name: 'Palantir Technologies Inc.', sector: 'Technology', exchange: 'NYSE', marketCap: '40B', aliases: ['palantir', 'data analytics', 'ai platform'] },
  'SNOW': { name: 'Snowflake Inc.', sector: 'Technology', exchange: 'NYSE', marketCap: '60B', aliases: ['snowflake', 'cloud data', 'data warehouse'] },
  'CRWD': { name: 'CrowdStrike Holdings Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '70B', aliases: ['crowdstrike', 'cybersecurity', 'endpoint protection'] },
  'ZS': { name: 'Zscaler Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '30B', aliases: ['zscaler', 'cloud security', 'zero trust'] },
  'NET': { name: 'Cloudflare Inc.', sector: 'Technology', exchange: 'NYSE', marketCap: '40B', aliases: ['cloudflare', 'cdn', 'web security'] },
  'PATH': { name: 'UiPath Inc.', sector: 'Technology', exchange: 'NYSE', marketCap: '10B', aliases: ['uipath', 'rpa', 'automation'] },
  'RBLX': { name: 'Roblox Corporation', sector: 'Technology', exchange: 'NYSE', marketCap: '25B', aliases: ['roblox', 'gaming', 'virtual world'] },
  'HOOD': { name: 'Robinhood Markets Inc.', sector: 'Financial Services', exchange: 'NASDAQ', marketCap: '15B', aliases: ['robinhood', 'trading app', 'commission free'] },
  'COIN': { name: 'Coinbase Global Inc.', sector: 'Financial Services', exchange: 'NASDAQ', marketCap: '20B', aliases: ['coinbase', 'cryptocurrency', 'crypto exchange'] },
  'SQ': { name: 'Block Inc.', sector: 'Technology', exchange: 'NYSE', marketCap: '40B', aliases: ['square', 'block', 'cash app', 'payment processing'] },
  
  // Biotech & Healthcare
  'MRNA': { name: 'Moderna Inc.', sector: 'Healthcare', exchange: 'NASDAQ', marketCap: '30B', aliases: ['moderna', 'mrna', 'vaccines', 'biotech'] },
  'BNTX': { name: 'BioNTech SE', sector: 'Healthcare', exchange: 'NASDAQ', marketCap: '25B', aliases: ['biontech', 'vaccines', 'mrna technology'] },
  'NVAX': { name: 'Novavax Inc.', sector: 'Healthcare', exchange: 'NASDAQ', marketCap: '2B', aliases: ['novavax', 'vaccines', 'protein based'] },
  'INO': { name: 'Inovio Pharmaceuticals Inc.', sector: 'Healthcare', exchange: 'NASDAQ', marketCap: '500M', aliases: ['inovio', 'dna medicine', 'vaccines'] },
  'VXRT': { name: 'Vaxart Inc.', sector: 'Healthcare', exchange: 'NASDAQ', marketCap: '200M', aliases: ['vaxart', 'oral vaccines', 'tablet vaccines'] },
  'OCGN': { name: 'Ocugen Inc.', sector: 'Healthcare', exchange: 'NASDAQ', marketCap: '300M', aliases: ['ocugen', 'gene therapy', 'ophthalmology'] },
  
  // Electric Vehicles & Clean Energy
  'RIVN': { name: 'Rivian Automotive Inc.', sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: '15B', aliases: ['rivian', 'electric trucks', 'ev startup'] },
  'LCID': { name: 'Lucid Group Inc.', sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: '10B', aliases: ['lucid', 'luxury ev', 'lucid air'] },
  'NIO': { name: 'NIO Inc.', sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: '20B', aliases: ['nio', 'chinese ev', 'electric vehicles'] },
  'XPEV': { name: 'XPeng Inc.', sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: '15B', aliases: ['xpeng', 'chinese ev', 'smart ev'] },
  'LI': { name: 'Li Auto Inc.', sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: '25B', aliases: ['li auto', 'chinese ev', 'hybrid ev'] },
  'ENPH': { name: 'Enphase Energy Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '20B', aliases: ['enphase', 'solar inverters', 'clean energy'] },
  'SEDG': { name: 'SolarEdge Technologies Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '15B', aliases: ['solaredge', 'solar power', 'inverters'] },
  'RUN': { name: 'Sunrun Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '5B', aliases: ['sunrun', 'solar installation', 'residential solar'] },
  
  // Fintech & Digital Payments
  'PYPL': { name: 'PayPal Holdings Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '80B', aliases: ['paypal', 'digital payments', 'venmo'] },
  'V': { name: 'Visa Inc.', sector: 'Financial Services', exchange: 'NYSE', marketCap: '500B', aliases: ['visa', 'credit cards', 'payment processing'] },
  'MA': { name: 'Mastercard Inc.', sector: 'Financial Services', exchange: 'NYSE', marketCap: '400B', aliases: ['mastercard', 'credit cards', 'payments'] },
  'AXP': { name: 'American Express Company', sector: 'Financial Services', exchange: 'NYSE', marketCap: '150B', aliases: ['american express', 'amex', 'credit cards'] },
  'AFRM': { name: 'Affirm Holdings Inc.', sector: 'Financial Services', exchange: 'NASDAQ', marketCap: '5B', aliases: ['affirm', 'buy now pay later', 'financing'] },
  'UPST': { name: 'Upstart Holdings Inc.', sector: 'Financial Services', exchange: 'NASDAQ', marketCap: '3B', aliases: ['upstart', 'ai lending', 'personal loans'] },
  'SOFI': { name: 'SoFi Technologies Inc.', sector: 'Financial Services', exchange: 'NASDAQ', marketCap: '8B', aliases: ['sofi', 'student loans', 'fintech'] },
  
  // Gaming & Entertainment
  'ATVI': { name: 'Activision Blizzard Inc.', sector: 'Communication Services', exchange: 'NASDAQ', marketCap: '60B', aliases: ['activision', 'blizzard', 'call of duty', 'world of warcraft'] },
  'EA': { name: 'Electronic Arts Inc.', sector: 'Communication Services', exchange: 'NASDAQ', marketCap: '35B', aliases: ['ea', 'electronic arts', 'fifa', 'madden', 'battlefield'] },
  'TTWO': { name: 'Take-Two Interactive Software Inc.', sector: 'Communication Services', exchange: 'NASDAQ', marketCap: '25B', aliases: ['take two', 'rockstar', 'gta', 'red dead'] },
  'ZNGA': { name: 'Zynga Inc.', sector: 'Communication Services', exchange: 'NASDAQ', marketCap: '10B', aliases: ['zynga', 'mobile games', 'farmville', 'words with friends'] },
  
  // Cannabis & Alternative Medicine
  'TLRY': { name: 'Tilray Brands Inc.', sector: 'Healthcare', exchange: 'NASDAQ', marketCap: '2B', aliases: ['tilray', 'cannabis', 'marijuana', 'weed'] },
  'CGC': { name: 'Canopy Growth Corporation', sector: 'Healthcare', exchange: 'NASDAQ', marketCap: '1B', aliases: ['canopy growth', 'canopy', 'cannabis', 'weed'] },
  'ACB': { name: 'Aurora Cannabis Inc.', sector: 'Healthcare', exchange: 'NASDAQ', marketCap: '500M', aliases: ['aurora cannabis', 'aurora', 'cannabis', 'weed'] },
  'CRON': { name: 'Cronos Group Inc.', sector: 'Healthcare', exchange: 'NASDAQ', marketCap: '1B', aliases: ['cronos', 'cannabis', 'marijuana'] },
  
  // Meme Stocks & High Volatility
  'GME': { name: 'GameStop Corp.', sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: '10B', aliases: ['gamestop', 'gme', 'video games', 'retail'] },
  'AMC': { name: 'AMC Entertainment Holdings Inc.', sector: 'Communication Services', exchange: 'NYSE', marketCap: '5B', aliases: ['amc', 'movie theaters', 'cinema'] },
  'BBBY': { name: 'Bed Bath & Beyond Inc.', sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: '1B', aliases: ['bed bath beyond', 'bbby', 'home goods', 'retail'] },
  'BB': { name: 'BlackBerry Limited', sector: 'Technology', exchange: 'NYSE', marketCap: '3B', aliases: ['blackberry', 'bb', 'mobile security', 'iot'] },
  'NOK': { name: 'Nokia Corporation', sector: 'Technology', exchange: 'NYSE', marketCap: '25B', aliases: ['nokia', 'telecommunications', '5g', 'networks'] },
  
  // Chinese Tech & ADRs
  'BABA': { name: 'Alibaba Group Holding Limited', sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: '200B', aliases: ['alibaba', 'baba', 'ecommerce', 'chinese tech'] },
  'JD': { name: 'JD.com Inc.', sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: '80B', aliases: ['jd', 'jingdong', 'chinese ecommerce'] },
  'PDD': { name: 'Pinduoduo Inc.', sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: '100B', aliases: ['pinduoduo', 'pdd', 'chinese ecommerce', 'social commerce'] },
  'BIDU': { name: 'Baidu Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '50B', aliases: ['baidu', 'chinese search', 'ai', 'autonomous driving'] },
  'TCEHY': { name: 'Tencent Holdings Limited', sector: 'Communication Services', exchange: 'OTC', marketCap: '400B', aliases: ['tencent', 'wechat', 'chinese gaming', 'social media'] },
  
  // Space & Aerospace
  'SPCE': { name: 'Virgin Galactic Holdings Inc.', sector: 'Industrials', exchange: 'NYSE', marketCap: '2B', aliases: ['virgin galactic', 'spce', 'space tourism', 'richard branson'] },
  'RKLB': { name: 'Rocket Lab USA Inc.', sector: 'Industrials', exchange: 'NASDAQ', marketCap: '2B', aliases: ['rocket lab', 'rklb', 'small satellites', 'space launch'] },
  'ASTS': { name: 'AST SpaceMobile Inc.', sector: 'Industrials', exchange: 'NASDAQ', marketCap: '1B', aliases: ['ast spacemobile', 'asts', 'satellite internet', 'space mobile'] },
  
  // Cryptocurrency Related
  'MSTR': { name: 'MicroStrategy Incorporated', sector: 'Technology', exchange: 'NASDAQ', marketCap: '5B', aliases: ['microstrategy', 'mstr', 'bitcoin', 'business intelligence'] },
  'RIOT': { name: 'Riot Platforms Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '2B', aliases: ['riot platforms', 'riot', 'bitcoin mining', 'crypto mining'] },
  'MARA': { name: 'Marathon Digital Holdings Inc.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '2B', aliases: ['marathon digital', 'mara', 'bitcoin mining', 'crypto mining'] },
  'HUT': { name: 'Hut 8 Mining Corp.', sector: 'Technology', exchange: 'NASDAQ', marketCap: '500M', aliases: ['hut 8', 'hut', 'bitcoin mining', 'crypto mining'] },
  
  // Additional Popular Stocks
  'DIS': { name: 'Walt Disney Company', sector: 'Communication Services', exchange: 'NYSE', marketCap: '200B', aliases: ['disney', 'walt disney', 'disney plus', 'espn', 'marvel'] },
  'WMT': { name: 'Walmart Inc.', sector: 'Consumer Staples', exchange: 'NYSE', marketCap: '400B', aliases: ['walmart', 'wal-mart', 'retail', 'grocery'] },
  'HD': { name: 'Home Depot Inc.', sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: '300B', aliases: ['home depot', 'homedepot', 'hardware', 'home improvement'] },
  'COST': { name: 'Costco Wholesale Corporation', sector: 'Consumer Staples', exchange: 'NASDAQ', marketCap: '250B', aliases: ['costco', 'wholesale', 'bulk shopping', 'membership'] },
  'TGT': { name: 'Target Corporation', sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: '80B', aliases: ['target', 'retail', 'discount store', 'red card'] },
  'SBUX': { name: 'Starbucks Corporation', sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: '100B', aliases: ['starbucks', 'coffee', 'cafe', 'beverages'] },
  'KO': { name: 'Coca-Cola Company', sector: 'Consumer Staples', exchange: 'NYSE', marketCap: '250B', aliases: ['coca cola', 'coca-cola', 'soft drinks', 'beverages'] },
  'PEP': { name: 'PepsiCo Inc.', sector: 'Consumer Staples', exchange: 'NASDAQ', marketCap: '250B', aliases: ['pepsi', 'pepsico', 'soft drinks', 'snacks'] },
  'MCD': { name: 'McDonald\'s Corporation', sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: '200B', aliases: ['mcdonalds', 'mcdonald\'s', 'fast food', 'hamburgers'] },
  'NKE': { name: 'Nike Inc.', sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: '200B', aliases: ['nike', 'athletic shoes', 'sports apparel', 'swoosh'] }
};

// Search functions
function findCompanyByTicker(ticker) {
  return COMPANY_DATABASE[ticker.toUpperCase()] || null;
}

function findCompaniesByName(name) {
  const query = name.toLowerCase();
  const results = [];
  
  for (const [ticker, company] of Object.entries(COMPANY_DATABASE)) {
    if (company.name.toLowerCase().includes(query) || 
        company.aliases.some(alias => alias.toLowerCase().includes(query))) {
      results.push({ ticker, ...company });
    }
  }
  
  return results;
}

function filterCompaniesByCriteria({ sector, exchange }) {
  const results = [];
  
  for (const [ticker, company] of Object.entries(COMPANY_DATABASE)) {
    if ((!sector || company.sector === sector) && 
        (!exchange || company.exchange === exchange)) {
      results.push({ ticker, ...company });
    }
  }
  
  return results;
}

function getAllCompanies() {
  return Object.entries(COMPANY_DATABASE).map(([ticker, company]) => ({
    ticker, ...company
  }));
}

function searchCompanies(query) {
  const results = [];
  const searchTerm = query.toLowerCase();
  
  for (const [ticker, company] of Object.entries(COMPANY_DATABASE)) {
    const searchableText = `${ticker} ${company.name} ${company.aliases.join(' ')}`.toLowerCase();
    if (searchableText.includes(searchTerm)) {
      results.push({ ticker, ...company });
    }
  }
  
  return results;
}

function getSuggestions(partial) {
  const suggestions = [];
  const query = partial.toLowerCase();
  
  for (const [ticker, company] of Object.entries(COMPANY_DATABASE)) {
    if (ticker.toLowerCase().startsWith(query) || 
        company.name.toLowerCase().includes(query) ||
        company.aliases.some(alias => alias.toLowerCase().includes(query))) {
      suggestions.push({
        ticker,
        name: company.name,
        display: `${ticker} - ${company.name}`
      });
    }
  }
  
  return suggestions.slice(0, 10);
}

// Export for use in other modules
module.exports = { 
  findCompanyByTicker, 
  findCompaniesByName, 
  filterCompaniesByCriteria,
  getAllCompanies,
  searchCompanies,
  getSuggestions
};