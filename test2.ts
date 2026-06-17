async function testBinance() {
  const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "asset": "USDT", 
      "fiat": "VES", 
      "merchantCheck": false, 
      "page": 1, 
      "payTypes": [], 
      "publisherType": "merchant", 
      "rows": 3, 
      "tradeType": "BUY"
    })
  });
  const data = await res.json();
  console.log(data);
}
testBinance();
