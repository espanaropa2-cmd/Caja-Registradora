
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
  console.log(`[ExchangeService] Fetching rate: ${type}...`);
  
  try {
    // Si estamos en un entorno compilado (ej: app móvil), el path relativo /api/
    // puede fallar si no hay un servidor local. 
    const response = await fetch(`/api/tasa-bcv?type=${type}`, {
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.rate) {
        console.log(`[ExchangeService] Rate resolved for ${type}: ${data.rate} (${data.source || 'server'})`);
        return data.rate;
      }
    }
    
    console.warn(`[ExchangeService] API failed (Status: ${response.status}). Using fallback.`);
    return type === 'paralelo' ? 44.50 : 36.55;
  } catch (error) {
    console.error(`[ExchangeService] Connection error fetching ${type}:`, error);
    // Probable error de CORS o red. Retornamos valor estático.
    return type === 'paralelo' ? 44.50 : 36.55;
  }
};
