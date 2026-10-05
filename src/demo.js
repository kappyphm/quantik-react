import {demoSnapshot,instruments} from './market.js';
export const demoRows=demoSnapshot.quotes.map(r=>({...r,sym:r.symbol,name:instruments.find(i=>i.symbol===r.symbol)?.name||r.symbol}));
