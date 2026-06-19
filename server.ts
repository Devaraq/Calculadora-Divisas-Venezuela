import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/rates', async (req, res) => {
    let bcvRate: number | null = null;
    let usdtRate: number | null = null;

    // 1. OBTENER TASA BCV OFICIAL - Usando ExchangeRate-API como fuente única y de alta disponibilidad
    try {
      console.log('Fetching BCV official rate via ExchangeRate-API (open.er-api.com)...');
      const erRes = await fetch('https://open.er-api.com/v6/latest/USD');
      if (erRes.ok) {
        const erData = await erRes.json();
        const rateVal = erData?.rates?.VES;
        if (rateVal && !isNaN(rateVal) && rateVal > 0) {
          bcvRate = Number(rateVal);
          console.log(`BCV rate successfully fetched from ExchangeRate-API: ${bcvRate}`);
        }
      }
    } catch (erError) {
      console.error('Failed to get rate from ExchangeRate-API:', erError);
    }

    // 2. OBTENER TASA USDT - Consultas directas a la API de Binance P2P promediando los 5 mejores anunciantes
    try {
      // Método principal: Endpoint público de anuncio publicitario (cug/v2/p2p/cug/advertiser/search)
      const binanceRes = await fetch('https://p2p.binance.com/bapi/cug/v2/p2p/cug/advertiser/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
          'Accept': '*/*'
        },
        body: JSON.stringify({
          asset: "USDT",
          fiat: "VES",
          merchantCheck: false,
          page: 1,
          payTypes: [],
          publisherType: null,
          rows: 10,
          tradeType: "BUY"
        })
      });

      if (binanceRes.ok) {
        const binanceData = await binanceRes.json();
        const adsList = binanceData?.data || [];
        if (adsList.length > 0) {
          // Promediar los primeros 5 anuncios válidos
          const validPrices: number[] = [];
          for (const item of adsList) {
            const rawPrice = item?.adv?.price || item?.price;
            if (rawPrice) {
              const priceNum = parseFloat(rawPrice);
              if (!isNaN(priceNum) && priceNum > 0) {
                validPrices.push(priceNum);
                if (validPrices.length >= 5) break;
              }
            }
          }
          if (validPrices.length > 0) {
            const sum = validPrices.reduce((a, b) => a + b, 0);
            usdtRate = parseFloat((sum / validPrices.length).toFixed(4));
            console.log(`USDT rate successfully calculated by averaging top ${validPrices.length} Binance P2P ads: ${usdtRate}`);
          }
        }
      }

      // Método secundario (Fallback): Endpoint de fallback tradicional (c2c/v2/friendly/c2c/adv/search)
      if (!usdtRate) {
        console.log('Primary Binance P2P search returned no results, attempting friendly search fallback...');
        const binanceFriendlyRes = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
            'Accept': '*/*'
          },
          body: JSON.stringify({
            asset: "USDT",
            fiat: "VES",
            merchantCheck: false,
            page: 1,
            payTypes: [],
            publisherType: "merchant",
            rows: 5,
            tradeType: "BUY"
          })
        });

        if (binanceFriendlyRes.ok) {
          const friendlyData = await binanceFriendlyRes.json();
          const adsListFriendly = friendlyData?.data || [];
          if (adsListFriendly.length > 0) {
            const validPricesFriendly: number[] = [];
            for (const item of adsListFriendly) {
              if (item?.adv?.price) {
                const priceNum = parseFloat(item.adv.price);
                if (!isNaN(priceNum) && priceNum > 0) {
                  validPricesFriendly.push(priceNum);
                  if (validPricesFriendly.length >= 5) break;
                }
              }
            }
            if (validPricesFriendly.length > 0) {
              const sum = validPricesFriendly.reduce((a, b) => a + b, 0);
              usdtRate = parseFloat((sum / validPricesFriendly.length).toFixed(4));
              console.log(`USDT rate recovered and averaged from friendly search fallback: ${usdtRate}`);
            }
          }
        }
      }
    } catch (binanceError) {
      console.error('Binance P2P direct calls failed:', binanceError);
    }

    // Retornamos las tasas. Si alguna es null, la interfaz del cliente aplicará un fallback seguro y notificará al usuario de manera fluida.
    res.json({
      bcv: bcvRate,
      usdt: usdtRate
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
