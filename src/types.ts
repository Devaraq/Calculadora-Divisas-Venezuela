export type Currency = 'BS' | 'USD' | 'USDT';
export type RateSource = 'BCV' | 'USDT_P2P';


export interface Rates {
  bcv: number | null;
  usdt: number | null;
  isError: boolean;
}

export interface ManualRates {
  bcv: number;
  usdt: number;
}
