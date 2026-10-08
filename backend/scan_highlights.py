"""Select an honest, deterministic 5/5 from one published snapshot; no model runs."""
from __future__ import annotations
import copy
import unicodedata
import math

RULE_VERSION = 'highlights-v1'

def action_kind(row):
    raw = row.get('action') or row.get('recommendation') or ''
    text = ''.join(c for c in unicodedata.normalize('NFD', raw) if not unicodedata.combining(c)).replace('đ', 'd').replace('Đ', 'D').upper().strip()
    if text in {'AVOID', 'TRANH', 'BAN', 'SELL'}: return 'AVOID'
    if text in {'BUY_NOW', 'MUA NGAY', 'MUA'}: return 'BUY_NOW'
    if text in {'BUY_SETUP', 'BUY', 'CANH MUA'}: return 'BUY_SETUP'
    if 'WATCH' in text or 'THEO DOI' in text: return 'WATCH'
    return 'UNKNOWN'

def select_highlights(snapshot):
    rows = snapshot['rows']
    eligible = [r for r in rows if isinstance(r.get('score'),(int,float)) and not isinstance(r['score'],bool) and math.isfinite(r['score']) and 0 <= r['score'] <= 100
                and str(r.get('data_quality_status') or '').upper() not in {'FAIL', 'FAILED', 'ERROR'}
                and str(r.get('analysis_status') or '').lower() not in {'failed', 'error'}]
    priority = {'BUY_NOW': 0, 'BUY_SETUP': 1, 'WATCH': 2, 'UNKNOWN': 3}
    def rank(r):
        kind = action_kind(r)
        if kind in {'BUY_NOW', 'BUY_SETUP'} and r.get('gate_pass', r.get('passed')) is not True: return 3
        return priority[kind]
    opportunities = sorted((r for r in eligible if action_kind(r) != 'AVOID'),
                           key=lambda r: (rank(r), -r['score'], r['symbol']))[:5]
    chosen = {r['symbol'] for r in opportunities}
    cautions = sorted((r for r in eligible if r['symbol'] not in chosen),
                      key=lambda r: (0 if action_kind(r) == 'AVOID' else 1, r['score'], r['symbol']))[:5]
    result = copy.deepcopy({k: v for k, v in snapshot.items() if k != 'rows'})
    result.update(rows=copy.deepcopy(opportunities+cautions),
                  highlights={'opportunities': [r['symbol'] for r in opportunities], 'cautions': [r['symbol'] for r in cautions]},
                  analyzedCount=len(rows), eligibleCount=len(eligible), excludedCount=len(rows)-len(eligible),
                  buyNowCount=sum(action_kind(r) == 'BUY_NOW' and r.get('gate_pass', r.get('passed')) is True for r in eligible),
                  selectionRuleVersion=RULE_VERSION)
    return result
