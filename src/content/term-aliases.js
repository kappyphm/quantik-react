import {glossary} from './glossary.js';

const aliases = glossary.map(term => ({text:term.en,id:term.id}));
aliases.push(...[
  ['HMM','hmm'], ['AnnRet','annual_return'], ['MaxDD','max_drawdown'],
  ['Max drawdown','max_drawdown'], ['Monte Carlo','monte_carlo'], ['MC','monte_carlo'],
  ['Quant Factor','quant_factor'], ['Quant Factors','quant_factor'],
  ['Quant factor','quant_factor'], ['quant factor','quant_factor'],
  ['Quant','quant_score'], ['RR','risk_reward'],
].map(([text,id])=>({text,id})));
const unique = [...new Map(aliases.map(a=>[a.text.toLowerCase(),a])).values()]
  .sort((a,b)=>b.text.length-a.text.length);
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern = new RegExp(`(?<![a-z0-9_])(${unique.map(a=>escape(a.text)).join('|')})(?![a-z0-9_])`,'gi');
const lookup = new Map(unique.map(a=>[a.text.toLowerCase(),a.id]));

/** Preserve the original report text and annotate only complete known terms. */
export function tokenizeTerms(text='') {
  const chunks=[];let cursor=0;
  for(const match of String(text).matchAll(pattern)) {
    if(match.index>cursor)chunks.push({text:text.slice(cursor,match.index)});
    chunks.push({text:match[0],id:lookup.get(match[0].toLowerCase())});
    cursor=match.index+match[0].length;
  }
  if(cursor<text.length)chunks.push({text:text.slice(cursor)});
  return chunks;
}
