
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
  console.log(`[ExchangeService] Start fetching rate: ${type}`);
  
  try {
    // 1. INTENTO VÍA PROXY LOCAL (Servidor Express)
    let baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const apiUrl = `${baseUrl.replace(/\/$/, '')}/api/tasa-bcv?type=${type}`;
    
    try {
      console.log(`[ExchangeService] Tier 1: Local Proxy (${apiUrl})`);
      const response = await fetch(apiUrl, { timeout: 8000 } as any);
      if (response.ok) {
        const data = await response.json();
        if (data && data.rate) {
          console.log(`[ExchangeService] Success via Local Proxy: ${data.rate}`);
          return data.rate;
        }
      }
    } catch (e) {
      console.warn(`[ExchangeService] Local Proxy failed, trying Tier 2...`);
    }

    // 2. INTENTO DIRECTO A API EXTERNA (Fallback de cliente)
    // DolarAPI suele permitir CORS, así que podemos llamarla directamente si el servidor falla
    try {
      const directUrl = `https://ve.dolarapi.com/v1/dolares/${type === 'paralelo' ? 'paralelo' : 'bcv'}`;
      console.log(`[ExchangeService] Tier 2: Direct External API (${directUrl})`);
      const directRes = await fetch(directUrl, { timeout: 5000 } as any);
      if (directRes.ok) {
        const directData = await directRes.json();
        if (directData && directData.promedio) {
          console.log(`[ExchangeService] Success via Direct API: ${directData.promedio}`);
          return directData.promedio;
        }
      }
    } catch (e) {
      console.warn(`[ExchangeService] Direct API failed, using Tier 3 (Static Fallback).`);
    }

    // 3. FALLBACK ESTÁTICO
    return type === 'paralelo' ? 44.50 : 36.55;
  } catch (error) {
    console.error(`[ExchangeService] Critical error:`, error);
    return type === 'paralelo' ? 44.50 : 36.55;
  }
};
