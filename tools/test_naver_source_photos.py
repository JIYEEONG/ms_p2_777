import unittest

from naver_source_photos import PostImages, naver_post_url, source_post_url


class SourcePhotoTests(unittest.TestCase):
    def test_post_urls_keep_only_public_naver_posts(self):
        self.assertEqual(naver_post_url("https://blog.naver.com/example/123"),
                         "https://m.blog.naver.com/example/123")
        self.assertEqual(naver_post_url("https://blog.naver.com/PostView.naver?blogId=example&logNo=123"),
                         "https://m.blog.naver.com/example/123")
        self.assertIsNone(naver_post_url("https://blog.naver.com.evil.test/example/123"))
        self.assertIsNone(naver_post_url("https://blog.naver.com/example"))

    def test_only_main_post_photos_and_no_duplicates(self):
        parser = PostImages()
        parser.feed('''
          <meta property="og:title" content="구씨네부엌 후기">
          <img src="https://mblogthumb-phinf.pstatic.net/unrelated.jpg">
          <div class="se-main-container"><div>
            <img src="https://mblogthumb-phinf.pstatic.net/photo.jpg?type=w80_blur"
                 data-lazy-src="https://mblogthumb-phinf.pstatic.net/photo.jpg?type=w800">
            <img src="https://mblogthumb-phinf.pstatic.net/photo.jpg?type=w1200">
            <img src="https://blogpfthumb-phinf.pstatic.net/profile.jpg">
            <img src="https://example.com/ad.jpg">
          </div></div>
          <img src="https://mblogthumb-phinf.pstatic.net/recommended.jpg">
        ''')
        self.assertEqual(parser.title, "구씨네부엌 후기")
        self.assertEqual(parser.images, ["https://mblogthumb-phinf.pstatic.net/photo.jpg?type=w800"])

    def test_legacy_post_container(self):
        parser = PostImages()
        parser.feed('<div id="postViewArea"><img src="//postfiles.pstatic.net/food.JPG"></div>')
        self.assertEqual(parser.images, ["https://postfiles.pstatic.net/food.JPG"])

    def test_generic_post_only_confirms_adjacent_caption(self):
        parser = PostImages()
        parser.feed('''<div class="tt_article_useless_p_margin">
            <img src="https://blog.kakaocdn.net/other-food.jpg">
            <p>만다복에서 먹은 짜장면</p>
            <img src="https://blog.kakaocdn.net/another-food.jpg">
            <img src="https://blog.kakaocdn.net/plaza.jpg">
            <p>잠실역 지하광장에 들렀다</p>
            </div>''')
        evidence = parser.photo_evidence("잠실지하광장 쇼핑센터")
        self.assertEqual(list(evidence), ["https://blog.kakaocdn.net/plaza.jpg"])

    def test_external_posts_are_limited_to_original_blog_hosts(self):
        self.assertEqual(source_post_url("https://example.tistory.com/123"), "https://example.tistory.com/123")
        self.assertIsNone(source_post_url("https://example.tistory.com.evil.test/123"))


if __name__ == "__main__":
    unittest.main()
