#!/usr/bin/env python3
"""dashboard.py - live view of the agent working on the emulator (zero dependencies).

    python dashboard.py [--port 8765]        then open http://127.0.0.1:8765  (press Run demo)

Shows the emulator screen (adb screencap), the control the agent is looking at / tapping, the ladder of routes
lighting up, what the model was asked and answered, and the check after every tap. It reads the JSON lines that
android_layer.py writes to $FYP_EVENTS; run anything with FYP_EVENTS set and it appears here.
"""
import json
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import adb_capture as ac  # noqa: E402

ADB = ac.find_adb() or "adb"
EVENTS = os.path.join(HERE, "results", "live_events.jsonl")
PAUSE = os.path.join(HERE, "results", "live_pause.flag")
os.makedirs(os.path.dirname(EVENTS), exist_ok=True)
proc = {"p": None}
shot = {"t": 0, "b": b""}
lock = threading.Lock()


def small(png):
    """A 1080x2400 PNG is ~10 MB decoded per frame; the page only needs ~450 px wide. Falls back to the PNG without Pillow."""
    try:
        import io
        from PIL import Image
        im = Image.open(io.BytesIO(png)).convert("RGB")
        im.thumbnail((450, 1000))
        out = io.BytesIO()
        im.save(out, "JPEG", quality=78)
        return out.getvalue()
    except Exception:  # noqa: BLE001
        return png


def screenshot():
    with lock:
        if time.time() - shot["t"] > 0.5:
            r = subprocess.run([ADB, "exec-out", "screencap", "-p"], capture_output=True, timeout=15)
            if r.returncode == 0 and r.stdout[:4] == b"\x89PNG":
                shot.update(t=time.time(), b=small(r.stdout))
        return shot["b"]


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        try:
            if u.path == "/":
                self.send(200, open(os.path.join(HERE, "dashboard.html"), "rb").read(), "text/html; charset=utf-8")
            elif u.path == "/screen.png":
                img = screenshot()
                self.send(200, img, "image/jpeg" if img[:2] == b"\xff\xd8" else "image/png")
            elif u.path == "/scenes":
                import live_demo
                self.send(200, json.dumps([{k: v for k, v in sc.items() if k != "intent"} for sc in live_demo.SCENES]).encode(), "application/json")
            elif u.path == "/events":
                off = int(q.get("since", ["0"])[0])
                data = b""
                reset = False
                if os.path.exists(EVENTS) and off > os.path.getsize(EVENTS):
                    off, reset = 0, True        # a new run truncated the file: start over
                if os.path.exists(EVENTS):
                    with open(EVENTS, "rb") as f:
                        f.seek(off)
                        data = f.read()
                    data = data[: data.rfind(b"\n") + 1]
                running = bool(proc["p"] and proc["p"].poll() is None)
                self.send(200, json.dumps({"next": off + len(data), "running": running, "reset": reset, "paused": os.path.exists(PAUSE),
                                           "events": [json.loads(l) for l in data.decode("utf-8").splitlines() if l.strip()]}).encode(), "application/json")
            elif u.path == "/start":
                if proc["p"] and proc["p"].poll() is None:
                    return self.send(200, b'{"ok":false,"why":"already running"}', "application/json")
                open(EVENTS, "w").close()
                if os.path.exists(PAUSE):
                    os.remove(PAUSE)
                env = dict(os.environ, FYP_PAUSE=PAUSE, FYP_EVENTS=EVENTS, FYP_PACE=q.get("pace", ["1.6"])[0], PYTHONIOENCODING="utf-8")
                cmd = [sys.executable, os.path.join(HERE, "live_demo.py")]
                if q.get("scenes", [""])[0]:
                    cmd += ["--scenes", "".join(c for c in q["scenes"][0] if c in "0123456789,")]
                sem = q.get("semantic", ["offline"])[0]
                if sem != "none":
                    cmd += ["--semantic", sem]
                proc["p"] = subprocess.Popen(cmd, env=env, stdout=subprocess.DEVNULL, stderr=open(os.path.join(HERE, "results", "live_demo.err"), "w"))
                self.send(200, b'{"ok":true}', "application/json")
            elif u.path in ("/pause", "/resume"):
                if u.path == "/pause" and proc["p"] and proc["p"].poll() is None:
                    open(PAUSE, "w").close()
                elif os.path.exists(PAUSE):
                    os.remove(PAUSE)
                self.send(200, b'{"ok":true}', "application/json")
            elif u.path == "/stop":
                if os.path.exists(PAUSE):
                    os.remove(PAUSE)
                if proc["p"] and proc["p"].poll() is None:
                    proc["p"].terminate()
                self.send(200, b'{"ok":true}', "application/json")
            else:
                self.send(404, b"not found", "text/plain")
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # noqa: BLE001
            self.send(500, str(e).encode(), "text/plain")


def main(argv):
    port = int(argv[argv.index("--port") + 1]) if "--port" in argv else 8765
    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    print(f"Dashboard: http://127.0.0.1:{port}   (events -> {EVENTS})")
    srv.serve_forever()


if __name__ == "__main__":
    main(sys.argv)
