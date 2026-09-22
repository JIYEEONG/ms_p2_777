"""Collect public Wikimedia photos and source metadata; no image generation API.

Search results are reviewed before choosing entries for the app's photo catalog.
Working downloads stay in the system temp directory until explicitly selected.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import html
import json
from pathlib import Path
import re
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

WORK = Path(tempfile.gettempdir()) / 'moov-course-photo-review'
AGENT = 'MoovCoursePhotoCatalog/1.0 (public photo research)'
QUERIES = {
    'coffee': 'latte coffee cup',
    'cafe': 'cafe interior Korea',
    'bakery': 'croissant bakery bread',
    'macaron': 'macarons dessert',
    'korean-food': 'Korean food bibimbap',
    'grill': 'Korean barbecue samgyeopsal',
    'steak': 'steak grilled beef',
    'seafood': 'sashimi platter',
    'taco': 'Mexican tacos plate',
    'gallery': 'art gallery interior exhibition',
    'gallery-modern': 'contemporary art museum exhibition interior -intitle:HKU',
    'gallery-paintings': 'art gallery paintings interior -intitle:HKU',
    'gallery-tate': 'intitle:"Tate Modern" interior',
    'gallery-seoul': 'intitle:"Seoul Museum of Art"',
    'seoul284': 'Culture Station Seoul 284',
    'ddp': 'Dongdaemun Design Plaza',
    'city': 'Seoul skyline daylight',
    'park': 'Seoul Forest park',
    'lake': 'Seokchon lake',
    'hongdae': 'Hongdae street Seoul',
    'shopping': 'shopping mall Seoul interior',
    'craft': 'pottery ceramic workshop',
    'technology': 'robot exhibition museum',
    'palace': 'Gyeongbokgung palace',
    'city-view': 'Seoul skyline',
    'mall': 'shopping mall interior',
    'pottery': 'potter wheel ceramics',
    'cafe-space': 'coffee shop interior -intitle:North -intitle:Pyongyang -intitle:Kitty',
}


def get(url):
    request = urllib.request.Request(url, headers={'User-Agent': AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 3:
                raise
            delay = max(20*(attempt+1), int(error.headers.get('Retry-After', '0')))
            print('Rate limited; waiting', delay, 'seconds', flush=True)
            time.sleep(delay)


def plain(value):
    return html.unescape(re.sub('<[^>]*>', '', value or '')).strip()


def search(item):
    topic, query = item
    cache = WORK / (topic + '.json')
    if cache.exists():
        return json.loads(cache.read_text(encoding='utf-8'))
    params = {'action':'query','format':'json','generator':'search',
              'gsrsearch':query + ' filetype:bitmap','gsrnamespace':6,'gsrlimit':12,
              'prop':'imageinfo','iiprop':'url|extmetadata|size','iiurlwidth':960}
    data = json.loads(get('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params)))
    rows = []
    for page in sorted(data.get('query',{}).get('pages',{}).values(), key=lambda p:p.get('index',0)):
        info = page.get('imageinfo',[{}])[0]
        meta = info.get('extmetadata',{})
        field = lambda key: plain(meta.get(key,{}).get('value',''))
        license = field('LicenseShortName')
        if not re.match(r'^(CC0|CC BY|Public domain)', license):
            continue
        if info.get('width',0) < 800 or info.get('width',0) / max(1,info.get('height',0)) < 1.15:
            continue
        if not info.get('url','').split('?')[0].lower().endswith(('.jpg','.jpeg','.png')):
            continue
        title = page['title']
        key = topic + '-' + hashlib.sha256(title.encode()).hexdigest()[:10]
        rows.append({'id':key,'topic':topic,'title':title,'page':info['descriptionurl'],
                     'url':info.get('thumburl',info['url']).split('?')[0],
                     'author':field('Artist'),'license':license,'licenseUrl':field('LicenseUrl'),
                     'description':field('ImageDescription')[:900]})
    cache.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    return rows


def download(row):
    path = WORK / (row['id'] + '.jpg')
    if not path.exists():
        try:
            content = get(row['url'])
            if not content.startswith((b'\xff\xd8',b'\x89PNG')):
                raise ValueError('Not a raster photo')
            path.write_bytes(content)
        except Exception as error:
            return row['id'],str(error)
    return row['id'],None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action',choices=['search','download','publish'])
    parser.add_argument('--per-topic',type=int,default=3)
    args = parser.parse_args()
    WORK.mkdir(exist_ok=True)
    if args.action == 'search':
        groups = []
        for item in QUERIES.items():
            rows = search(item)
            groups.append(rows)
            print(item[0],len(rows),flush=True)
            time.sleep(1)
        rows = [row for group in groups for row in group]
        (WORK/'candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'directory':str(WORK),'counts':{topic:sum(r['topic']==topic for r in rows) for topic in QUERIES}},ensure_ascii=True))
    elif args.action == 'download':
        rows = json.loads((WORK/'candidates.json').read_text(encoding='utf-8'))
        selection = WORK/'selection.json'
        if selection.exists():
            selected = set(json.loads(selection.read_text(encoding='utf-8')))
            rows = [row for row in rows if row['id'] in selected]
        else:
            rows = [row for topic in QUERIES for row in [r for r in rows if r['topic']==topic][:args.per_topic]]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(download,rows))
        cards = ''.join('<article><img src="'+html.escape(row['id'])+'.jpg"><b>'+html.escape(row['id'])+'</b><p>'+html.escape(row['title'])+'</p></article>' for row in rows)
        (WORK/'review.html').write_text('<meta charset="utf-8"><style>body{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;font:13px system-ui}article{border:1px solid #ddd;padding:8px}img{width:100%;height:160px;object-fit:cover}b{display:block}p{margin:5px 0}</style>'+cards,encoding='utf-8')
        print(json.dumps({'downloaded':sum(error is None for _,error in results),'errors':[(key,error) for key,error in results if error],'directory':str(WORK)},ensure_ascii=True))
    else:
        root = Path(__file__).resolve().parents[1] / 'front' / 'public'
        destination = root / 'assets' / 'course-photos'
        destination.mkdir(exist_ok=True)
        ids = json.loads((WORK/'selection.json').read_text(encoding='utf-8'))
        candidates = {row['id']:row for row in json.loads((WORK/'candidates.json').read_text(encoding='utf-8'))}
        places = {'seoul284':['문화역서울284'], 'ddp':['동대문디자인플라자','DDP'],
                  'park':['서울숲','가족마당'], 'lake':['석촌호수'],
                  'hongdae':['홍대걷고싶은거리','홍대'], 'palace':['경복궁','근정전','경회루']}
        catalog, hashes = [],set()
        for key in ids:
            row = candidates[key]
            content = (WORK/(key+'.jpg')).read_bytes()
            digest = hashlib.sha256(content).hexdigest()
            if digest in hashes:
                raise ValueError('Duplicate photo: '+key)
            hashes.add(digest)
            (destination/(key+'.jpg')).write_bytes(content)
            catalog.append({'id':key,'src':'./assets/course-photos/'+key+'.jpg',
                            'topic':'gallery' if row['topic'].startswith('gallery-') else row['topic'],'places':places.get(row['topic'],[]),
                            'title':row['title'],'source':row['page'],'author':row['author'],
                            'license':row['license'],'licenseUrl':row['licenseUrl'] or row['page']+'#Licensing',
                            'downloadUrl':row['url'],'sha256':digest})
        source='(function(root){const photos='+json.dumps(catalog,ensure_ascii=False,indent=2)+';\nif(typeof module==="object"&&module.exports)module.exports=photos;else root.MoovCoursePhotos=photos;\n})(typeof globalThis==="object"?globalThis:this);\n'
        (root/'course-photos.js').write_text(source,encoding='utf-8')
        cards=[]
        for row in catalog:
            cards.append('<article><img loading="lazy" src="'+html.escape(row['src'].replace('./assets/','./'))+'"><h2>'+html.escape(row['title'])+'</h2><p>'+html.escape(row['author'])+'</p><p><a href="'+html.escape(row['source'],quote=True)+'">원본 사진 · Wikimedia Commons</a> · <a href="'+html.escape(row['licenseUrl'],quote=True)+'">'+html.escape(row['license'])+'</a></p></article>')
        (root/'assets'/'course-photo-library.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>코스 사진 정보</title><style>body{max-width:1100px;margin:30px auto;padding:20px;font:15px/1.6 system-ui;color:#253d33}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}img{width:100%;height:170px;object-fit:cover;border-radius:12px}h2{font-size:15px}a{color:#26784a}article{overflow-wrap:anywhere}</style><h1>코스 사진 정보</h1><p>공개 사진 '+str(len(catalog))+'장의 작가·출처·이용 조건입니다. Wikimedia의 960px 미리보기 파일을 그대로 사용하며 카드 비율에 맞게 표시합니다. 개별 작품의 이용 조건은 각 링크에서 확인할 수 있습니다. 일반 활동 사진은 해당 상호의 실제 매장 사진을 의미하지 않습니다.</p><p><a href="course-photo-credits.html">기존 장소 사진 정보</a></p><main>'+''.join(cards)+'</main>',encoding='utf-8')
        print(json.dumps({'published':len(catalog),'bytes':sum((destination/(key+'.jpg')).stat().st_size for key in ids)}))


if __name__ == '__main__':
    main()
