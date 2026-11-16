#!/usr/bin/env python3
"""Validate a dashboard live-data file (data/live.js) before the dashboard loads it.

Read-only: this script only reads the file you pass. It never contacts Salesforce.
Usage:  python3 validate_live.py data/live.js      exit 0 = OK, 1 = problems found
"""
import json, re, sys

ST_BU = {'ok', 'bad'}
ST_J = {'ok', 'bad', 'warn', 'none'}
ST_R = {'Open', 'Retried OK', 'Suppressed'}
SEV = {'bad', 'warn', 'info'}
KINDS = {'birthday', 'welcome', 'tier', 'expiry', 'reactivate'}


def load(path):
    src = open(path, encoding='utf-8').read()
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)  # drop comments first (they may contain examples)
    m = re.search(r'window\.SAMAT_LIVE\s*=\s*(.*?);?\s*$', src.strip(), re.S)
    if not m:
        raise ValueError('file must assign window.SAMAT_LIVE = {...}')
    body = m.group(1).strip()
    if body.startswith('window.SAMAT_LIVE ||'):
        body = body.split('||', 1)[1].strip()
    if body in ('null', ''):
        return None
    if re.search(r'\bfunction\b|=>|<script|`', body):
        raise ValueError('only plain data is allowed (no functions, arrows, template strings or script tags)')
    # allow JS object keys without quotes by quoting them, then parse strictly as JSON
    js = re.sub(r'(?<=[{,\s])([A-Za-z_]\w*)\s*:', r'"\1":', body)
    js = js.replace("'", '"')
    js = re.sub(r'/\*.*?\*/', '', js, flags=re.S)
    return json.loads(js)


def main(path):
    probs = []
    try:
        d = load(path)
    except Exception as e:  # noqa: BLE001
        print(f'FAIL  {e}')
        return 1
    if d is None:
        print('OK    live.js is empty – the dashboard will show demo data')
        return 0
    if not isinstance(d, dict):
        print('FAIL  top level must be an object')
        return 1
    for b in d.get('bus', []):
        if not b.get('k'):
            probs.append('bus entry without k (market key)')
        if b.get('st') not in ST_BU:
            probs.append(f"bus {b.get('k')}: st must be one of {sorted(ST_BU)}")
    jids = set()
    for j in d.get('journeys', []):
        jid = j.get('id')
        if not jid:
            probs.append('journey without id')
            continue
        jids.add(jid)
        if j.get('st') not in ST_J:
            probs.append(f'journey {jid}: st must be one of {sorted(ST_J)}')
        if j.get('k') not in KINDS:
            probs.append(f'journey {jid}: k must be one of {sorted(KINDS)}')
        if not isinstance(j.get('in', 0), (int, float)) or j.get('in', 0) < 0:
            probs.append(f'journey {jid}: in must be a number ≥ 0')
        if not isinstance(j.get('err', {}), dict):
            probs.append(f'journey {jid}: err must be an object {{code: count}}')
    for r in d.get('records', []):
        rid = r.get('id', '?')
        if r.get('j') not in jids and r.get('j') != 'CHK':
            probs.append(f"record {rid}: j '{r.get('j')}' is not a journey id (use 'CHK' for daily checks)")
        if r.get('st', 'Open') not in ST_R:
            probs.append(f'record {rid}: st must be one of {sorted(ST_R)}')
        if r.get('sev', 'warn') not in SEV:
            probs.append(f'record {rid}: sev must be one of {sorted(SEV)}')
        if not r.get('code'):
            probs.append(f'record {rid}: missing error code')
    for s in d.get('schedule', []):
        if not (isinstance(s, list) and len(s) == 2 and re.fullmatch(r'\d{2}:\d{2}', str(s[1]))):
            probs.append(f'schedule entry {s}: must be ["journeyId","HH:MM"]')
        elif s[0] not in jids:
            probs.append(f'schedule entry {s}: unknown journey id')
    if probs:
        for p in probs[:50]:
            print('FAIL ', p)
        print(f'{len(probs)} problem(s) – fix them before loading the dashboard')
        return 1
    print(f"OK    {len(d.get('bus', []))} markets · {len(jids)} journeys · {len(d.get('records', []))} records")
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else 'data/live.js'))
