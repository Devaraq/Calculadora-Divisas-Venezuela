import { useState, useEffect } from 'react';
import { Rates } from '../types';

export function useRates() {
  const [rates, setRates] = useState<Rates>({
    bcv: null,
    usdt: null,
    isError: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRates() {
      try {
        const res = await fetch('/api/rates');
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        
        setRates({
          bcv: data.bcv || null,
          usdt: data.usdt || null,
          isError: !data.bcv && !data.usdt,
        });
      } catch (err) {
        console.error(err);
        setRates(prev => ({ ...prev, isError: true }));
      } finally {
        setLoading(false);
      }
    }
    fetchRates();
  }, []);

  return { rates, loading };
}
