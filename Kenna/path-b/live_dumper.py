#!/usr/bin/env python3
"""Live Appium dumper for Path B Android automation.

Captures hierarchy dumps (driver.page_source) and screenshots at every screen
of the IG compose flow, then runs hierdump coverage analysis.

Usage:
    python3 live_dumper.py            # start the interactive dumper
    python3 live_dumper.py --screens  # list screens to dump

This script:
1. Connects to Appium on the emulator
2. Navigates through the IG compose flow
3. At each important screen, settles the UI and saves:
   - driver.page_source -> dumps/sNN_<screen>_session<X>.xml
   - Screenshot -> screenshots/sNN_<screen>_session<X>.png
4. After all screens are dumped, runs hierdump coverage report
"""

import time
import os
import sys
import hashlib
import csv
import xml.etree.ElementTree as ET
from datetime import datetime

from appium import webdriver
from appium.options.android import UiAutomator2Options
from hierdump import parse, coverage_report, print_coverage

# ---- Configuration ----

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

DUMPS_DIR = os.path.join(PROJECT_ROOT, "dumps")
SCREENSHOTS_DIR = os.path.join(PROJECT_ROOT, "screenshots")

# Screens in compose flow order, with navigation hints
SCREEN_SPEC = {
    "feed": {
        "navigate_hint": "app launch - wait for home feed",
        "identifier": "home_feed",
    },
    "profile": {
        "navigate_hint": "from feed, tap profile tab",
        "identifier": "profile_tab",
    },
    "create_post": {
        "navigate_hint": "from profile, tap + (create) button",
        "identifier": "create_button",
    },
    "gallery_picker": {
        "navigate_hint": "from create post, tap gallery icon",
        "identifier": "gallery_grid",
    },
    "crop_filter": {
        "navigate_hint": "from gallery, select a photo -> crop/filter screen",
        "identifier": "crop_root",
    },
    "caption": {
        "navigate_hint": "from crop/filter, add caption",
        "identifier": "caption_field",
    },
    "share": {
        "navigate_hint": "from caption, tap share button",
        "identifier": "share_button",
    },
}


# ---- Appium Session ----

def make_opts():
    """Appium options with the two magic settings."""
    opts = UiAutomator2Options().load_capabilities({
        "platformName": "Android",
        "appium:automationName": "UiAutomator2",
        "appium:deviceName": "emulator-5554",
        "appium:appPackage": "com.instagram.android",
        "appium:appActivity": ".activity.MainTabActivity",
        "appium:noReset": True,
        "appium:newCommandTimeout": 300,
        "appium:settings[waitForIdleTimeout]": 0,
        "appium:settings[allowInvisibleElements]": True,
    })
    return opts


def make_driver():
    return webdriver.Remote("http://127.0.0.1:4723", options=make_opts())


def settle(driver, tries=10, interval=0.3):
    """Wait for UI to stabilize: two identical consecutive dumps = done."""
    prev = None
    for _ in range(tries):
        xml = driver.page_source
        if prev is not None and xml == prev:
            return xml
        prev = xml
        time.sleep(interval)
    return prev


# ---- Screenshot helper ----

def take_screenshot(driver, path):
    """Save a PNG screenshot."""
    driver.save_screenshot(path)


# ---- Screen identification helpers ----

def identify_screen(xml_tree):
    """Try to identify which screen we're on based on tree features."""
    for n in xml_tree:
        text = n.text or ""
        desc = n.desc or ""
        rid = n.rid or ""
        cls = n.cls or ""

        combined = (text + "|" + desc + "|" + rid).lower()

        keywords = {
            "feed": ["home", "feed", "new post"],
            "profile": ["profile", "you", "account"],
            "create_post": ["new post", "create"],
            "gallery_picker": ["gallery", "select photo"],
            "crop_filter": ["crop", "filter", "filter_tray"],
            "caption": ["write a caption", "caption"],
            "share": ["share", "post"],
        }

        for screen, kws in keywords.items():
            if any(kw in combined for kw in kws):
                return screen

    return None


# ---- Main dump loop ----

def dump_screen(driver, screen_name, session_num):
    """Dump hierarchy + screenshot for one screen, one session."""
    os.makedirs(DUMPS_DIR, exist_ok=True)
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

    # Wait for UI to settle
    xml = settle(driver)
    if xml is None:
        print(f"  WARNING: could not settle screen {screen_name} session {session_num}")
        return None

    # Parse tree for identification
    tree = parse(xml)
    screen_id = identify_screen(tree)

    # Save XML dump
    dump_path = os.path.join(
        DUMPS_DIR, f"s0{list(SCREEN_SPEC.keys()).index(screen_name)+1:02d}"
        f"_ {screen_name}_session{session_num}.xml"
    )
    with open(dump_path, "w", encoding="utf-8") as f:
        f.write(xml)

    # Take screenshot
    ts = datetime.now().strftime("%H%M%S")
    screenshot_path = os.path.join(
        SCREENSHOTS_DIR,
        f"s0{list(SCREEN_SPEC.keys()).index(screen_name)+1:02d}"
        f"_ {screen_name}_session{session_num}_{ts}.png",
    )
    take_screenshot(driver, screenshot_path)

    print(f"  Saved: {os.path.basename(dump_path)}")
    print(f"  Screenshot: {os.path.basename(screenshot_path)}")

    return screen_id


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Live Appium dumper for Path B Android automation"
    )
    parser.add_argument(
        "--sessions",
        type=int,
        default=5,
        help="Number of dump sessions per screen (default: 5)",
    )
    parser.add_argument(
        "--screens",
        nargs="+",
        choices=list(SCREEN_SPEC.keys()) + ["all"],
        default="all",
        help="Screens to dump (default: all)",
    )
    args = parser.parse_args()

    screens_to_dump = (
        list(SCREEN_SPEC.keys()) if args.screens == ["all"] else args.screens
    )

    print("=" * 60)
    print("PATH B: LIVE APPIUM DUMPER")
    print("=" * 60)
    print(f"Config: {args.sessions} sessions per screen")
    print(f"Screens: {', '.join(screens_to_dump)}")
    print()

    # Initialize driver
    print("Starting Appium driver...")
    driver = make_driver()
    print("Driver ready.\n")

    # Ensure output dirs exist
    os.makedirs(DUMPS_DIR, exist_ok=True)
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

    # Clear old dumps/screenshots for a fresh run
    import shutil
    if os.path.exists(DUMPS_DIR):
        shutil.rmtree(DUMPS_DIR)
    os.makedirs(DUMPS_DIR, exist_ok=True)
    if os.path.exists(SCREENSHOTS_DIR):
        shutil.rmtree(SCREENSHOTS_DIR)
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

    # ===== NAVIGATE TO FIRST SCREEN =====
    print("=" * 60)
    print("STEP 1: Launch Instagram and wait on home screen")
    print("=" * 60)
    driver.launch_app()
    time.sleep(8)  # wait for launch

    # ===== DUMP EACH SCREEN =====
    total_dumps = len(screens_to_dump) * args.sessions
    completed = 0

    for si, screen_name in enumerate(screens_to_dump, 1):
        spec = SCREEN_SPEC[screen_name]
        print(
            "\n" + "=" * 60
            + f"\nSCREEN {si}/{len(screens_to_dump)}: {screen_name.upper()}"
            + "\n" + "=" * 60
        )
        print(f"Navigation hint: {spec['navigate_hint']}")
        print()

        for session in range(1, args.sessions + 1):
            print(f"\n--- Session {session}/{args.sessions} ---")
            dump_screen(driver, screen_name, session)
            completed += 1

            # Small delay between sessions, except after the last
            if session < args.sessions:
                print("  Brief pause before next session...")
                time.sleep(1)

        # After each screen: try to navigate to the next one
        if screen_name != screens_to_dump[-1]:
            print(
                f"\nNavigating from {screen_name} to next screen..."
            )
            navigate_to_next_screen(driver, screen_name)

    # ===== FINAL: Run hierdump coverage =====
    print("\n" + "=" * 60)
    print("STEP 2: Running hierdump coverage analysis...")
    print("=" * 60)

    xml_files = sorted(
        glob.glob(os.path.join(DUMPS_DIR, "*.xml"))
    )
    if not xml_files:
        print("  No dump files found. Aborting coverage.")
        driver.quit()
        return

    print(f"Found {len(xml_files)} dump files.\n")
    rows = []
    for fpath in xml_files:
        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
            xml_content = f.read()
        row = coverage_report(os.path.basename(fpath), xml_content)
        rows.append(row)

    print_coverage(rows)

    # Summary
    if rows:
        total_controls = sum(r["controls"] for r in rows)
        total_anon = sum(r["anonymous"] for r in rows)
        print(f"\nTOTAL across all screens:")
        print(f"  Controls: {total_controls}")
        print(f"  Anonymous (screenshot-fallback zone): {total_anon} ({100*total_anon/total_controls:.1f}%)")

    # ===== DONE =====
    print("\n" + "=" * 60)
    print("DUMP COMPLETE")
    print("=" * 60)
    print(f"\nDumps saved to: {DUMPS_DIR}")
    print(f"Screenshots saved to: {SCREENSHOTS_DIR}")
    print(
        "\nNext: run `python3 hierdump.py coverage dumps/` to see the go/no-go numbers."
    )
    print(
        "Then use `python3 hierdump.py rungs dumps/s01_feed_session1.xml`"
    )
    print("to see the locator ladder for each control.")

    driver.quit()


def navigate_to_next_screen(driver, from_screen):
    """Attempt to navigate from current screen to the next in the compose flow."""
    from hierdump import find

    # Small pause
    time.sleep(2)

    xml = settle(driver)
    if xml is None:
        print("  Could not settle tree after pause")
        return

    tree = parse(xml)

    if from_screen == "feed":
        # Tap profile tab - look for a node with profile-related text/desc
        profile_candidates = [
            n for n in tree
            if any(kw in (n.desc or "") + (n.text or "") for kw in ["profile", "you"])
            and n.actionable
        ]
        if profile_candidates:
            target = profile_candidates[0]
            x, y = target.center
            driver.execute_script(
                "mobile: clickGesture", {"x": x, "y": y}
            )
            print(f"  Tapped profile tab at center {target.center}")
        else:
            print("  Could not find profile tab candidate - using coordinates")
            # Fallback: tap bottom-middle where profile usually is
            driver.execute_script(
                "mobile: clickGesture", {"x": 540, "y": 2200}
            )

    elif from_screen == "profile":
        # Tap + (create post) button
        next_candidates = [
            n for n in tree
            if n.text == "New post" or ("new" in (n.desc or "").lower() and n.actionable)
        ]
        if next_candidates:
            target = next_candidates[0]
            x, y = target.center
            driver.execute_script(
                "mobile: clickGesture", {"x": x, "y": y}
            )
            print(f"  Tapped 'New post' button")
        else:
            # Tap top-right area where + usually is
            driver.execute_script(
                "mobile: clickGesture", {"x": 1050, "y": 100}
            )
            print("  Tapped + button fallback coordinates")

    elif from_screen == "create_post":
        # Tap gallery icon (usually a photo icon)
        gallery_candidates = [
            n for n in tree
            if "image" in (n.cls or "").lower() and n.actionable
            and (n.text or "").strip() == ""
        ]
        if gallery_candidates:
            target = gallery_candidates[0]
            x, y = target.center
            driver.execute_script(
                "mobile: clickGesture", {"x": x, "y": y}
            )
            print(f"  Tapped gallery icon")
        else:
            # Tap center-bottom where gallery usually is
            driver.execute_script(
                "mobile: clickGesture", {"x": 540, "y": 2100}
            )
            print("  Tapped gallery fallback coordinates")

    elif from_screen == "gallery_picker":
        # Already at gallery - just wait a bit for crop screen to load
        # The flow should progress automatically after a short delay
        time.sleep(3)

    elif from_screen == "crop_filter":
        # Already at crop/filter - wait for next screen
        time.sleep(3)

    elif from_screen == "caption":
        # Tap next/done on caption
        next_candidates = [
            n for n in tree
            if n.text == "Next" or n.text == "Share"
        ]
        if next_candidates:
            target = next_candidates[0]
            x, y = target.center
            driver.execute_script(
                "mobile: clickGesture", {"x": x, "y": y}
            )
            print(f"  Tapped Next/Share button")
        else:
            # Tap center-top
            driver.execute_script(
                "mobile: clickGesture", {"x": 540, "y": 400}
            )

    # Settle after navigation
    time.sleep(3)


if __name__ == "__main__":
    import glob
    main()