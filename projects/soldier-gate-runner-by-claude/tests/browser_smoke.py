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
        assert before < 284, f"no enemy damage: {before}"

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

        # speed selector: all of x1..x4 visible at once, selectable directly, and never covering the game screen
        labels = page.locator("#speedbar button").all_inner_texts()
        assert labels == ["x1", "x2", "x3", "x4"], labels
        page.click("#speedbar button[data-speed='4']")
        assert page.evaluate("window.__game.speed") == 4
        assert page.locator("#speedbar button[data-speed='4']").get_attribute("aria-pressed") == "true"
        assert page.locator("#speedbar button[data-speed='1']").get_attribute("aria-pressed") == "false"
        page.keyboard.press("3")
        assert page.evaluate("window.__game.speed") == 3
        page.click("#speedbar button[data-speed='1']")
        for size in ({"width": 390, "height": 844}, {"width": 1280, "height": 800}):
            page.set_viewport_size(size)
            c, s = page.locator("#game").bounding_box(), page.locator("#speedbar").bounding_box()
            overlap = not (s["x"] >= c["x"] + c["width"] or s["x"] + s["width"] <= c["x"] or s["y"] >= c["y"] + c["height"] or s["y"] + s["height"] <= c["y"])
            assert not overlap, f"speed bar covers the game screen at {size}"
            assert page.evaluate("document.documentElement.scrollHeight <= window.innerHeight + 1"), f"page scrolls at {size}"
            assert s["x"] >= 0 and s["x"] + s["width"] <= size["width"] and s["y"] + s["height"] <= size["height"], f"speed bar off screen at {size}"
        page.set_viewport_size({"width": 390, "height": 844})

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
