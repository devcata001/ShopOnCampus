#!/usr/bin/env python3
import json
import re
import statistics
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_FILE = ROOT / 'data' / 'products-data.js'
OVERRIDES_FILE = ROOT / 'data' / 'price-overrides.js'

USD_TO_NGN = 1600
TIMEOUT = 15
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

SOURCES = [
    ('jumia', 'https://www.jumia.com.ng/catalog/?q={query}'),
    ('konga', 'https://www.konga.com/search?search={query}'),
    ('amazon', 'https://www.amazon.com/s?k={query}'),
    ('ebay', 'https://www.ebay.com/sch/i.html?_nkw={query}'),
    ('aliexpress', 'https://www.aliexpress.com/wholesale?SearchText={query}')
]

NGN_PATTERN = re.compile(r'₦\s*([0-9][0-9,\.]+)')
USD_PATTERN = re.compile(r'\$\s*([0-9][0-9,\.]+)')


def parse_products_js(js_text: str):
    start = js_text.find('window.INSIDE_PRODUCTS = [')
    end = js_text.rfind(']')
    if start == -1 or end == -1:
        return []

    block = js_text[start:end+1]
    names = re.findall(r"\{\s*id:\s*(\d+),\s*name:\s*'([^']+)'", block)
    products = [{'id': int(pid), 'name': name} for pid, name in names]
    return products


def fetch(url: str):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read().decode('utf-8', 'ignore')


def to_number(raw: str):
    cleaned = raw.replace(',', '').strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def extract_price_candidates(html: str, source: str):
    values = []

    for match in NGN_PATTERN.findall(html):
        val = to_number(match)
        if val and 100 <= val <= 50000000:
            values.append(val)

    if source in ('amazon', 'ebay', 'aliexpress'):
        for match in USD_PATTERN.findall(html):
            val = to_number(match)
            if val and 1 <= val <= 50000:
                values.append(val * USD_TO_NGN)

    return values


def pick_representative(values):
    unique = sorted(set(int(v) for v in values if v > 0))
    if not unique:
        return None
    return unique[0]


def median(values):
    if not values:
        return None
    return int(round(statistics.median(values)))


def main():
    js_text = PRODUCTS_FILE.read_text(encoding='utf-8')
    products = parse_products_js(js_text)

    overrides = {}
    report = []

    for product in products:
        name = product['name']
        query = urllib.parse.quote_plus(name)

        found_prices = []
        found_sources = []

        for source_name, template in SOURCES:
            url = template.format(query=query)
            try:
                html = fetch(url)
            except Exception:
                continue

            candidates = extract_price_candidates(html, source_name)
            chosen = pick_representative(candidates)
            if chosen is not None:
                found_prices.append(chosen)
                found_sources.append(source_name)

        med = median(found_prices)
        if med is not None:
            overrides[str(product['id'])] = med

        report.append({
            'id': product['id'],
            'name': name,
            'sources_used': found_sources,
            'prices': found_prices,
            'median_ngn': med
        })

    payload = {
        'currency': 'NGN',
        'rule': 'median',
        'sources': ['Jumia', 'Konga', 'Amazon', 'eBay', 'AliExpress'],
        'updatedAt': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
        'overrides': overrides
    }

    content = 'window.INSIDE_PRICE_OVERRIDES = ' + json.dumps(payload, indent=2) + '\n'
    OVERRIDES_FILE.write_text(content, encoding='utf-8')

    summary = {
        'products_total': len(products),
        'products_priced': len(overrides),
        'overrides_file': str(OVERRIDES_FILE),
        'sample': report[:10]
    }
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
