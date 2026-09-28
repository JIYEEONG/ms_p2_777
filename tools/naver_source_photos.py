"""Find venue photographs in original posts returned by NAVER blog search.

This only writes candidate metadata and public-page caches. It never changes
course assignments, reviews, or publication manifests. Every candidate keeps
the NAVER query and original post URL so the expanded search is auditable.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request

from naver_place_queries import relevant, search_queries

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "artifacts/naver-course-images"
ENDPOINT = "https://naverapihub.apigw.ntruss.com/search/v1/blog"


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(path)


def plain(text):
    return html.unescape(re.sub(r"<[^>]*>", "", text or "")).strip()


def blog_search(query, start=1):
    key = hashlib.sha256(f"blog:{query}:{start}".encode()).hexdigest()
    cache = WORK / "blog-search" / (key + ".json")
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    params = urllib.parse.urlencode({"query": query, "display": 100, "start": start, "sort": "sim", "format": "json"})
    request = urllib.request.Request(ENDPOINT + "?" + params, headers={
        "X-NCP-APIGW-API-KEY-ID": os.getenv("NAVER_SEARCH_CLIENT_ID", "").strip(),
        "X-NCP-APIGW-API-KEY": os.getenv("NAVER_SEARCH_CLIENT_SECRET", "").strip(),
    })
    with urllib.request.urlopen(request, timeout=25) as response:
        data = json.load(response)
    if not isinstance(data.get("items"), list):
        raise ValueError("NAVER returned an invalid blog-search response")
    write_json(cache, data)
    time.sleep(.2)
    return data


def naver_post_url(url):
    """Use the public mobile post page, avoiding desktop iframe wrappers."""
    parsed = urllib.parse.urlsplit(url)
    if parsed.hostname not in ("blog.naver.com", "m.blog.naver.com"):
        return None
    parts = parsed.path.strip("/").split("/")
    if len(parts) == 2 and parts[1].isdigit():
        return "https://m.blog.naver.com/" + "/".join(parts)
    params = urllib.parse.parse_qs(parsed.query)
    if params.get("blogId") and params.get("logNo", [""])[0].isdigit():
        return "https://m.blog.naver.com/" + urllib.parse.quote(params["blogId"][0], safe="") + "/" + params["logNo"][0]
    return None


def source_post_url(url):
    """Public original blog pages; external blogs must come from NAVER results."""
    result = naver_post_url(url)
    if result:
        return result
    parsed = urllib.parse.urlsplit(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme in ("http", "https") and host.endswith(".tistory.com"):
        return url
    return None


class PostImages(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []
        self._image_keys = set()
        self.title = ""
        self._post_depth = 0
        self.events = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "div":
            classes = set(attrs.get("class", "").split())
            if self._post_depth:
                self._post_depth += 1
            elif classes.intersection(("se-main-container", "tt_article_useless_p_margin")) or attrs.get("id") == "postViewArea":
                self._post_depth = 1
        if tag == "meta" and attrs.get("property") == "og:title":
            self.title = attrs.get("content", "")
        if tag != "img" or not self._post_depth:
            return
        # NAVER's lazily loaded blog photo URLs use these attributes. Only
        # actual post-upload domains qualify; UI sprites/profile icons do not.
        for name in ("data-lazy-src", "data-src", "src"):
            url = html.unescape(attrs.get(name, ""))
            if url.startswith("//"):
                url = "https:" + url
            parsed = urllib.parse.urlsplit(url)
            if parsed.scheme not in ("http", "https"):
                continue
            host = (parsed.hostname or "").lower()
            if not (host.endswith("blogfiles.naver.net") or host in (
                    "postfiles.pstatic.net", "blogfiles.pstatic.net", "blogthumb.pstatic.net",
                    "mblogthumb-phinf.pstatic.net", "blogthumb-phinf.pstatic.net",
                    "blog.kakaocdn.net", "t1.daumcdn.net", "cfile1.uf.tistory.com", "cfile2.uf.tistory.com")):
                continue
            if not re.search(r"\.(jpe?g|png|webp)(?:$|[?])", parsed.path, re.I) and not ("daumcdn.net" in host and "/cfile/" in parsed.path):
                continue
            # Kakao download links can require their query signature. NAVER
            # resize parameters do not identify different source photographs.
            query = parsed.query if host == "blog.kakaocdn.net" else ""
            canonical = urllib.parse.urlunsplit(("https", parsed.netloc, parsed.path, query, ""))
            if canonical not in self._image_keys:
                # Keep the fetch URL's resize option: NAVER thumbnail hosts
                # can return 404 if it is removed. Deduplicate separately.
                fetch_url = urllib.parse.urlunsplit(("https", parsed.netloc, parsed.path, parsed.query, ""))
                self._image_keys.add(canonical)
                self.images.append(fetch_url)
                self.events.append(("image", fetch_url))
            break

    def handle_endtag(self, tag):
        if tag == "div" and self._post_depth:
            self._post_depth -= 1

    def handle_data(self, value):
        if self._post_depth and value.strip():
            if self.events and self.events[-1][0] == "text":
                self.events[-1] = ("text", self.events[-1][1] + " " + value.strip())
            else:
                self.events.append(("text", value.strip()))

    def photo_evidence(self, place):
        """Generic diary titles require an adjacent venue-specific caption."""
        evidence = {}
        for index, (kind, value) in enumerate(self.events):
            if kind != "image":
                continue
            before = self.events[index-1][1][-650:] if index and self.events[index-1][0] == "text" else ""
            after = self.events[index+1][1][:650] if index+1 < len(self.events) and self.events[index+1][0] == "text" else ""
            if relevant(place, before):
                evidence[value] = before
            elif relevant(place, after):
                evidence[value] = after
        return evidence


def extract_post(place, query, item):
    original_url = item.get("link", "")
    url = source_post_url(original_url)
    search_evidence = item.get("title", "") + " " + item.get("description", "")
    if not url or not relevant(place, search_evidence):
        return {"post": original_url, "status": "not-an-exact-venue-post", "items": []}
    key = hashlib.sha256(url.encode()).hexdigest()
    cache = WORK / "blog-pages" / (key + ".html")
    try:
        if cache.exists():
            content = cache.read_text(encoding="utf-8")
        else:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=20) as response:
                content = response.read(5_000_001).decode("utf-8", errors="replace")
            if len(content) > 5_000_000:
                raise ValueError("Post HTML exceeds limit")
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(content, encoding="utf-8")
        parser = PostImages()
        parser.feed(content)
        title_matches = relevant(place, parser.title)
        caption_evidence = parser.photo_evidence(place)
        selected_images = parser.images if title_matches else list(caption_evidence)
        if not selected_images:
            return {"post": original_url, "status": "page-title-does-not-confirm-venue", "items": []}
        candidates = [{
            "first_place": place,
            "query": query,
            "source": item.get("source", "naver-blog-search-original-post"),
            "provider": item.get("provider", "NAVER Blog Search API"),
            "search_url": item.get("search_url", "https://search.naver.com/search.naver?where=blog&query=" + urllib.parse.quote(query)),
            "discovery_url": item.get("discovery_url", ""),
            "discovery_image_url": item.get("discovery_image_url", ""),
            "original_post_url": original_url,
            "fetched_post_url": url,
            "original_url": image_url,
            "link": image_url,
            "source_title": plain(parser.title),
            "title": plain(parser.title),
            "postdate": item.get("postdate", ""),
            "match_evidence": "venue-post-title" if title_matches else "adjacent-photo-caption",
            "venue_evidence": plain(parser.title) if title_matches else caption_evidence[image_url],
            "review": "venue-post-title-match; visual-review-pending",
        } for image_url in selected_images]
        return {"post": original_url, "status": "candidate-photos", "items": candidates}
    except Exception as error:
        # Do not dump request data or credentials, even on provider failures.
        return {"post": original_url, "status": type(error).__name__, "items": []}


def gather(place, max_posts=30):
    queries = [place, *search_queries(place)]
    if place == "잠실지하광장 쇼핑센터":
        queries.insert(0, "잠실지하광장")
        queries.extend(('"잠실지하광장"', "잠실역 지하광장 핸드메이드", "잠실역 지하광장 쇼핑"))
    elif place == "아트팩토리체험공방":
        queries.extend(("아트팩토리 왕십리 도자기", "아트팩토리", '"아트팩토리체험공방"', "왕십리 아트팩토리"))
    elif place == "노란돼지":
        queries.extend(('"노란돼지"', "노란돼지 사당점", "사당 노란돼지", "노란 돼지 사당"))
    if place == "구씨네부엌":
        queries.insert(1, "구씨네 부엌")
    posts = {}
    for query in dict.fromkeys(queries):
        data = blog_search(query)
        for item in data["items"]:
            if relevant(place, item.get("title", "") + " " + item.get("description", "")) and source_post_url(item.get("link", "")):
                posts.setdefault(item["link"], (place, query, item))
        if len(posts) >= max_posts:
            break
    posts = list(posts.values())[:max_posts]
    output = WORK / "source-candidates.json"
    if output.exists():
        previous = json.loads(output.read_text(encoding="utf-8"))
    else:
        previous = {"version": 1, "candidates": [], "posts": []}
    # Rebuild this venue when extraction rules change; keep other venues intact.
    candidates = {item["original_url"]: item for item in previous.get("candidates", [])
                  if item["first_place"] != place}
    reports = [item for item in previous.get("posts", [])
               if item.get("first_place") and item["first_place"] != place]
    with ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(lambda args: extract_post(*args), posts):
            for item in result["items"]:
                candidates.setdefault(item["original_url"], item)
            report = {"first_place": place, "url": result["post"], "status": result["status"], "count": len(result["items"])}
            reports.append(report)
            print(json.dumps(report, ensure_ascii=False), flush=True)
            write_json(output, {"version": 1, "candidates": list(candidates.values()), "posts": reports})
    print(json.dumps({"first_place": place, "posts_requested": len(posts), "candidate_urls": sum(x["first_place"] == place for x in candidates.values())}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(ROOT / "backend/.env")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--place", default="구씨네부엌")
    parser.add_argument("--max-posts", type=int, default=30)
    args = parser.parse_args()
    if not 1 <= args.max_posts <= 100:
        parser.error("max-posts must be between 1 and 100")
    gather(args.place, args.max_posts)
