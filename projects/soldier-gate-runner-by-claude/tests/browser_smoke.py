"""Headless Chromium smoke test: the page loads, has no console errors and draws on the canvas."""
import functools
import http.server
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

SITE = Path(__file__).resolve().parents[1]


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(SITE))
    handler.log_message = lambda *args, **kwargs: None
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def main(screenshot=None):
    server = serve()
    url = f"http://127.0.0.1:{server.server_address[1]}/index.html"
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url)
        assert page.title() == "Soldier Gate Runner", page.title()
        assert page.locator("#status").get_attribute("data-version"), "missing data-version"
        sample = page.evaluate(
            "() => Array.from(document.getElementById('game').getContext('2d').getImageData(180, 600, 1, 1).data)"
        )
        assert sample[3] == 255, f"canvas not drawn: {sample}"
        if screenshot:
            page.screenshot(path=screenshot)
        browser.close()
    server.shutdown()
    assert not errors, f"console errors: {errors}"
    print("browser smoke passed")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
