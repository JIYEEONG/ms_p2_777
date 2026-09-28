"""Conservative venue aliases for the first places in the 1,000-course plan.

Search aliases improve recall; they never make category-only titles relevant.
Every tuple in ``required`` is an OR group, and all groups must match. Thus a
brand with several branches still needs an explicit branch/location in a title.
These are candidate checks, not a substitute for reviewing the actual photo.

The official Seoul Facilities Corporation lists 잠실역 and 잠실지하광장 as
different shopping centres, so those names must not be used interchangeably:
https://www.sisul.or.kr/open_content/undershop/guide/gangnam/jamsil_center.jsp
The city calls its City Hall exhibition space 하늘광장 갤러리:
https://mediahub.seoul.go.kr/archives/2019123
"""
from __future__ import annotations

from dataclasses import dataclass
import html
import re


def normalized(value: str) -> str:
    value = html.unescape(re.sub(r"<[^>]+>", "", value or ""))
    return re.sub(r"[^\w가-힣]", "", value).lower()


@dataclass(frozen=True)
class PlaceRule:
    queries: tuple[str, ...]
    required: tuple[tuple[str, ...], ...]


# The first query is the most specific useful spelling. Tokens below remain
# tied to venue identity, never merely coffee/food/gallery/shopping categories.
RULES = {
    "태양커피 서울사당점": PlaceRule(
        ("태양커피 사당점", "사당 태양커피", "태양커피 방배천로 32"),
        (("태양커피",), ("사당", "방배천로32")),
    ),
    "구씨네부엌": PlaceRule(
        ("구씨네부엌", "홍대 구씨네 부엌", "구씨네부엌 신촌",
         "홍대 구씨네부엌 피자", "구씨네부엌 파스타", '"구씨네부엌"'),
        (("구씨네부엌",),),
    ),
    "신도림이도식당": PlaceRule(
        ("신도림 이도식당", "이도식당 신도림", "이도식당 경인로 661"),
        (("이도식당",), ("신도림", "경인로661")),
    ),
    "커넥트투": PlaceRule(
        ("커넥트투 잠실", "커넥트투 롯데월드몰", "CONNECT TO 잠실"),
        (("커넥트투", "connectto"),),
    ),
    "갓잇 문래점": PlaceRule(
        ("갓잇 문래점", "문래 갓잇", "갓잇 경인로77길 14"),
        (("갓잇", "godeat"), ("문래", "경인로77길14")),
    ),
    "서울특별시청 하늘광장갤러리": PlaceRule(
        ("서울시청 하늘광장 갤러리", "하늘광장갤러리", "시청 하늘광장갤러리 전시"),
        (("하늘광장갤러리",),),
    ),
    "문화역서울284": PlaceRule(
        ("문화역서울284", "문화역 서울 284", "문화역서울 284 전시"),
        (("문화역서울284",),),
    ),
    "그라운드시소 센트럴": PlaceRule(
        ("그라운드시소 센트럴", "센트럴 그라운드시소", "그라운드시소 센트럴 전시"),
        (("그라운드시소", "groundseesaw"), ("센트럴", "central")),
    ),
    "로얄마카롱": PlaceRule(
        ("로얄마카롱", "서울 로얄마카롱", "로얄마카롱 매장"),
        (("로얄마카롱",),),
    ),
    "일편등심 강남": PlaceRule(
        ("일편등심 강남점", "강남 일편등심", "일편등심 테헤란로1길 20"),
        (("일편등심",), ("강남", "테헤란로1길20")),
    ),
    "잠실지하광장 쇼핑센터": PlaceRule(
        ("잠실지하광장 쇼핑센터", "잠실 지하광장", "잠실지하광장 상가", "잠실역 지하광장"),
        (("잠실지하광장", "잠실역지하광장"),),
    ),
    "동대문디자인플라자 디자인전시관": PlaceRule(
        ("DDP 디자인전시관", "동대문디자인플라자 디자인전시관", "DDP 뮤지엄 디자인전시관"),
        (("동대문디자인플라자", "ddp"), ("디자인전시관",)),
    ),
    "노란돼지": PlaceRule(
        ("노란돼지 사당", "노란돼지 방배", "노란돼지 동작대로7길 97"),
        (("노란돼지",), ("사당", "방배", "동작대로7길97")),
    ),
    "아트팩토리체험공방": PlaceRule(
        ("아트팩토리 체험공방", "아트팩토리 왕십리", "아트팩토리 왕십리로 241"),
        (("아트팩토리",), ("체험공방", "왕십리", "왕십리로241")),
    ),
    "정동전망대": PlaceRule(
        ("정동전망대", "정동 전망대", "정동전망대 덕수궁"),
        (("정동전망대",),),
    ),
    "브이스퀘어": PlaceRule(
        ("브이스퀘어 건대", "브이스퀘어 롯데시네마", "V SQUARE 건대입구"),
        (("브이스퀘어", "vsquare"), ("건대", "롯데시네마", "스타시티", "아차산로272")),
    ),
    "만동제과": PlaceRule(
        ("만동제과 연남점", "만동제과 홍대", "만동제과 연희로 32"),
        (("만동제과",), ("연남", "홍대", "연희로32")),
    ),
    "건국대학교 일감호": PlaceRule(
        ("건국대학교 일감호", "건대 일감호", "일감호"),
        (("일감호",),),
    ),
    "꿈동산 동심쇼핑센터": PlaceRule(
        ("꿈동산 동심쇼핑센터", "동심쇼핑센터", "창신동 동심 쇼핑센터"),
        (("동심쇼핑센터",),),
    ),
    "타이파": PlaceRule(
        ("왕십리 타이파", "한양대 타이파", "타이파 마조로 24"),
        (("타이파", "typa"), ("왕십리", "한양대", "마조로24")),
    ),
    "덕수궁 대한문": PlaceRule(
        ("덕수궁 대한문", "대한문", "덕수궁 대한문 전경"),
        (("대한문",),),
    ),
    "초류향": PlaceRule(
        ("초류향 다동", "초류향 을지로", "초류향 다동길 24-10"),
        (("초류향",), ("다동", "을지로", "무교", "다동길2410")),
    ),
}
_NORMALIZED_RULES = {normalized(name): rule for name, rule in RULES.items()}


def search_queries(place: str, address: str = "") -> list[str]:
    """Return venue-specific queries, keeping branch names in every variant."""
    rule = _NORMALIZED_RULES.get(normalized(place))
    base = list(rule.queries) if rule else [place.strip()]
    # Address context may help search ranking; it must never be injected into
    # result titles to manufacture evidence that the pictured venue matches.
    if address.strip():
        base.append(f"{base[0]} {address.strip()}")
    return list(dict.fromkeys(query for query in base if query))


def relevant(place: str, title: str, address: str = "") -> bool:
    """Require venue identity in the result title, including known branches.

    ``address`` is accepted for callers that carry it alongside the venue but
    is deliberately not added to title evidence. Unknown venues require their
    complete supplied name, avoiding unsafe automatic name shortening.
    """
    name, candidate = normalized(place), normalized(title)
    if not name or not candidate:
        return False
    rule = _NORMALIZED_RULES.get(name)
    if not rule:
        return name in candidate
    # English "connect to" also occurs in ordinary technical text. Its Latin
    # spelling needs this venue's location, even though 커넥트투 is distinctive.
    if name == normalized("커넥트투") and normalized("커넥트투") not in candidate:
        if not any(normalized(token) in candidate for token in ("잠실", "롯데월드몰")):
            return False
    return all(any(normalized(token) in candidate for token in alternatives)
               for alternatives in rule.required)
