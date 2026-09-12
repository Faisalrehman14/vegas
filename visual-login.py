#!/usr/bin/env python3
"""
Visual screen login for Vegas Empire — NO console script inject.
Uses real mouse + keyboard (CDP) on the game canvas:
  look at login UI → click username → type → click password → type → click LOGIN.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.request

try:
    from websocket import create_connection
except ImportError:
    print("Missing dependency. Run:")
    print('  python3 -m pip install websocket-client')
    print("Or:")
    print('  python3 -m venv .venv && .venv/bin/pip install websocket-client')
    print('  .venv/bin/python visual-login.py ...')
    raise SystemExit(1)

DEFAULT_URL = "https://games.vegasempire.co/"
OUT = "/tmp/ve-visual-login"


def http_json(base: str, path: str):
    with urllib.request.urlopen(base + path, timeout=5) as r:
        return json.load(r)


class CDP:
    def __init__(self, browser_http: str):
        ver = http_json(browser_http, "/json/version")
        self.wb = create_connection(ver["webSocketDebuggerUrl"], suppress_origin=True)
        self.nid = 0
        self.sid = None

    def bsend(self, method, params=None, sid=None):
        self.nid += 1
        msg = {"id": self.nid, "method": method}
        if params is not None:
            msg["params"] = params
        if sid is not None:
            msg["sessionId"] = sid
        self.wb.send(json.dumps(msg))
        while True:
            raw = json.loads(self.wb.recv())
            if raw.get("id") == msg["id"]:
                if "error" in raw:
                    raise RuntimeError(raw["error"])
                return raw.get("result", {})

    def attach_new(self, url: str):
        tid = self.bsend("Target.createTarget", {"url": "about:blank"})["targetId"]
        self.sid = self.bsend("Target.attachToTarget", {"targetId": tid, "flatten": True})[
            "sessionId"
        ]
        self.send("Page.enable")
        self.send("Runtime.enable")
        self.send("Network.enable")
        self.send("Page.navigate", {"url": url})

    def send(self, method, params=None):
        return self.bsend(method, params, self.sid)

    def ev(self, expr):
        return (
            self.send("Runtime.evaluate", {"expression": expr, "returnByValue": True})
            .get("result", {})
            .get("value")
        )

    def shot(self, name: str):
        os.makedirs(OUT, exist_ok=True)
        data = self.send("Page.captureScreenshot", {"format": "png"})["data"]
        path = os.path.join(OUT, name)
        open(path, "wb").write(base64.b64decode(data))
        print("SHOT", path)
        return path

    def click(self, x: float, y: float):
        for typ in ("mousePressed", "mouseReleased"):
            self.send(
                "Input.dispatchMouseEvent",
                {
                    "type": typ,
                    "x": x,
                    "y": y,
                    "button": "left",
                    "clickCount": 1,
                },
            )
        time.sleep(0.15)

    def type_text(self, text: str):
        # Clear with Ctrl+A + Backspace
        self.send(
            "Input.dispatchKeyEvent",
            {
                "type": "keyDown",
                "modifiers": 2,
                "key": "a",
                "code": "KeyA",
                "windowsVirtualKeyCode": 65,
            },
        )
        self.send(
            "Input.dispatchKeyEvent",
            {
                "type": "keyUp",
                "modifiers": 2,
                "key": "a",
                "code": "KeyA",
                "windowsVirtualKeyCode": 65,
            },
        )
        time.sleep(0.05)
        self.send(
            "Input.dispatchKeyEvent",
            {
                "type": "keyDown",
                "key": "Backspace",
                "code": "Backspace",
                "windowsVirtualKeyCode": 8,
            },
        )
        self.send(
            "Input.dispatchKeyEvent",
            {
                "type": "keyUp",
                "key": "Backspace",
                "code": "Backspace",
                "windowsVirtualKeyCode": 8,
            },
        )
        time.sleep(0.1)
        # CDP insertText is the most reliable for focused inputs
        try:
            self.send("Input.insertText", {"text": text})
        except Exception:
            for ch in text:
                self.send("Input.dispatchKeyEvent", {"type": "keyDown", "key": ch, "text": ch})
                self.send("Input.dispatchKeyEvent", {"type": "char", "text": ch})
                self.send("Input.dispatchKeyEvent", {"type": "keyUp", "key": ch})
                time.sleep(0.05)

    def close(self):
        try:
            self.wb.close()
        except Exception:
            pass


def wait_unity(cdp: CDP, seconds: int = 120) -> bool:
    for i in range(seconds // 2):
        time.sleep(2)
        if cdp.ev("!!(window.unityInstance && window.unityInstance.SendMessage)"):
            print(f"unity ready @{i*2}s")
            return True
        print(f"unity wait {i*2}s")
    return False


def canvas_rect(cdp: CDP):
    return cdp.ev(
        """(() => {
      const c = document.querySelector('#unity-canvas') || document.querySelector('canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return {l:r.left,t:r.top,w:r.width,h:r.height};
    })()"""
    )


def main():
    ap = argparse.ArgumentParser(description="Visual Vegas Empire login (real mouse/keyboard)")
    ap.add_argument("username")
    ap.add_argument("password")
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--cdp", default="http://127.0.0.1:9333", help="Chrome remote debugging URL")
    ap.add_argument("--launch", action="store_true", help="Launch headless Chrome if CDP down")
    args = ap.parse_args()

    # Ensure Chrome CDP
    try:
        http_json(args.cdp, "/json/version")
    except Exception:
        if not args.launch:
            print("Chrome CDP not running. Start with:")
            print(
                '  google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/ve-visual-chrome2'
            )
            print("Or re-run with --launch")
            raise SystemExit(2)
        import subprocess

        profile = "/tmp/ve-visual-chrome2"
        os.makedirs(profile, exist_ok=True)
        subprocess.Popen(
            [
                "google-chrome",
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                f"--remote-debugging-port={args.cdp.rsplit(':',1)[-1]}",
                f"--user-data-dir={profile}",
                "--window-size=1280,800",
                "about:blank",
            ],
            stdout=open("/tmp/ve-visual-chrome2.log", "w"),
            stderr=subprocess.STDOUT,
        )
        for _ in range(30):
            try:
                http_json(args.cdp, "/json/version")
                break
            except Exception:
                time.sleep(0.4)
        else:
            print("Failed to start Chrome")
            raise SystemExit(2)

    cdp = CDP(args.cdp)
    print("Open", args.url)
    cdp.attach_new(args.url)
    if not wait_unity(cdp):
        print("Unity not ready")
        cdp.close()
        raise SystemExit(1)

    print("Wait login UI…")
    # Wait until login scene (loading shot ~small; login UI ~1MB)
    for i in range(20):
        time.sleep(2)
        path = cdp.shot(f"wait-{i:02d}.png")
        if os.path.getsize(path) > 700000:
            print(f"login UI likely ready @{i*2}s")
            break
    cdp.shot("01-login-screen.png")

    rect = canvas_rect(cdp)
    if not rect:
        print("No canvas")
        cdp.close()
        raise SystemExit(1)
    print("canvas", rect)

    def pt(nx, ny):
        return rect["l"] + rect["w"] * nx, rect["t"] + rect["h"] * ny

    # Calibrated from real USER LOGIN screenshots (right panel)
    user_pts = [(0.72, 0.52), (0.74, 0.52), (0.70, 0.52)]
    pass_pts = [(0.72, 0.58), (0.74, 0.58), (0.70, 0.58)]
    login_pts = [(0.72, 0.78), (0.72, 0.76), (0.74, 0.78)]

    print("Click username field")
    for nx, ny in user_pts:
        x, y = pt(nx, ny)
        cdp.click(x, y)
    cdp.ev("(document.querySelector('#unity-canvas')||document.querySelector('canvas')).focus()")
    time.sleep(0.4)
    print("Type username")
    cdp.type_text(args.username)
    time.sleep(0.5)
    cdp.shot("02-after-username.png")

    print("Click password field")
    for nx, ny in pass_pts:
        x, y = pt(nx, ny)
        cdp.click(x, y)
    cdp.ev("(document.querySelector('#unity-canvas')||document.querySelector('canvas')).focus()")
    time.sleep(0.4)
    print("Type password")
    cdp.type_text(args.password)
    time.sleep(0.5)
    cdp.shot("03-after-password.png")

    print("Click LOGIN")
    for nx, ny in login_pts:
        x, y = pt(nx, ny)
        cdp.click(x, y)
        time.sleep(0.25)

    print("Wait after login…")
    time.sleep(12)
    cdp.shot("04-after-login.png")
    print("Done. Screenshots in", OUT)
    cdp.close()


if __name__ == "__main__":
    main()
