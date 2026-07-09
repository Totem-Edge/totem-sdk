import { makeProjectApiCall } from "../api/base";

export type Fiat = { usd?:number; eur?:number; gbp?:number; usd_24h_change?:number; eur_24h_change?:number; gbp_24h_change?:number };

export async function fetchMinimaFiat(): Promise<Fiat>{
  try {
    console.log('Fetching Minima price via PROJECT_ID system');
    const res = await makeProjectApiCall('price/minima', {
      body: JSON.stringify({ vs: 'usd,eur,gbp' })
    });
    
    if (!res.ok) {
      console.error('Price fetch failed:', res.status, res.statusText);
      throw new Error(`Price fetch failed: ${res.statusText}`);
    }
    
    const j = await res.json();
    console.log('Price data received:', j);
    
    // Handle JSON-RPC 2.0 response format
    if (j.error) {
      throw new Error(`API Error: ${j.error.message}`);
    }
    
    // j.result looks like: { minima: { usd:..., usd_24h_change:... } }
    const m = j?.result?.minima || j?.result?.["minima"] || j?.minima || j?.["minima"];
    return m || {};
  } catch (error) {
    console.error('Failed to fetch Minima price:', error);
    return {};
  }
}