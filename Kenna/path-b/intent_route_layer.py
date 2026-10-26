#!/usr/bin/env python3
"""Intent-and-route layer for Path B Android automation.

Defines the Intent dataclass, ordered routes per intent, and the per-attempt
CSV logging schema. This is the data layer that records every automation
attempt with enough detail for policy replay and half-life analysis.

Key design decisions:
- Routes are ordered per intent (try in sequence, stop at first success)
- The screenshot route is a first-class route, not an exception handler
- Every attempt appends one row to the session log
- tree_hash enables drift comparison across app builds
"""

import csv
import time
import hashlib
from dataclasses import dataclass, field
from typing import Optional, Dict, Any


# ============================================================================
# Intent Dataclass
# ============================================================================

@dataclass(frozen=True)
class Intent:
    """Immutable description of one automation intent.

    Attributes:
        id: Unique identifier for the intent (e.g. "compose.next")
        screen: Screen name within the compose flow (e.g. "crop")
        action: Type of action (click | type | reveal)
        target: Semantic description dict with labels, anchors, expected class
        pre: Tuple of preconditions that must already hold (e.g. ("profile_loaded",))
        success: Predicate id checked on the NEXT tree to confirm success
    """
    id: str
    screen: str
    action: str
    target: Dict[str, Any] = field(default_factory=dict)
    pre: tuple = field(default_factory=tuple)
    success: str = ""


# ============================================================================
# Route Orderings
# ============================================================================

# Route order for each intent: try in this order, stop at first success.
# Each route is (name, rung_strategy, appium_by, success_predicate_hint).
# The screenshot route is a first-class route, not an exception handler.

ROUTE_ORDER = {
    "compose.next": [
        # Rung 0: resource-id (By.ID) — strongest, version-pinned within a build
        ("resource-id", "By.ID", "By.ID", "element exists on next screen"),

        # Rung 1: content-desc (By.ACCESSIBILITY_ID) — survives re-layout
        ("content-desc", "By.ACCESSIBILITY_ID", "accessibility id", "next button visible"),

        # Rung 2: text (UiSelector().text()) — breaks on copy/locale change
        ("text", "UiSelector.text()", "text", "Next button text"),

        # Rung 3: scoped xpath — conjoined chain (container id + row text)
        ("scoped-xpath", "By.XPATH", "xpath", "scoped chain matched"),

        # Rung 4: screenshot + coords — OCR-based fallback
        ("screenshot", "screenshot+ocr", "screenshot", "ocr recognized Next button"),
    ],

    "navigate.profile": [
        # Rung 0: resource-id
        ("resource-id", "By.ID", "By.ID", "profile element exists"),

        # Rung 1: content-desc
        ("content-desc", "By.ACCESSIBILITY_ID", "accessibility id", "profile visible"),

        # Rung 2: text
        ("text", "UiSelector.text()", "text", "profile text"),

        # Rung 3: scoped xpath
        ("scoped-xpath", "By.XPATH", "xpath", "scoped chain matched"),

        # Rung 4: screenshot
        ("screenshot", "screenshot+ocr", "screenshot", "ocr recognized profile"),
    ],

    "crop.select": [
        ("resource-id", "By.ID", "By.ID", "crop element selected"),
        ("content-desc", "By.ACCESSIBILITY_ID", "accessibility id", "crop handles visible"),
        ("text", "UiSelector.text()", "text", "crop confirmed"),
        ("scoped-xpath", "By.XPATH", "xpath", "scoped chain matched"),
        ("screenshot", "screenshot+ocr", "screenshot", "ocr confirmed crop"),
    ],

    "share.post": [
        ("resource-id", "By.ID", "By.ID", "share sheet appeared"),
        ("content-desc", "By.ACCESSIBILITY_ID", "accessibility id", "share button clicked"),
        ("text", "UiSelector.text()", "text", "share destination"),
        ("scoped-xpath", "By.XPATH", "xpath", "scoped chain matched"),
        ("screenshot", "screenshot+ocr", "screenshot", "ocr recognized share"),
    ],
}


# ============================================================================
# Per-Attempt Log Schema
# ============================================================================

ATTEMPT_LOG_COLUMNS = [
    "timestamp",
    "session_id",
    "app_version",
    "intent_id",
    "route_index",
    "rung",
    "attempt_number",
    "outcome",
    "outcome_detail",
    "ms_elapsed",
    "tree_hash",
    "next_screen_marker",
]


def open_log(log_path: str):
    """Initialize a CSV log file, writing header if new."""
    file_exists = os.path.isfile(log_path)
    os.makedirs(os.path.dirname(log_path) or ".", exist_ok=True)
    f = open(log_path, "a", newline="", encoding="utf-8")
    writer = csv.DictWriter(f, fieldnames=ATTEMPT_LOG_COLUMNS)
    if not file_exists or os.path.getsize(log_path) == 0:
        writer.writeheader()
    return f, writer


def log_attempt(writer, row_dict: dict):
    """Append one attempt row to the log."""
    writer.writerow(row_dict)


def close_log(f):
    """Close the log file handle."""
    f.close()


def make_row(
    timestamp: str,
    session_id: str,
    app_version: str,
    intent_id: str,
    route_index: int,
    rung: str,
    attempt_number: int,
    outcome: str,
    outcome_detail: str,
    ms_elapsed: int,
    tree_hash: str,
    next_screen_marker: str = "",
) -> dict:
    """Build a log row dict from individual components."""
    return {
        "timestamp": timestamp,
        "session_id": session_id,
        "app_version": app_version,
        "intent_id": intent_id,
        "route_index": route_index,
        "rung": rung,
        "attempt_number": attempt_number,
        "outcome": outcome,
        "outcome_detail": outcome_detail,
        "ms_elapsed": ms_elapsed,
        "tree_hash": tree_hash,
        "next_screen_marker": next_screen_marker,
    }


# ============================================================================
# Policy Replay Helpers
# ============================================================================

def replay_intent(
    intent_id: str,
    driver,
    intent: Intent,
    log_path: str,
    max_attempts: int = 10,
) -> Optional[dict]:
    """Replay one intent against the current screen, logging every attempt.

    Returns the first successful row, or None if all attempts failed.
    """
    import os
    import time as time_mod
    from hierdump import settle, parse, ladder, live_count, coverage_report

    f, writer = open_log(log_path)

    try:
        # Settle and dump the tree
        xml = settle(driver)
        if xml is None:
            print("  Could not stabilize tree for replay")
            return None

        tree = parse(xml)
        tree_hash = hashlib.md5(xml.encode()).hexdigest()[:8]

        # Get app version from desired capabilities
        app_version = driver.capabilities.get("appVersion", "unknown")

        # Identify current screen
        screen = identify_screen_from_tree(tree)  # you implement or pass in

        # Try each route in order
        for route_idx, (route_name, strategy, by, predicate_hint) in enumerate(
            ROUTE_ORDER.get(intent_id, [])
        ):
            if route_idx >= max_attempts:
                break

            print(f"\n  Trying route {route_idx + 1}: {route_name}")

            # Route-specific logic
            success = False
            next_marker = ""
            chosen_rung = ""
            chosen_ms = 0

            if route_name == "resource-id":
                # Try By.ID on known elements
                # ... (implement per-intent)
                pass

            elif route_name == "content-desc":
                # Try By.ACCESSIBILITY_ID
                pass

            elif route_name == "text":
                # Try UiSelector().text()
                pass

            elif route_name == "scoped-xpath":
                # Run ladder, try the best scoped chain
                # ... (use hierdump.ladder())
                lad = ladder(target_node, tree)
                best = lad[0]
                if best.unique and best.grade in ("A", "B"):
                    # Verify live
                    if live_count(driver, best) == 1:
                        # Act on bounds
                        x, y = best.center
                        start_ts = time_mod.time()
                        driver.execute_script(
                            "mobile: clickGesture", {"x": x, "y": y}
                        )
                        # Settle and check next screen
                        xml2 = settle(driver)
                        if xml2:
                            success, next_marker = check_next_screen(
                                xml2, intent.success
                            )
                        chosen_rung = best.rung
                        chosen_ms = int((time_mod.time() - start_ts) * 1000)

            elif route_name == "screenshot":
                # OCR-based fallback
                # ... (implement screenshot + OCR)
                pass

            # Log this attempt
            elapsed_ms = int(time_mod.time() * 1000) - chosen_ms  # simplification
            row = make_row(
                timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
                session_id=session_id_or_none,
                app_version=app_version,
                intent_id=intent_id,
                route_index=route_idx,
                rung=chosen_rung or route_name,
                attempt_number=route_idx + 1,
                outcome="success" if success else "failed",
                outcome_detail=predicate_hint if success else f"route failed: {predicate_hint}",
                ms_elapsed=chosen_ms,
                tree_hash=tree_hash,
                next_screen_marker=next_marker,
            )
            log_attempt(writer, row)

            if success:
                print(f"  ✓ Success on route {route_idx + 1} ({route_name})")
                f.close()
                return row

        # All routes exhausted
        print("  ✗ All routes exhausted without success")
        return None

    finally:
        close_log(f)


def identify_screen_from_tree(tree):
    """Map a parsed hierarchy tree to a screen name."""
    # Simple keyword-based identification; replace with your own logic
    import xml.etree.ElementTree as ET
    # ... detect based on resource-ids, text, etc.
    return "unknown"


def check_next_screen(xml: str, success_predicate: str) -> tuple:
    """Check whether the next screen's marker appears in the new tree.

    Returns (success: bool, marker_text: str).
    """
    root = ET.fromstring(xml.strip())
    hierarchy = root.find(".//hierarchy")
    if hierarchy is None:
        return False, ""

    # Search for the success predicate
    # This is intent-specific; implement per your intents
    text_elements = hierarchy.findall(".//*[@text]")
    for el in text_elements:
        t = el.get("text", "")
        if success_predicate.lower() in t.lower():
            return True, t

    return False, ""


# ============================================================================
# CLI Entry Point
# ============================================================================

def main():
    import sys

    if len(sys.argv) < 2:
        print("Usage: python3 intent_route_layer.py <intent_id>")
        print("       e.g.: python3 intent_route_layer.py compose.next")
        sys.exit(1)

    intent_id = sys.argv[1]

    if intent_id not in ROUTE_ORDER:
        print(f"Unknown intent: {intent_id}")
        print(f"Available: {', '.join(ROUTE_ORDER.keys())}")
        sys.exit(1)

    # Print route ordering for the intent
    print(f"Route ordering for intent: {intent_id}")
    print("=" * 60)
    for idx, (name, strategy, by, hint) in enumerate(ROUTE_ORDER[intent_id]):
        print(f"  Route {idx + 1}: {name}")
        print(f"    Strategy: {strategy}")
        print(f"    Appium By: {by}")
        print(f"    Success hint: {hint}")
        print()

    # TODO: integrate with driver and actually replay


if __name__ == "__main__":
    main()