
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

export const fetchExchangeRate = async (type: 'oficial' | 'paralelo' = 'oficial'): Promise<number> => {
  try {
    const response = await fetch(`/api/tasa-bcv?type=${type}`);
    
    // Si la respuesta es JSON, intentamos usar el rate incluso si hay error (fallback del servidor)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (data.rate) {
        if (!response.ok) console.warn("Using server-side fallback rate:", data.error);
        return data.rate;
      }
    }

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    return type === 'paralelo' ? 44.50 : 36.55; // Fallbacks extremos
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return type === 'paralelo' ? 44.50 : 36.55; // Valores de respaldo
  }
};
