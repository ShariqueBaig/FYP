#!/usr/bin/env python3
"""adb_capture.py - get UiAutomator hierarchy dumps off a device with adb, and parse them.

    python adb_capture.py devices
    python adb_capture.py dump [--serial S] [--out dumps/s01_feed.xml]     one screen
    python adb_capture.py coverage dumps/                                   how many controls carry a hook
    python adb_capture.py selftest                                          no device

Everything runs on this machine: adb (Android SDK platform-tools) talks to a USB phone or a local
emulator. No account, no Appium, no root. The XML is the same format hierdump.py parses.

Things a real `uiautomator dump` does that a naive parser trips on (each is handled and tested):
  * it prints a trailer, "UI hierchary dumped to: /dev/tty" (sic) after </hierarchy>
  * it can print "ERROR: null root node returned by UiTestAutomationBridge" while a screen animates
  * a FLAG_SECURE window (banking, some login screens) dumps as an almost-empty tree: that is
    reported as `suppressed`, never silently treated as "no controls"
  * exec-out on Windows can translate line endings; the XML is normalised
  * the dump is one frame: callers must wait for the screen to settle (see `settled()`)

STATUS: the parser and every quirk above are tested against canned output. A real device or
emulator has NOT been run yet - see NEXT_STEPS.md.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Callable, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hierdump as hd  # noqa: E402

TRAILER = re.compile(r"UI hierchy dumped to:.*$|UI hierarchy dumped to:.*$", re.M)
NULL_ROOT = "null root node"


class AdbError(RuntimeError):
    pass


def find_adb(env=None, which=shutil.which, exists=os.path.exists) -> Optional[str]:
    """adb on PATH first, then where the Android SDK normally puts it on Windows/macOS/Linux."""
    env = os.environ if env is None else env
    found = which("adb")
    if found:
        return found
    roots = [env.get("ANDROID_SDK_ROOT"), env.get("ANDROID_HOME"),
             os.path.join(env.get("LOCALAPPDATA", ""), "Android", "Sdk") if env.get("LOCALAPPDATA") else None,
             "D:/AndroidSdk",   # this project's SDK, kept off C: and outside OneDrive
             os.path.expanduser("~/Library/Android/sdk"), os.path.expanduser("~/Android/Sdk")]
    for r in filter(None, roots):
        for exe in ("adb.exe", "adb"):
            p = os.path.join(r, "platform-tools", exe)
            if exists(p):
                return p
    return None


Runner = Callable[[list], str]


def default_runner(adb: str, timeout: int = 60) -> Runner:
    def run(args: list) -> str:
        p = subprocess.run([adb] + args, capture_output=True, timeout=timeout)
        out = p.stdout.decode("utf-8", errors="replace")
        if p.returncode != 0:
            raise AdbError((p.stderr.decode("utf-8", errors="replace") or out).strip()[:300] or f"adb exited {p.returncode}")
        return out
    return run


@dataclass
class Device:
    serial: str
    state: str                  # device | unauthorized | offline
    detail: str = ""

    @property
    def usable(self) -> bool:
        return self.state == "device"

    @property
    def emulator(self) -> bool:
        return self.serial.startswith("emulator-")


def parse_devices(text: str) -> list:
    """`adb devices -l` -> [Device]. Skips the header and the daemon start-up chatter."""
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith(("List of devices", "* daemon", "adb server")):
            continue
        parts = line.split(None, 2)
        if len(parts) >= 2 and parts[1] in ("device", "unauthorized", "offline", "no", "bootloader", "recovery"):
            out.append(Device(parts[0], parts[1] if parts[1] != "no" else "no permissions", parts[2] if len(parts) > 2 else ""))
    return out


def clean_xml(raw: str) -> str:
    """Strip adb/uiautomator noise and return exactly one <hierarchy>...</hierarchy> document."""
    text = raw.replace("\r\r\n", "\n").replace("\r\n", "\n")
    start = text.find("<?xml")
    if start < 0:
        start = text.find("<hierarchy")
    end = text.rfind("</hierarchy>")
    if start < 0 or end < 0:
        raise AdbError("no hierarchy in the dump output: " + text.strip()[:160].replace("\n", " "))
    return text[start:end + len("</hierarchy>")]


@dataclass
class Dump:
    xml: str
    nodes: list
    suppressed: bool = False
    reason: str = ""

    @property
    def controls(self):
        return [n for n in self.nodes if n.onscreen and n.displayed and (n.actionable or n.cls.endswith("EditText"))]


def looks_suppressed(nodes: list) -> bool:
    """A secure window dumps as a bare frame: a handful of nodes and nothing actionable or readable."""
    real = [n for n in nodes if n.text or n.desc or n.rid or n.actionable]
    return len(nodes) <= 3 or (len(nodes) <= 6 and len(real) == 0)


def dump(run: Runner, serial: Optional[str] = None, retries: int = 4, sleep=time.sleep) -> Dump:
    """One hierarchy dump. Retries the transient 'null root node' error; flags suppressed windows."""
    base = ["-s", serial] if serial else []
    last = ""
    for attempt in range(retries):
        try:
            raw = run(base + ["exec-out", "uiautomator", "dump", "/dev/tty"])
        except AdbError as e:
            raw = str(e)
        if NULL_ROOT in raw or "ERROR" in raw and "<hierarchy" not in raw:
            last = raw.strip()[:120]
            sleep(0.5 * (attempt + 1))
            continue
        try:
            xml = clean_xml(raw)
        except AdbError as e:
            last = str(e)
            # some builds refuse /dev/tty: dump to a file and read it back
            try:
                run(base + ["shell", "uiautomator", "dump", "/sdcard/kenna_dump.xml"])
                xml = clean_xml(run(base + ["exec-out", "cat", "/sdcard/kenna_dump.xml"]))
            except AdbError as e2:
                last = str(e2)
                sleep(0.5 * (attempt + 1))
                continue
        nodes = hd.parse(xml)
        sup = looks_suppressed(nodes)
        return Dump(xml, nodes, sup, "the window exposes almost nothing (secure window or blocked tree): do not read this as 'no controls'" if sup else "")
    raise AdbError("could not get a hierarchy dump: " + (last or "unknown"))


def settled(run: Runner, serial=None, tries: int = 6, gap: float = 0.4, sleep=time.sleep) -> Dump:
    """Dump until two consecutive frames have the same controls (the screen stopped animating)."""
    prev, d = None, None
    for _ in range(tries):
        d = dump(run, serial)
        sig = tuple((n.rid, n.desc, n.text, n.bounds) for n in d.controls)
        if sig == prev:
            return d
        prev = sig
        sleep(gap)
    return d


def screen_size(run: Runner, serial=None) -> tuple:
    out = run((["-s", serial] if serial else []) + ["shell", "wm", "size"])
    m = re.findall(r"(\d+)x(\d+)", out)
    return tuple(int(v) for v in m[-1]) if m else (0, 0)       # the last line is Override size when set


def foreground(run: Runner, serial=None) -> str:
    out = run((["-s", serial] if serial else []) + ["shell", "dumpsys", "window"])
    m = re.search(r"mCurrentFocus=.*?\s([\w.]+/[\w.$]+)\}", out)
    return m.group(1) if m else ""


def input_text_arg(text: str) -> str:
    """`adb shell input text` splits on spaces and treats shell metacharacters as syntax."""
    return re.sub(r"([\\\"'`$&|;<>()*?!#~\[\]{}^])", r"\\\1", text.replace("%", "%25")).replace(" ", "%s")


def tap(run: Runner, x: int, y: int, serial=None):
    run((["-s", serial] if serial else []) + ["shell", "input", "tap", str(x), str(y)])


def type_text(run: Runner, text: str, serial=None):
    run((["-s", serial] if serial else []) + ["shell", "input", "text", input_text_arg(text)])


def key(run: Runner, name: str, serial=None):
    run((["-s", serial] if serial else []) + ["shell", "input", "keyevent", name])


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _need_adb():
    adb = find_adb()
    if not adb:
        print("adb not found. It lives in <Android SDK>\\platform-tools. Add that folder to PATH or set ANDROID_HOME.", file=sys.stderr)
        sys.exit(2)
    return adb


def _pick(run, serial):
    devs = [d for d in parse_devices(run(["devices", "-l"]))]
    if serial:
        return serial
    ok = [d for d in devs if d.usable]
    if not ok:
        why = "; ".join(f"{d.serial}: {d.state}" for d in devs) or "no device attached"
        print("No usable device (" + why + "). For a phone: enable USB debugging and accept the prompt. For an emulator: start it first.", file=sys.stderr)
        sys.exit(2)
    if len(ok) > 1:
        print("More than one device; pass --serial: " + ", ".join(d.serial for d in ok), file=sys.stderr)
        sys.exit(2)
    return ok[0].serial


def main(argv):
    # Real Android text is full of non-ASCII (a non-breaking hyphen in "Wi-Fi"): never die printing it.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if len(argv) < 2:
        print(__doc__)
        return 2
    cmd, args = argv[1], argv[2:]
    if cmd == "selftest":
        return selftest()
    if cmd == "coverage":
        nodes_by = {}
        for f in sorted(os.listdir(args[0])):
            if f.endswith(".xml"):
                nodes_by[f] = hd.load(os.path.join(args[0], f))
        hd.print_coverage([hd.coverage_report(k, v) for k, v in nodes_by.items()])
        return 0
    run = default_runner(_need_adb())
    if cmd == "devices":
        for d in parse_devices(run(["devices", "-l"])):
            print(f"{d.serial}\t{d.state}\t{'emulator' if d.emulator else 'phone'}\t{d.detail}")
        return 0
    if cmd == "dump":
        serial = _pick(run, args[args.index("--serial") + 1] if "--serial" in args else None)
        d = settled(run, serial)
        out = args[args.index("--out") + 1] if "--out" in args else None
        if out:
            os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
            with open(out, "w", encoding="utf-8") as fh:
                fh.write(d.xml)
        print(f"{len(d.nodes)} nodes, {len(d.controls)} controls, foreground={foreground(run, serial) or '?'}"
              + (f", SUPPRESSED: {d.reason}" if d.suppressed else "") + (f", saved {out}" if out else ""))
        return 1 if d.suppressed else 0
    print(__doc__)
    return 2


# ---------------------------------------------------------------------------
# Selftest: canned adb output, including the quirks. No device.
# ---------------------------------------------------------------------------

REAL = ('<?xml version=\'1.0\' encoding=\'UTF-8\' standalone=\'yes\' ?><hierarchy rotation="0">'
        '<node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="p" content-desc="" clickable="false" bounds="[0,0][1080,2400]">'
        '<node index="0" text="Settings" resource-id="p:id/title" class="android.widget.TextView" package="p" content-desc="" clickable="false" bounds="[40,100][400,180]"/>'
        '<node index="1" text="" resource-id="p:id/search" class="android.widget.ImageButton" package="p" content-desc="Search" clickable="true" bounds="[900,100][1040,200]"/>'
        '<node index="2" text="Wi-Fi" resource-id="" class="android.widget.LinearLayout" package="p" content-desc="" clickable="true" bounds="[0,300][1080,500]"/>'
        '</node></hierarchy>')


def selftest():
    bad = 0

    def check(name, ok, extra=""):
        nonlocal bad
        print(("  PASS  " if ok else "  FAIL  ") + name + ("" if ok else "  " + str(extra)))
        bad += 0 if ok else 1

    devs = parse_devices("* daemon not running; starting now at tcp:5037\n* daemon started successfully\nList of devices attached\n"
                         "emulator-5554\tdevice product:sdk model:Pixel_8 transport_id:1\nR58M123ABC\tunauthorized usb:1-1\n0123\toffline\n")
    check("devices: parsed, chatter skipped", [(d.serial, d.state) for d in devs] == [("emulator-5554", "device"), ("R58M123ABC", "unauthorized"), ("0123", "offline")], devs)
    check("devices: only authorised ones are usable", [d.usable for d in devs] == [True, False, False] and devs[0].emulator)

    noisy = REAL.replace("<?xml", "\r\r\n<?xml") + "\r\nUI hierchy dumped to: /dev/tty\r\n"
    d = dump(lambda a: noisy)
    check("trailer + CRs stripped, tree parsed", len(d.nodes) == 5 and not d.suppressed and "dumped to" not in d.xml, len(d.nodes))
    check("controls = clickable only (a label inside a card is not a control)", [n.desc or n.text for n in d.controls] == ["Search", "Wi-Fi"], [n.label() for n in d.controls])

    calls = {"n": 0}

    def flaky(a):
        calls["n"] += 1
        return "ERROR: null root node returned by UiTestAutomationBridge." if calls["n"] < 3 else REAL
    d = dump(flaky, sleep=lambda s: None)
    check("transient null-root error is retried", calls["n"] == 3 and len(d.nodes) == 5, calls)

    def nodev(a):
        raise AdbError("device offline")
    try:
        dump(nodev, retries=2, sleep=lambda s: None)
        ok = False
    except AdbError as e:
        ok = "could not get a hierarchy dump" in str(e)
    check("a dead device is an error, not an empty screen", ok)

    secure = '<?xml version="1.0"?><hierarchy rotation="0"><node class="android.widget.FrameLayout" bounds="[0,0][1080,2400]" clickable="false"/></hierarchy>'
    d = dump(lambda a: secure)
    check("secure window is flagged suppressed, not 'no controls'", d.suppressed and "do not read this" in d.reason, d)

    seq = []

    def tty_refused(a):
        seq.append(a)
        if a[-1] == "/dev/tty":
            return "uiautomator: cannot open /dev/tty"
        if "cat" in a:
            return REAL
        return ""
    d = dump(tty_refused, sleep=lambda s: None)
    check("falls back to dump-to-file when /dev/tty is refused", len(d.nodes) == 5 and any("cat" in s for s in seq), seq)

    frames = iter([REAL.replace("Wi-Fi", "Loading"), REAL, REAL])
    d = settled(lambda a: next(frames), sleep=lambda s: None)
    check("settled(): waits for two identical frames", any(n.text == "Wi-Fi" for n in d.controls), [n.text for n in d.controls])

    check("wm size: Override size wins", screen_size(lambda a: "Physical size: 1080x2400\nOverride size: 720x1600\n") == (720, 1600))
    check("foreground activity parsed", foreground(lambda a: "  mCurrentFocus=Window{a1b2 u0 com.android.settings/com.android.settings.Settings}\n") == "com.android.settings/com.android.settings.Settings")
    check("input text: spaces and shell metacharacters survive", input_text_arg("hi there & $x") == "hi%sthere%s\\&%s\\$x", input_text_arg("hi there & $x"))
    check("adb is found in the SDK even when not on PATH",
          find_adb(env={"LOCALAPPDATA": "C:\\U\\L"}, which=lambda n: None, exists=lambda p: p.endswith("platform-tools\\adb.exe") or p.endswith("platform-tools/adb.exe")) is not None)
    print("\nSELFTEST OK" if not bad else f"\n{bad} FAILED")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
