export interface MarketData {
  date: string;
  gold: number;
  dxy: number;
  eurusd: number;
}

// Simulated Historical Data Generator
function generateHourlyData(): MarketData[] {
  const data: MarketData[] = [];
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(end.getFullYear() - 1);
  const curr = new Date(start);

  let gold = 1820;
  let dxy = 103;
  let eurusd = 1.07;

  while (curr <= end) {
    // Random walk with trends
    gold += (Math.random() - 0.49) * 2; // Hourly volatility
    dxy += (Math.random() - 0.51) * 0.05;
    eurusd += (Math.random() - 0.5) * 0.0005;

    data.push({
      date: curr.toISOString(), // ISO String with time
      gold: parseFloat(gold.toFixed(2)),
      dxy: parseFloat(dxy.toFixed(2)),
      eurusd: parseFloat(eurusd.toFixed(4))
    });

    curr.setHours(curr.getHours() + 1);
  }
  return data;
}

const BASE_DATA: MarketData[] = generateHourlyData();

export async function fetchMarketData(apiKey?: string, source: 'historical' | 'api' = 'historical'): Promise<MarketData[]> {
  if (source === 'api' && apiKey) {
    try {
      // Example using Alpha Vantage (Intraday)
      // Note: In a real app, you'd fetch XAU (Gold), DXY, and EURUSD separately and align them.
      // For this implementation, we simulate the fetch if a key is present to show the structure.
      const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min&apikey=${apiKey}`);
      const data = await response.json();
      
      if (data['Error Message']) throw new Error(data['Error Message']);
      
      // If we got real data, we would parse it here. 
      // For now, we return base data to ensure the app doesn't break without a valid market-active key.
      return [...BASE_DATA];
    } catch (e) {
      console.error("API Fetch Error:", e);
      return [...BASE_DATA];
    }
  }
  return [...BASE_DATA];
}

export async function fetchLatestPoint(lastPoint: MarketData, apiKey?: string): Promise<MarketData> {
  // In real implementation, this calls the 'Quote' endpoint
  // Simulating a new point based on the last known data for demonstration
  const nextDate = new Date();
  
  return {
    date: nextDate.toISOString(),
    gold: lastPoint.gold + (Math.random() - 0.49),
    dxy: lastPoint.dxy + (Math.random() - 0.5) * 0.01,
    eurusd: lastPoint.eurusd + (Math.random() - 0.5) * 0.0001
  };
}

export function alignData(data: MarketData[]): MarketData[] {
  return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
