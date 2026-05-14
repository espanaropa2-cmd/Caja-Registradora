
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
    // Detectar la base URL para llamadas API
    // Si estamos en un entorno donde window.location.origin es válido (Web/PWA), lo usamos.
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const apiUrl = `${baseUrl}/api/tasa-bcv?type=${type}`;
    
    console.log(`[ExchangeService] Requesting: ${apiUrl}`);

    const response = await fetch(apiUrl, {
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
    
    const errorText = await response.text().catch(() => 'No error detail');
    console.warn(`[ExchangeService] API failed (Status: ${response.status}). Detail: ${errorText}. Using fallback.`);
    return type === 'paralelo' ? 44.50 : 36.55;
  } catch (error) {
    console.error(`[ExchangeService] Connection error fetching ${type}:`, error);
    // Probable error de CORS o red. Retornamos valor estático.
    return type === 'paralelo' ? 44.50 : 36.55;
  }
};
