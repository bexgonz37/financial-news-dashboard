// Simple ticker extractor that works reliably without external APIs
const MAJOR_TICKERS = {
  'AAPL': ['Apple', 'Apple Computer', 'iPhone', 'iPad', 'Mac', 'iOS'],
  'MSFT': ['Microsoft', 'Windows', 'Office', 'Azure', 'Xbox'],
  'GOOGL': ['Google', 'Alphabet', 'YouTube', 'Android', 'Chrome'],
  'AMZN': ['Amazon', 'AWS', 'Prime', 'Alexa'],
  'TSLA': ['Tesla', 'Tesla Motors', 'Elon Musk', 'Model S', 'Model 3', 'Model X', 'Model Y'],
  'META': ['Facebook', 'Meta', 'Instagram', 'WhatsApp', 'Oculus'],
  'NVDA': ['NVIDIA', 'Nvidia', 'GPU', 'AI', 'Gaming', 'RTX'],
  'NFLX': ['Netflix', 'Streaming'],
  'AMD': ['AMD', 'Advanced Micro Devices', 'Ryzen', 'Radeon'],
  'INTC': ['Intel', 'Core', 'Xeon'],
  'JPM': ['JPMorgan', 'Chase', 'Bank'],
  'JNJ': ['Johnson & Johnson', 'J&J'],
  'V': ['Visa', 'Credit Card'],
  'PG': ['Procter & Gamble', 'P&G'],
  'UNH': ['UnitedHealth', 'Health Insurance'],
  'HD': ['Home Depot', 'Hardware'],
  'MA': ['Mastercard', 'Credit Card'],
  'DIS': ['Disney', 'Walt Disney', 'ESPN', 'Hulu'],
  'PYPL': ['PayPal', 'Venmo'],
  'ADBE': ['Adobe', 'Photoshop', 'PDF'],
  'CRM': ['Salesforce', 'CRM'],
  'NKE': ['Nike', 'Athletic', 'Shoes'],
  'ABT': ['Abbott', 'Medical'],
  'TMO': ['Thermo Fisher', 'Scientific'],
  'ACN': ['Accenture', 'Consulting'],
  'COST': ['Costco', 'Wholesale'],
  'DHR': ['Danaher', 'Life Sciences'],
  'VZ': ['Verizon', 'Wireless'],
  'NEE': ['NextEra', 'Energy'],
  'WMT': ['Walmart', 'Retail'],
  'BAC': ['Bank of America', 'BofA'],
  'XOM': ['Exxon', 'Mobil', 'Oil'],
  'T': ['AT&T', 'Wireless'],
  'PFE': ['Pfizer', 'Pharmaceutical'],
  'KO': ['Coca-Cola', 'Coke'],
  'PEP': ['PepsiCo', 'Pepsi'],
  'ABBV': ['AbbVie', 'Pharmaceutical'],
  'CVX': ['Chevron', 'Oil'],
  'MRK': ['Merck', 'Pharmaceutical'],
  'LLY': ['Eli Lilly', 'Lilly'],
  'AVGO': ['Broadcom', 'Semiconductor'],
  'TXN': ['Texas Instruments', 'TI'],
  'QCOM': ['Qualcomm', 'Wireless'],
  'CHTR': ['Charter', 'Cable'],
  'CMCSA': ['Comcast', 'Cable', 'NBC'],
  'COF': ['Capital One', 'Bank'],
  'GILD': ['Gilead', 'Biotech'],
  'AMGN': ['Amgen', 'Biotech'],
  'HON': ['Honeywell', 'Industrial'],
  'UNP': ['Union Pacific', 'Railroad'],
  'PLTR': ['Palantir', 'Data Analytics'],
  'SOFI': ['SoFi', 'Fintech'],
  'HOOD': ['Robinhood', 'Trading'],
  'RBLX': ['Roblox', 'Gaming'],
  'COIN': ['Coinbase', 'Cryptocurrency'],
  'SNOW': ['Snowflake', 'Data Cloud'],
  'ZM': ['Zoom', 'Video Conferencing'],
  'DOCU': ['DocuSign', 'E-signature'],
  'BB': ['BlackBerry', 'Security'],
  'NOK': ['Nokia', 'Telecommunications']
};

// Extract tickers from text using simple pattern matching
export function extractTickers(text) {
  if (!text || typeof text !== 'string') {
    return { tickers: [], inferredTickersConfidence: 0 };
  }

  const tickers = new Set();
  const textLower = text.toLowerCase();
  
  // 1. Look for cashtags ($TICKER)
  const cashtagMatches = text.match(/\$([A-Z]{1,5})\b/g);
  if (cashtagMatches) {
    cashtagMatches.forEach(match => {
      const ticker = match.substring(1).toUpperCase();
      if (MAJOR_TICKERS[ticker]) {
        tickers.add(ticker);
      }
    });
  }
  
  // 2. Look for ticker in parentheses (TICKER)
  const parenMatches = text.match(/\(([A-Z]{1,5})\)/g);
  if (parenMatches) {
    parenMatches.forEach(match => {
      const ticker = match.substring(1, match.length - 1).toUpperCase();
      if (MAJOR_TICKERS[ticker]) {
        tickers.add(ticker);
      }
    });
  }
  
  // 3. Look for company names and map to tickers
  for (const [ticker, aliases] of Object.entries(MAJOR_TICKERS)) {
    for (const alias of aliases) {
      const aliasLower = alias.toLowerCase();
      if (textLower.includes(aliasLower)) {
        tickers.add(ticker);
        break; // Found one alias, no need to check others for this ticker
      }
    }
  }
  
  // 4. Look for common financial terms that might indicate specific companies
  if (textLower.includes('iphone') || textLower.includes('ipad') || textLower.includes('mac')) {
    tickers.add('AAPL');
  }
  if (textLower.includes('windows') || textLower.includes('office') || textLower.includes('azure')) {
    tickers.add('MSFT');
  }
  if (textLower.includes('youtube') || textLower.includes('android') || textLower.includes('chrome')) {
    tickers.add('GOOGL');
  }
  if (textLower.includes('prime') || textLower.includes('aws') || textLower.includes('alexa')) {
    tickers.add('AMZN');
  }
  if (textLower.includes('elon musk') || textLower.includes('model s') || textLower.includes('model 3')) {
    tickers.add('TSLA');
  }
  if (textLower.includes('instagram') || textLower.includes('whatsapp') || textLower.includes('oculus')) {
    tickers.add('META');
  }
  if (textLower.includes('gpu') || textLower.includes('rtx') || textLower.includes('gaming')) {
    tickers.add('NVDA');
  }
  if (textLower.includes('streaming') || textLower.includes('netflix')) {
    tickers.add('NFLX');
  }
  
  const tickerArray = Array.from(tickers);
  const confidence = tickerArray.length > 0 ? Math.min(0.9, 0.5 + (tickerArray.length * 0.1)) : 0;
  
  return {
    tickers: tickerArray,
    inferredTickersConfidence: confidence
  };
}
