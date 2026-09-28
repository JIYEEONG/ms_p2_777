"""Collect review-only NAVER cover candidates from existing route stops.

Only courses lacking a published image are eligible. Destinations are preferred
unless repeated visual rejection favors another existing intermediate stop.
Route names, IDs, and existing images are never modified.
Aliases only remove redundant database labels or express the same venue with
its locality. Every result still needs venue identity in its own title.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import json
import sys
import urllib.parse

from naver_place_queries import RULES, normalized, relevant, search_queries
from prepare_naver_course_images import (
    ASSETS, MANIFEST, ROOT, WORK, SearchUnavailable, cached_download,
    canonical_url, plain, search, write_json,
)

PROGRESS = WORK / "fallback-progress.json"

# Each name is an existing route stop. These spellings retain venue/branch
# identity; they do not permit substitution with a nearby or generic place.
# For short names, require the actual locality as title evidence.
EXTRA_RULES = {
    "덕스(DUEX)": (["홍대 덕스", "홍대 DUEX"], (("덕스", "duex"), ("홍대", "양화로186"))),
    "한정선 잠실롯데월드몰점": (["한정선 잠실 롯데월드몰"], (("한정선",), ("잠실", "롯데월드몰"))),
    "BGN갤러리 롯데타워점": (["BGN갤러리 롯데타워", "잠실 BGN갤러리"], (("bgn갤러리",), ("잠실", "롯데타워", "롯데월드타워"))),
    "송파나루공원 삼전도비": (["삼전도비 석촌호수", "삼전도비 송파"], (("삼전도비",),)),
    "AC'SCENT(악센트)": (["악센트 신촌", "신촌 AC SCENT"], (("악센트", "acscent"), ("신촌", "연세로"))),
    "사당1동먹자골목상점가": (["사당1동 먹자골목", "사당 먹자골목"], (("사당",), ("먹자골목",))),
    "농민백암순대 시청직영점": (["농민백암순대 시청"], (("농민백암순대",), ("시청", "남대문로1길"))),
    "가메골손왕만두 남대문본점": (["가메골손왕만두 남대문", "남대문 가메골"], (("가메골",), ("남대문",))),
    "홍대갤러리 키르큐펠": (["홍대 키르큐펠 갤러리"], (("키르큐펠",),)),
    "서울명예도로 끼리끼리5길": (["끼리끼리5길"], (("끼리끼리5길",),)),
    "아펜즈커피 서초교대역점": (["아펜즈커피 교대", "아펜즈커피 서초"], (("아펜즈",), ("교대", "서초"))),
    "고래불 강남역삼본점": (["고래불 역삼", "고래불 강남"], (("고래불",), ("역삼", "강남"))),
    "미니말레 뢰스터리&커피바 서초교대점": (["미니말레 교대", "미니말레 서초"], (("미니말레",), ("교대", "서초"))),
    "알레그리아 광화문케이스퀘어시티점": (["알레그리아 광화문", "알레그리아 케이스퀘어시티"], (("알레그리아",), ("광화문", "케이스퀘어시티"))),
    "목멱산방 남산타워점": (["목멱산방 남산타워"], (("목멱산방",), ("남산타워",))),
    "현대수산": (["현대수산 충정로", "현대수산 서소문로"], (("현대수산",), ("충정로", "서소문로", "중림동"))),
    "베르시": (["베르시 만리동", "베르시 서울역"], (("베르시",), ("만리", "서울역"))),
    "이이네": (["이이네 소월로2길 13"], (("이이네",), ("소월로2길13",))),
    "요비": (["요비 건대"], (("요비",), ("건대", "화양", "광진"))),
    "그루타": (["그루타 사당", "그루타 이수"], (("그루타",), ("사당", "이수"))),
    "미소네": (["미소네 사당"], (("미소네",), ("사당", "동작대로"))),
    "WP": (["WP 연희동", "연희동 WP 카페"], (("wp",), ("연희",))),
    "금성관": (["금성관 남대문", "금성관 나주곰탕 남대문"], (("금성관",), ("남대문", "시청", "북창"))),
    "앤시넌": (["앤시넌 건대"], (("앤시넌",), ("건대", "광진", "화양"))),
    "레드로드": (["홍대 레드로드"], (("레드로드",), ("홍대", "마포", "상수"))),
    "하우피": (["하우피 송리단길", "하우피 송파"], (("하우피",), ("송파", "송리단", "잠실", "석촌"))),
    "안밀": (["안밀 낙성대"], (("안밀",), ("낙성대", "봉천", "관악"))),
    "더마틴": (["더마틴 연남"], (("더마틴",), ("연남",))),
    "열": (["열 서초동 식당", "열 강남 서초대로78길"], (("열",), ("서초대로78길48",))),
    "문베어": (["문베어 신촌"], (("문베어",), ("신촌", "명물길"))),
    "가무": (["가무 명동"], (("가무",), ("명동",))),
    "패스드": (["패스드 문래"], (("패스드",), ("문래", "영등포"))),
    "안국사": (["안국사 낙성대"], (("안국사",), ("낙성대", "관악"))),
    "모모룸": (["모모룸 연희"], (("모모룸",), ("연희",))),
    "뺑드램": (["뺑드램 자양", "뺑드램 뚝섬"], (("뺑드램",), ("자양", "뚝섬", "건대", "광진"))),
    "5TO7": (["5TO7 성수", "5to7 서울숲"], (("5to7",), ("성수", "서울숲"))),
    "모멘트커피": (["모멘트커피 연남", "모멘트커피 홍대"], (("모멘트커피",), ("연남", "홍대", "동교"))),
    "커피스니퍼": (["커피스니퍼 시청", "커피스니퍼 덕수궁"], (("커피스니퍼",), ("시청", "덕수궁", "세종대로16길", "북창"))),
    "엘카페커피로스터스": (["엘카페커피로스터스 후암", "엘카페 후암로"], (("엘카페",), ("후암", "서울역"))),
    "트릭아이뮤지엄": (["트릭아이뮤지엄 홍대"], (("트릭아이뮤지엄",), ("홍대", "서교", "홍익로"))),
    "카페 미토": (["카페 미토 사당", "카페 미토 이수"], (("카페미토",), ("사당", "이수", "동작대로9길"))),
    "갤러리라보": (["갤러리라보 서초", "갤러리라보 주흥길", "갤러리라보 반포"], (("갤러리라보",), ("서초", "주흥길", "반포", "신논현"))),
    "훈춘양꼬치 1호점": (["훈춘양꼬치 건대 1호점"], (("훈춘양꼬치",), ("1호점", "일호점"))),
    "계탄집": (["계탄집 자양", "계탄집 뚝섬유원지"], (("계탄집",), ("자양", "광진", "뚝섬유원지", "뚝섬한강"))),
    "유니온아트페어": (["유니온아트페어 문래", "유니온아트페어 영등포"], (("유니온아트페어",), ("문래", "영등포"))),
    "전광수커피하우스 정동점": (["전광수커피하우스 정동점 외관", "전광수커피하우스 정동점 내부"], (("전광수커피",), ("정동",))),
    "슬로우커피": (["슬로우커피 역삼"], (("슬로우커피",), ("역삼", "강남"))),
    "테이블에이": (["테이블에이 홍대"], (("테이블에이",), ("홍대", "서교", "와우산로"))),
    "자매수산": (["자매수산 강남", "자매수산 신논현"], (("자매수산",), ("강남", "신논현", "역삼"))),
    "그림제작소": (["그림제작소 잠실", "그림제작소 송파"], (("그림제작소",), ("잠실", "송파", "석촌"))),
    "스타광장": (["신촌 스타광장"], (("스타광장",), ("신촌", "창천"))),
}

CONFLICTING_LOCATIONS = {
    "훈춘양꼬치 1호점": ("2호점", "3호점", "4호점", "이호점"),
    "스타벅스 석촌호수점": ("소피텔", "kt점", "케이티점", "석촌서호점", "송파나루"),
    "스타벅스 사당점": ("여의도", "국회의사당"),
    "계탄집": ("성수",),
    "유니온아트페어": ("서울옥션강남", "강남센터"),
    "덕수궁돌담길": ("고종의길",),
}


def usable_source(item):
    """Exclude stock libraries and non-photographic mapping/logo results."""
    host = (urllib.parse.urlsplit(canonical_url(item.get("link", ""))).hostname or "").lower()
    if any(domain in host for domain in (
        "shutterstock", "istockphoto", "gettyimages", "freepik", "dreamstime",
        "123rf", "depositphotos", "pngtree", "clipart", "moovit", "vectorstock",
    )):
        return False
    title = plain(item.get("title", "")).lower()
    if any(token in normalized(title) for token in ("근처맛집", "근처호텔", "restaurantsnear", "hotelsnear")):
        return False
    return not any(token in title for token in (
        "스톡 사진", "스톡 일러스트", "스톡 벡터", "stock photo", "stock illustration",
        "무료 벡터", "로고 다운로드", "logo download", "버스 또는 지하철로",
    ))


def matches(place, title, address):
    candidate = normalized(title)
    if any(normalized(conflict) in candidate for conflict in CONFLICTING_LOCATIONS.get(place, ())):
        return False
    # Nearby Starbucks branches are distinct venues. Require the complete
    # branch label including '점', avoiding 사당 inside 여의도의사당 and a
    # generic neighborhood mention being mistaken for a branch name.
    if place.startswith("스타벅스 "):
        return "스타벅스" in candidate and normalized(place.split()[-1]) in candidate
    if place in EXTRA_RULES:
        return all(any(normalized(token) in candidate for token in group)
                   for group in EXTRA_RULES[place][1])
    if relevant(place, title, address):
        return True
    # A branch suffix '점' is optional in prose, but the branch token itself is
    # mandatory; never shorten a multi-token venue into its brand alone.
    tokens = place.split()
    if len(tokens) > 1 and tokens[-1].endswith("점"):
        candidate = normalized(title)
        return all(normalized(token.removesuffix("점")) in candidate for token in tokens)
    return False


def queries(place, address):
    if place in EXTRA_RULES:
        base = list(EXTRA_RULES[place][0])
    else:
        base = search_queries(place, address)
        if place not in RULES and address:
            # District context disambiguates places with equal names.
            district = " ".join(address.split()[:2])
            base.insert(0, f"{place} {district}")
    # Explicit place queries; no category-only fallback is permitted.
    return list(dict.fromkeys(base + [base[0] + " 외관", base[0] + " 내부"]))


def collect(max_pages=2, course_ids=()):
    from dotenv import load_dotenv
    load_dotenv(ROOT / "backend/.env", override=True)
    catalog = json.loads(MANIFEST.read_text(encoding="utf-8"))["courses"]
    missing = {c["id"]: c for c in catalog if not c.get("image_url")}
    selected_ids = set(course_ids)
    if selected_ids.difference(missing):
        raise ValueError("Target course IDs must belong to courses with no published cover")
    existing = [c for c in catalog if c.get("image_url")]
    if not missing:
        print(json.dumps({"existing": len(existing), "eligible": 0, "remaining": 0}), flush=True)
        return
    records = json.loads(PROGRESS.read_text(encoding="utf-8")) if PROGRESS.exists() else {}
    rejected = json.loads((WORK / "rejected.json").read_text(encoding="utf-8"))
    fallback_reject = WORK / "fallback-rejected.json"
    if fallback_reject.exists():
        rejected.update(json.loads(fallback_reject.read_text(encoding="utf-8")))
    # Reviewers own separate atomic decision files. Read all of their rejects
    # when resuming; the publishing workflow also retains old rejected hashes.
    for review_path in WORK.glob("review-fallback*.json"):
        decisions = json.loads(review_path.read_text(encoding="utf-8"))
        if isinstance(decisions, dict):
            for decision in decisions.values():
                if isinstance(decision, dict) and decision.get("decision") == "reject" and decision.get("sha256"):
                    rejected[decision["sha256"]] = decision.get("reason", "Visual review")
    # Retain every rejected hash before a reviewer may replace the decision
    # for the same course ID with a new candidate on a later review round.
    write_json(fallback_reject, rejected)
    rejected_by_stop = defaultdict(set)
    # Review snapshots preserve old candidate metadata when progress is later
    # replaced. Count distinct rejected photos at the same actual route stop.
    for snapshot_path in WORK.glob("fallback-*.json"):
        snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
        if not isinstance(snapshot, dict):
            continue
        for cid, candidate in snapshot.items():
            if (isinstance(candidate, dict) and candidate.get("sha256") in rejected
                    and isinstance(candidate.get("cover_stop_index"), int)):
                rejected_by_stop[(cid, candidate["cover_stop_index"])].add(candidate["sha256"])
    records = {key: value for key, value in records.items()
               if key in missing and (value["sha256"] not in rejected or (selected_ids and key not in selected_ids))
               and (ROOT / "front/public" / value["image_url"].lstrip("/")).exists()}
    used = existing + list(records.values())
    used_urls = {canonical_url(r.get("canonical_url") or r.get("original_url", "")) for r in used}
    used_hashes = {r["sha256"] for r in used}
    used_visual = [int(r["dhash"], 16) for r in used]
    attempted = defaultdict(set)
    route_orders = {}
    for cid, course in missing.items():
        destination = len(course["points"]) - 1
        order = list(range(destination, 0, -1))
        # After two visually unsuitable destination photos, try a real
        # intermediate stop before spending another round on that venue.
        # Two-stop courses still use their actual destination exclusively.
        if destination > 1 and len(rejected_by_stop[(cid, destination)]) >= 2:
            order = order[1:] + order[:1]
        route_orders[cid] = order
    ASSETS.mkdir(parents=True, exist_ok=True)
    write_json(PROGRESS, records)
    print(json.dumps({"existing": len(existing), "eligible": len(missing), "resumed": len(records)}), flush=True)
    # Normally destination first, then intermediates from route end. Repeated
    # visual rejection can move a destination behind its own intermediates.
    max_stops = max(len(c["points"]) for c in missing.values())
    with ThreadPoolExecutor(max_workers=6) as pool:
        for depth in range(max_stops - 1):
            groups = defaultdict(list)
            for cid, course in missing.items():
                order = route_orders[cid]
                index = order[depth] if depth < len(order) else 0
                if cid not in records and index >= 1 and (not selected_ids or cid in selected_ids):
                    point = course["points"][index]
                    groups[(point["place_name"], point.get("address") or "")].append((course, index))
            for (place, address), pending in groups.items():
                for query in queries(place, address):
                    if not pending:
                        break
                    for start in range(1, max_pages * 100, 100):
                        result = search(query, start)
                        items = []
                        page_urls = set()
                        for item in result["items"]:
                            url = canonical_url(item.get("link", ""))
                            if url in used_urls or url in attempted[place] or url in page_urls or not usable_source(item) or not matches(place, item.get("title", ""), address):
                                continue
                            page_urls.add(url)
                            items.append(item)
                        # Bound downloads by remaining demand, allowing batches
                        # of six to amortize failed hosts and duplicate photos.
                        for offset in range(0, len(items), 6):
                            if not pending:
                                break
                            batch = items[offset:offset + 6]
                            attempted[place].update(canonical_url(item.get("link", "")) for item in batch)
                            downloads = list(pool.map(cached_download, batch))
                            for item, downloaded in zip(batch, downloads):
                                if downloaded is None or not pending:
                                    continue
                                data, digest, dhash = downloaded
                                if digest in rejected or digest in used_hashes or any((dhash ^ old).bit_count() <= 4 for old in used_visual):
                                    continue
                                course, index = pending.pop(0)
                                filename = digest[:24] + ".jpg"
                                (ASSETS / filename).write_bytes(data)
                                url = canonical_url(item["link"])
                                records[course["id"]] = {
                                    "image_url": "/assets/naver-courses/" + filename,
                                    "first_place": course["first_place"],
                                    "image_place": place,
                                    "image_place_address": address,
                                    "cover_stop_index": index,
                                    "cover_role": "destination" if index == len(course["points"]) - 1 else "waypoint",
                                    "query": query, "source": "naver-image-search",
                                    "search_url": "https://search.naver.com/search.naver?where=image&query=" + urllib.parse.quote(query),
                                    "original_url": item["link"], "canonical_url": url,
                                    "source_title": plain(item["title"]), "sha256": digest,
                                    "dhash": f"{dhash:016x}",
                                    "review": "venue-title-match; visual-review-pending",
                                }
                                used_urls.add(url)
                                used_hashes.add(digest)
                                used_visual.append(dhash)
                            write_json(PROGRESS, records)
                        if not pending or start + 100 > result.get("total", 0):
                            break
                print(json.dumps({"place": place, "depth": depth, "collected": len(records), "place_missing": len(pending)}, ensure_ascii=False), flush=True)
    print(json.dumps({"collected": len(records), "remaining": len(missing) - len(records)}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-pages", type=int, default=2)
    parser.add_argument("--course-id", action="append", default=[], help="Limit new collection to this unpublished course ID; repeatable")
    args = parser.parse_args()
    if not 1 <= args.max_pages <= 10:
        parser.error("--max-pages must be between 1 and 10")
    try:
        collect(args.max_pages, args.course_id)
    except (SearchUnavailable, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
