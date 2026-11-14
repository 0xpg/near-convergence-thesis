import sys, os, json, time, hashlib, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from universe import UNIVERSE, DATATYPES
RAW = sys.argv[1]
os.makedirs(os.path.join(RAW, 'llama'), exist_ok=True)
os.makedirs(os.path.join(RAW, 'cmc'), exist_ok=True)
UA = {'User-Agent': 'research-script/1.0', 'Accept': 'application/json'}
log = []

def get(url, path, tries=3):
    if os.path.exists(path) and os.path.getsize(path) > 50:
        b = open(path, 'rb').read()
        log.append({'url': url, 'file': os.path.relpath(path, RAW), 'status': 'cached', 'sha256': hashlib.sha256(b).hexdigest()})
        return b
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            b = urllib.request.urlopen(req, timeout=60).read()
            open(path, 'wb').write(b)
            log.append({'url': url, 'file': os.path.relpath(path, RAW), 'status': 200, 'sha256': hashlib.sha256(b).hexdigest(), 'retrieved': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())})
            time.sleep(0.4)
            return b
        except urllib.error.HTTPError as e:
            if e.code in (400, 404, 500):
                log.append({'url': url, 'status': e.code})
                return None
            time.sleep(3 * (t + 1))
        except Exception as e:
            time.sleep(3 * (t + 1))
    log.append({'url': url, 'status': 'failed'})
    return None
resolved = {}
for name, group, slugs, cmc_ids in UNIVERSE:
    chosen = None
    for s in slugs:
        url = f'https://api.llama.fi/summary/fees/{s}?dataType=dailyRevenue'
        p = os.path.join(RAW, 'llama', f"{s.replace('.', '_')}__dailyRevenue.json")
        b = get(url, p)
        if b:
            try:
                d = json.loads(b)
                if d.get('totalDataChart'):
                    chosen = s
                    break
            except Exception:
                pass
    if chosen:
        for dt in DATATYPES[1:]:
            get(f'https://api.llama.fi/summary/fees/{chosen}?dataType={dt}', os.path.join(RAW, 'llama', f"{chosen.replace('.', '_')}__{dt}.json"))
    start, end = (1483228800, 1794700800)
    for cid in cmc_ids:
        t = start
        while t < end:
            t2 = min(t + 700 * 86400, end)
            get(f'https://api.coinmarketcap.com/data-api/v3/cryptocurrency/historical?id={cid}&convertId=2781&timeStart={t}&timeEnd={t2}&interval=daily', os.path.join(RAW, 'cmc', f'{cid}_{t}.json'))
            t = t2
    resolved[name] = {'group': group, 'llama_slug': chosen, 'cmc_ids': cmc_ids}
    print(name, chosen, flush=True)
json.dump(resolved, open(os.path.join(RAW, 'resolved.json'), 'w'), indent=1)
json.dump(log, open(os.path.join(RAW, 'fetch_log.json'), 'w'), indent=1)
