import re
import unittest
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]


class StaticSiteTest(unittest.TestCase):
    def setUp(self):
        self.html = (SITE / "index.html").read_text(encoding="utf-8")

    def test_has_title_and_viewport(self):
        self.assertIn("<title>Soldier Gate Runner</title>", self.html)
        self.assertIn('name="viewport"', self.html)

    def test_has_version_marker(self):
        self.assertRegex(self.html, r'id="status"[^>]*data-version="\d+\.\d+\.\d+(-[\w.]+)?"')

    def test_no_external_resources(self):
        self.assertFalse(re.search(r"""(?:src|href)\s*=\s*["']https?://""", self.html))
        self.assertNotIn("@import", self.html)


if __name__ == "__main__":
    unittest.main()
