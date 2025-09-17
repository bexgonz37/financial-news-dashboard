import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const mockNews = [
    {
      id: 'test_1',
      title: 'Test News Item 1',
      summary: 'This is a test news item',
      url: 'https://example.com',
      published_at: new Date().toISOString(),
      source: 'Test',
      symbols: ['AAPL', 'MSFT']
    },
    {
      id: 'test_2', 
      title: 'Test News Item 2',
      summary: 'Another test news item',
      url: 'https://example.com',
      published_at: new Date().toISOString(),
      source: 'Test',
      symbols: ['GOOGL', 'TSLA']
    }
  ];

  return NextResponse.json({
    items: mockNews,
    meta: {
      counts: { test: 2 },
      errors: [],
      updated_at: new Date().toISOString()
    }
  });
}
