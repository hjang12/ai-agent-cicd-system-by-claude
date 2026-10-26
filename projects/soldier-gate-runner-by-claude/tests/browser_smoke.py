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
        assert page.locator("#ov-btn").is_visible() and page.locator("#ov-btn").inner_text() == "시작"
        status = lambda: page.evaluate("window.__game.state.status")
        assert status() == "ready"

        page.click("#ov-btn")
        assert status() == "playing" and page.locator("#overlay").is_hidden()
        page.evaluate("window.__game.state.count = 60; window.__game.fastForward(24)")
        if screenshot:
            page.screenshot(path=screenshot)
        before = page.evaluate("window.__game.state.enemies.reduce((a, e) => a + e.hp, 0)")
        assert before < 208, f"no enemy damage: {before}"

        # win path
        page.evaluate("window.__game.state.count = 300; window.__game.fastForward(120)")
        assert status() == "won", status()
        assert "승리" in page.locator("#ov-title").inner_text() and page.locator("#ov-btn").inner_text() == "다시 시작"

        # restart clears previous round state
        page.click("#ov-btn")
        assert status() == "playing"
        fresh = page.evaluate("({c: window.__game.state.count, h: window.__game.state.gates.map(g => g.hits || 0)})")
        assert fresh["c"] == 12 and sum(fresh["h"]) == 0, fresh

        # lose path
        page.evaluate("window.__game.state.count = 1; window.__game.fastForward(60)")
        assert status() == "lost", status()
        assert "패배" in page.locator("#ov-title").inner_text()

        # keyboard + drag input
        page.click("#ov-btn")
        page.keyboard.down("ArrowRight"); page.wait_for_timeout(300); page.keyboard.up("ArrowRight")
        assert page.evaluate("window.__game.state.u") > 0, "keyboard input ignored"
        box = page.locator("#game").bounding_box()
        page.mouse.move(box["x"] + box["width"] * 0.2, box["y"] + box["height"] * 0.8)
        page.mouse.down(); page.mouse.move(box["x"] + box["width"] * 0.25, box["y"] + box["height"] * 0.8); page.mouse.up()
        assert page.evaluate("window.__game.state.u") < 0, "drag input ignored"
        browser.close()
    server.shutdown()
    assert not errors, f"console errors: {errors}"
    print("browser smoke passed")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
