import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/rates', async (req, res) => {
    try {
      // Fetch BCV Official Rate
      const bcvRes = await fetch('https://ve.dolarapi.com/v1/dolares');
      const bcvData = await bcvRes.json();
      const bcvRate = bcvData.find((d: any) => d.casa === 'oficial')?.venta;

      // Fetch Binance P2P USDT Rate
      const binanceRes = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        body: JSON.stringify({
          asset: "USDT",
          fiat: "VES",
          merchantCheck: false,
          page: 1,
          payTypes: [],
          publisherType: "merchant",
          rows: 3,
          tradeType: "BUY"
        })
      });
      const binanceData = await binanceRes.json();
      let usdtRate: number | null = null;
      if (binanceData?.data?.[0]?.adv?.price) {
        usdtRate = parseFloat(binanceData.data[0].adv.price);
      }

      res.json({
        bcv: bcvRate,
        usdt: usdtRate
      });
    } catch (error) {
      console.error('Error fetching rates from API:', error);
      res.status(500).json({ error: 'Failed to fetch rates' });
    }
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
