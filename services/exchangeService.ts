
export interface ExchangeRate {
  pair: string;
  rate: number;
  updated_at: string;
}

export interface BCVResponse {
  Dollar?: string | number;
  Euro?: string | number;
  [key: string]: any;
}

export const fetchExchangeRate = async (): Promise<number> => {
  try {
    const response = await fetch('/api/tasa-bcv');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    
    if (data.rate) {
      return data.rate;
    }
    
    return 36.5; // Fallback
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return 36.5; // Fallback value
  }
};
