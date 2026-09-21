"""NAVER Maps setup endpoints. Credentials remain on the server."""
import json
import html
import re
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).with_name('.env'))
router = APIRouter(prefix='/api/maps', tags=['maps'])
BASE_URL = 'https://maps.apigw.ntruss.com'
SEARCH_URL = 'https://naverapihub.apigw.ntruss.com/search/v1/local'


def naver_get(path, params):
    client_id = os.getenv('NAVER_MAP_CLIENT_ID', '').strip()
    secret = os.getenv('NAVER_MAP_CLIENT_SECRET', '').strip()
    if not client_id or not secret:
        raise HTTPException(503, 'backend/.env에 NAVER_MAP_CLIENT_ID와 NAVER_MAP_CLIENT_SECRET을 입력하고 서버를 재시작하세요.')
    request = Request(BASE_URL + path + '?' + urlencode(params), headers={
        'x-ncp-apigw-api-key-id': client_id,
        'x-ncp-apigw-api-key': secret,
    })
    try:
        with urlopen(request, timeout=12) as upstream:
            return json.load(upstream)
    except HTTPError as exc:
        # Do not forward upstream bodies or credential-bearing request objects.
        if exc.code in (401, 403):
            raise HTTPException(502, '네이버 인증 실패: Maps Application의 Client ID·Secret을 확인하세요.') from None
        if exc.code == 429:
            raise HTTPException(503, '네이버 API 선택 여부 또는 호출 한도를 확인하세요.') from None
        raise HTTPException(502, '네이버 지도 API 요청에 실패했습니다.') from None
    except (URLError, TimeoutError, ValueError):
        raise HTTPException(502, '네이버 지도 서버 연결 또는 응답을 확인하지 못했습니다. 다시 시도하세요.') from None


@router.get('/config')
def maps_config(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    client_id = os.getenv('NAVER_MAP_CLIENT_ID', '').strip()
    return {'clientId': client_id, 'restConfigured': bool(client_id and os.getenv('NAVER_MAP_CLIENT_SECRET', '').strip())}


@router.get('/geocode')
def geocode(query: str = Query(min_length=2, max_length=200)):
    data = naver_get('/map-geocode/v2/geocode', {'query': query, 'count': 5})
    if data.get('status') != 'OK':
        raise HTTPException(502, '주소 검색 응답을 확인하지 못했습니다.')
    return {'addresses': [{
        'roadAddress': item.get('roadAddress', ''),
        'jibunAddress': item.get('jibunAddress', ''),
        'englishAddress': item.get('englishAddress', ''),
        'lat': float(item['y']), 'lng': float(item['x']),
    } for item in data.get('addresses', [])]}


@router.get('/search')
def search_places(query: str = Query(min_length=2, max_length=200)):
    """Address search uses Maps; business search uses NAVER API HUB credentials."""
    places = []
    address_error = None
    try:
        for item in geocode(query)['addresses']:
            name = item['roadAddress'] or item['jibunAddress'] or item['englishAddress']
            places.append({**item, 'id': f"address-{item['lat']}-{item['lng']}",
                           'name': name, 'address': '', 'category': '주소', 'dwell': 0})
    except HTTPException as exc:
        address_error = exc
    client = os.getenv('NAVER_SEARCH_CLIENT_ID', '').strip()
    secret = os.getenv('NAVER_SEARCH_CLIENT_SECRET', '').strip()
    if client and secret:
        request = Request(SEARCH_URL + '?' + urlencode({'query': query, 'display': 5, 'format': 'json'}), headers={
            'X-NCP-APIGW-API-KEY-ID': client, 'X-NCP-APIGW-API-KEY': secret,
        })
        try:
            with urlopen(request, timeout=12) as upstream:
                data = json.load(upstream)
            if not isinstance(data, dict) or not isinstance(data.get('items'), list):
                raise ValueError('Invalid search response')
            for item in data['items']:
                try:
                    lat, lng = float(item['mapy']), float(item['mapx'])
                    # Search responses use WGS84, commonly scaled by 10^7.
                    if abs(lat) > 90 and abs(lng) > 180:
                        lat, lng = lat / 10000000, lng / 10000000
                    p = Point(lat=lat, lng=lng)
                except (KeyError, TypeError, ValueError):
                    continue
                # Reject legacy/non-WGS84 coordinates instead of routing to the wrong country.
                if not (33 <= p.lat <= 39 and 124 <= p.lng <= 132):
                    continue
                places.append({'id': f'place-{p.lat}-{p.lng}', 'lat': p.lat, 'lng': p.lng,
                               'name': html.unescape(re.sub(r'<[^>]*>', '', str(item.get('title', '')))),
                               'address': item.get('roadAddress') or item.get('address', ''),
                               'category': item.get('category', ''), 'dwell': 0})
        except (HTTPError, URLError, TimeoutError, ValueError):
            if not places:
                raise HTTPException(503, '장소 검색을 완료하지 못했습니다. 주소로 검색하거나 지도에서 선택하세요.') from None
    if not places and address_error:
        raise address_error
    return {'places': places}


@router.get('/reverse')
def reverse(lat: float = Query(ge=-90, le=90), lng: float = Query(ge=-180, le=180)):
    data = naver_get('/map-reversegeocode/v2/gc', {
        'coords': f'{lng},{lat}', 'sourcecrs': 'epsg:4326',
        'orders': 'roadaddr,addr', 'output': 'json',
    })
    code = data.get('status', {}).get('code')
    if code not in (0, 3):  # 3: no matching address
        raise HTTPException(502, '좌표의 주소를 확인하지 못했습니다.')
    return {'results': data.get('results', [])}


class Point(BaseModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)


class RouteRequest(BaseModel):
    start: Point
    goal: Point
    waypoints: list[Point] = Field(default_factory=list, max_length=5)


class ApproachRequest(BaseModel):
    start: Point
    goal: Point


@router.post('/approach')
def approach(body: ApproachRequest):
    """Compare NAVER's supported routes without passenger waypoints."""
    candidates = []
    for options in [('traoptimal', 'trafast', 'tracomfort'), ('traavoidtoll', 'traavoidcaronly')]:
        data = naver_get('/map-direction/v1/driving', {
            'start': f'{body.start.lng},{body.start.lat}',
            'goal': f'{body.goal.lng},{body.goal.lat}', 'option': ':'.join(options),
        })
        if data.get('code') != 0:
            continue
        for option in options:
            candidates.extend(data.get('route', {}).get(option, []))
    if not candidates:
        raise HTTPException(422, '차량에서 출발지까지 자동차 경로를 찾지 못했습니다.')
    route = min(candidates, key=lambda r: (r['summary']['distance'], r['summary']['duration']))
    return {'points': [[lat, lng] for lng, lat in route['path']],
            'distanceMeters': route['summary']['distance'],
            'durationSeconds': route['summary']['duration'] / 1000,
            'strategy': 'shortest-returned', 'candidateCount': len(candidates)}


@router.post('/directions')
def directions(body: RouteRequest):
    def coord(point):
        return f'{point.lng},{point.lat}'
    params = {'start': coord(body.start), 'goal': coord(body.goal), 'option': 'traoptimal'}
    if body.waypoints:
        params['waypoints'] = '|'.join(coord(point) for point in body.waypoints)
    data = naver_get('/map-direction/v1/driving', params)
    if data.get('code') != 0:
        raise HTTPException(422, '자동차 경로를 찾지 못했습니다. 출발지·목적지·경유지를 도로 가까운 위치로 변경하세요.')
    routes = data.get('route', {}).get('traoptimal', [])
    if not routes:
        raise HTTPException(422, '검색된 자동차 경로가 없습니다.')
    route = routes[0]
    return {
        'points': [[lat, lng] for lng, lat in route['path']],
        'distanceMeters': route['summary']['distance'],
        'durationSeconds': route['summary']['duration'] / 1000,
    }
