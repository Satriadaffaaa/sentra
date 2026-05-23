import { NextRequest } from "next/server";

const COINGECKO_MAP: Record<string, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  sol: 'solana',
  ada: 'cardano',
  xrp: 'ripple',
  doge: 'dogecoin',
  dot: 'polkadot',
  matic: 'polygon',
  trx: 'tron',
  ltc: 'litecoin',
  link: 'chainlink',
  shib: 'shiba-inu',
  avax: 'avalanche-2',
  uni: 'uniswap',
  xlm: 'stellar',
  bch: 'bitcoin-cash',
  usdt: 'tether',
  usdc: 'usd-coin',
  bnb: 'binancecoin',
  ton: 'the-open-network',
  pepe: 'pepe',
  sui: 'sui',
  apt: 'aptos',
  near: 'near',
  atom: 'cosmos',
  ftm: 'fantom',
  arb: 'arbitrum',
  op: 'optimism',
  sei: 'sei-network',
  inj: 'injective-protocol',
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return Response.json({ error: "Missing symbol parameter" }, { status: 400 });
  }

  try {
    // CoinGecko Public API
    const lowerSymbol = symbol.toLowerCase().trim();
    const coingeckoId = COINGECKO_MAP[lowerSymbol] || lowerSymbol;
    
    const cgRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coingeckoId)}&vs_currencies=usd,idr&include_24hr_change=true`,
      {
        headers: { "Accept": "application/json" },
        cache: "no-store"
      }
    );

    if (!cgRes.ok) {
      return Response.json({ error: `CoinGecko API error: ${cgRes.statusText}` }, { status: cgRes.status });
    }

    const cgData = await cgRes.json();
    const priceData = cgData[coingeckoId];

    if (!priceData) {
      return Response.json({ error: `No price found for crypto symbol: ${symbol}` }, { status: 404 });
    }

    // Return both USD and IDR prices
    const priceUsd = priceData.usd;
    const priceIdr = priceData.idr;
    const change24h = priceData.usd_24h_change;

    if (priceUsd === undefined && priceIdr === undefined) {
      return Response.json({ error: `Price data missing for symbol: ${symbol}` }, { status: 404 });
    }

    return Response.json({ 
      symbol: symbol.toUpperCase(), 
      price: priceIdr || priceUsd, 
      priceUsd,
      priceIdr,
      change24h: change24h ? Number(change24h.toFixed(2)) : null,
      provider: "coingecko" 
    });
  } catch (error: any) {
    console.error("Error fetching crypto price:", error);
    return Response.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
