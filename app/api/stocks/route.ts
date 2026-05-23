import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return Response.json({ error: "Missing symbol parameter" }, { status: 400 });
  }

  try {
    // Yahoo Finance API
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      cache: "no-store"
    });

    if (!res.ok) {
      return Response.json({ error: `Yahoo Finance API error: ${res.statusText}` }, { status: res.status });
    }

    const data = await res.json();
    if (!data || !data.chart || !data.chart.result || data.chart.result.length === 0) {
      return Response.json({ error: "No data found for symbol" }, { status: 404 });
    }

    const meta = data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const currency = meta.currency || "USD";
    const shortName = meta.shortName || meta.symbol || symbol;

    if (price === undefined || price === null) {
      // Fallback: check indicators.quote[0].close array for last value
      const quote = data.chart.result[0].indicators?.quote?.[0];
      const closePrices = quote?.close;
      if (closePrices && closePrices.length > 0) {
        const validPrices = closePrices.filter((p: any) => p !== null && p !== undefined);
        const lastPrice = validPrices.pop();
        if (lastPrice !== undefined) {
          return Response.json({ symbol, price: lastPrice, currency, name: shortName, provider: "yahoo" });
        }
      }
      return Response.json({ error: "Price not found in metadata" }, { status: 404 });
    }

    return Response.json({ symbol, price, currency, name: shortName, provider: "yahoo" });
  } catch (error: any) {
    console.error("Error fetching stock price:", error);
    return Response.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
