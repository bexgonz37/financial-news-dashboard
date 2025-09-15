// Test symbol master loading
import { loadSymbolMaster } from './lib/symbol-master.js';

async function testSymbolMaster() {
  console.log('Testing symbol master loading...');
  
  try {
    const symbols = await loadSymbolMaster();
    console.log(`Loaded ${symbols.length} symbols`);
    
    if (symbols.length > 0) {
      console.log('First 5 symbols:', symbols.slice(0, 5).map(s => s.symbol));
      console.log('Sample symbol:', symbols[0]);
      
      // Test ticker extraction
      const { extractTickers } = await import('./lib/advanced-ticker-extractor.js');
      const testArticle = {
        title: "Apple Inc. Reports Strong Q4 Earnings",
        summary: "Apple Inc. (AAPL) reported better-than-expected earnings",
        content: "",
        url: ""
      };
      
      const result = await extractTickers(testArticle);
      console.log('Ticker extraction test:', result);
    } else {
      console.log('No symbols loaded - this is the problem');
    }
  } catch (error) {
    console.error('Error loading symbol master:', error);
  }
}

testSymbolMaster();
