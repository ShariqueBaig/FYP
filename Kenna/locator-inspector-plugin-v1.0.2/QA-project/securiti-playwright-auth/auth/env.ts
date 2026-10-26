/**
 * Configuration loading. Deliberately dependency-free: this package ships as a
 * zip and must install with nothing but @playwright/test, so we parse `.env`
 * ourselves rather than pulling in `dotenv`.
 *
 * There are two readers, and the split matters:
 *
 *   readRunnerConfig()  runs at config-load time and MUST NEVER THROW. A throw
 *                       here breaks `--list`, `--ui` and `show-report`, and
 *                       surfaces as a raw stack trace rather than a test failure.
 *
 *   readCredentials()   runs inside the auth setup test, so its errors land in
 *                       the HTML report where someone will actually read them.
 */

import fs from "fs";
import path from "path";

/** Package root, resolved from this file so the current working directory never matters. */
export const PACKAGE_ROOT = path.resolve(__dirname, "..");

// -------------------------------------------------------------------------- //
// .env parsing
// -------------------------------------------------------------------------- //

/** `KEY=value`, tolerating a leading `export `. The first `=` wins, so values may contain `=`. */
const KV = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

const DOUBLE_QUOTE_ESCAPES: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  '"': '"',
  "\\": "\\",
};

/**
 * Minimal `.env` parser. Unsupported on purpose, and documented in `.env.example`:
 * variable expansion (a `$` stays a literal `$`, which is what you want for
 * passwords) and multi-line values.
 */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = KV.exec(line);
    if (!match) continue; // ignore junk rather than crashing on it

    const key = match[1];
    let value = match[2].trim();

    const quote = value[0];
    const isQuoted =
      (quote === '"' || quote === "'" || quote === "`") && value.length > 1 && value.endsWith(quote);

    if (isQuoted) {
      value = value.slice(1, -1);
      if (quote === '"') {
        value = value.replace(/\\([nrt"\\])/g, (_, c: string) => DOUBLE_QUOTE_ESCAPES[c] ?? c);
      }
    } else {
      // Strip a trailing comment only when whitespace precedes the `#`, so that
      // an unquoted password like `abc#123` survives intact.
      value = value.replace(/\s+#.*$/, "").trim();
    }

    out[key] = value;
  }

  return out;
}

let envLoaded = false;

/**
 * Merge `.env` into `process.env` without clobbering anything already set.
 * Idempotent; safe to call from both the config and the setup test.
 */
export function loadEnv(): void {
  if (envLoaded) return;
  envLoaded = true;

  const requested = process.env.ENV_FILE ?? ".env";
  const file = path.isAbsolute(requested) ? requested : path.join(PACKAGE_ROOT, requested);
  if (!fs.existsSync(file)) return; // .env is optional; everything can come from the real environment

  let parsed: Record<string, string>;
  try {
    parsed = parseEnv(fs.readFileSync(file, "utf8"));
  } catch {
    return; // an unreadable .env must not take down config loading
  }

  for (const [key, value] of Object.entries(parsed)) {
    // `in`, not truthiness: an explicitly-empty real variable must be able to
    // clear a value from the file (`AUTH_MFA_CODE= npx playwright test`).
    if (!(key in process.env)) process.env[key] = value;
  }
}

// -------------------------------------------------------------------------- //
// Typed accessors
// -------------------------------------------------------------------------- //

/** Reads a variable, treating empty/whitespace as unset. */
function raw(key: string): string | undefined {
  const value = process.env[key];
  return value === undefined || value.trim() === "" ? undefined : value;
}

/** Where a value came from. Surfaced in logs because a stray shell `export` silently beats `.env`. */
export type ValueSource = "process.env" | ".env" | "default";

function sourceOf(key: string, fileKeys: Set<string>): ValueSource {
  if (raw(key) === undefined) return "default";
  return fileKeys.has(key) ? ".env" : "process.env";
}

export function required(key: string, hint?: string): string {
  const value = raw(key);
  if (value !== undefined) return value;
  throw new Error(
    [
      `Missing required setting ${key}.`,
      ``,
      `  1. cd ${PACKAGE_ROOT}`,
      `  2. cp .env.example .env      (if you have not already)`,
      `  3. set ${key}=...`,
      ...(hint ? [`  note: ${hint}`] : []),
      ``,
      `  Or supply it for a single run:  ${key}=... npx playwright test`,
    ].join("\n"),
  );
}

export function optional(key: string, fallback?: string): string | undefined {
  return raw(key) ?? fallback;
}

export function num(key: string, fallback: number): number {
  const value = raw(key);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${key} must be a number, got "${value}".`);
  return parsed;
}

export function bool(key: string, fallback: boolean): boolean {
  const value = raw(key)?.toLowerCase();
  if (value === undefined) return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  throw new Error(`${key} must be true or false, got "${value}".`);
}

export interface Viewport {
  width: number;
  height: number;
}

export function viewport(key: string, fallback: Viewport): Viewport {
  const value = raw(key);
  if (value === undefined) return fallback;
  const match = /^(\d{3,5})\s*[xX*,]\s*(\d{3,5})$/.exec(value.trim());
  if (!match) throw new Error(`${key} must look like 1920x1080, got "${value}".`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function list(key: string, fallback: string[]): string[] {
  const value = raw(key);
  if (value === undefined) return fallback;
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

// -------------------------------------------------------------------------- //
// Runner configuration
// -------------------------------------------------------------------------- //

export type AuthBrowser = "chromium" | "firefox" | "webkit";

export interface RunnerConfig {
  /** Login page. Hash-routed, so the `/#/` suffix is meaningful. */
  loginUrl: string;
  /** The app the recorded specs drive. Also `baseURL` and the session-probe target. */
  appUrl: string;
  /** Origins visited after login so their localStorage lands in storageState. */
  warmUrls: string[];

  authFile: string;
  metaFile: string;

  maxAgeMinutes: number;
  force: boolean;
  includeIndexedDB: boolean;

  headless: boolean;
  viewport: Viewport;
  authBrowser: AuthBrowser;

  workers: number;
  retries: number;
  timezoneId: string;

  testTimeout: number;
  expectTimeout: number;
  actionTimeout: number;
  navigationTimeout: number;
  loginTimeout: number;
}

const DEFAULT_LOGIN_URL = "https://qa.securiti.xyz/#/";
const DEFAULT_APP_URL = "https://edc.qa.securiti.xyz/";

function coerceAuthBrowser(value: string | undefined): AuthBrowser {
  if (value === undefined) return "chromium";
  const normalized = value.trim().toLowerCase();
  if (normalized === "chromium" || normalized === "firefox" || normalized === "webkit") {
    return normalized;
  }
  // Never throw from here: this runs at config-load time.
  console.warn(`[auth] AUTH_BROWSER="${value}" is not chromium|firefox|webkit - falling back to chromium.`);
  return "chromium";
}

/**
 * Read every runner knob. Never throws: any malformed value falls back to its
 * default with a warning, because a throw at config-load time is far more
 * disruptive than a wrong viewport.
 */
export function readRunnerConfig(): RunnerConfig {
  loadEnv();

  const safe = <T>(read: () => T, fallback: T): T => {
    try {
      return read();
    } catch (error) {
      console.warn(`[auth] ${(error as Error).message} Using the default instead.`);
      return fallback;
    }
  };

  const appUrl = optional("APP_URL", DEFAULT_APP_URL)!;
  const authDir = path.join(PACKAGE_ROOT, ".auth");

  return {
    loginUrl: optional("AUTH_LOGIN_URL", DEFAULT_LOGIN_URL)!,
    appUrl,
    warmUrls: list("AUTH_WARM_URLS", [appUrl]),

    authFile: path.join(authDir, "user.json"),
    metaFile: path.join(authDir, "user.meta.json"),

    maxAgeMinutes: safe(() => num("AUTH_STATE_MAX_AGE_MINUTES", 120), 120),
    force: safe(() => bool("AUTH_FORCE", false), false),
    includeIndexedDB: safe(() => bool("AUTH_INCLUDE_INDEXEDDB", false), false),

    headless: safe(() => bool("HEADLESS", false), false),
    viewport: safe(() => viewport("VIEWPORT", { width: 1920, height: 1080 }), { width: 1920, height: 1080 }),
    authBrowser: coerceAuthBrowser(optional("AUTH_BROWSER")),

    workers: safe(() => num("WORKERS", 1), 1),
    retries: safe(() => num("RETRIES", 0), 0),
    timezoneId: optional("TZ_ID", "UTC")!,

    testTimeout: safe(() => num("TEST_TIMEOUT", 180_000), 180_000),
    expectTimeout: safe(() => num("EXPECT_TIMEOUT", 20_000), 20_000),
    actionTimeout: safe(() => num("ACTION_TIMEOUT", 30_000), 30_000),
    navigationTimeout: safe(() => num("NAVIGATION_TIMEOUT", 60_000), 60_000),
    loginTimeout: safe(() => num("LOGIN_TIMEOUT", 90_000), 90_000),
  };
}

// -------------------------------------------------------------------------- //
// Credentials
// -------------------------------------------------------------------------- //

export interface Credentials {
  email: string;
  password: string;
  /** Appended directly to the password when present. There is no separate OTP field. */
  mfaCode?: string;
  /** Only used if the "Select Domain" step appears. */
  domain?: string;
  /** Which layer each value came from, so a stray shell export is visible in the log. */
  sources: Record<string, ValueSource>;
}

/**
 * Read the credentials. Throws a report-friendly error naming the missing key.
 * Call this from inside a test, never from the config.
 */
export function readCredentials(): Credentials {
  loadEnv();

  // Re-parse the file purely to attribute each value to a source for logging.
  let fileKeys = new Set<string>();
  try {
    const file = path.join(PACKAGE_ROOT, process.env.ENV_FILE ?? ".env");
    if (fs.existsSync(file)) fileKeys = new Set(Object.keys(parseEnv(fs.readFileSync(file, "utf8"))));
  } catch {
    /* attribution is a nicety; never let it fail the run */
  }

  const email = required("AUTH_EMAIL", "the address you log into the Securiti app with");
  const password = required(
    "AUTH_PASSWORD",
    'quote it if it contains spaces or a "#", e.g. AUTH_PASSWORD="p@ss word #1"',
  );

  return {
    email,
    password,
    mfaCode: optional("AUTH_MFA_CODE"),
    domain: optional("AUTH_DOMAIN"),
    sources: {
      AUTH_EMAIL: sourceOf("AUTH_EMAIL", fileKeys),
      AUTH_PASSWORD: sourceOf("AUTH_PASSWORD", fileKeys),
      AUTH_MFA_CODE: sourceOf("AUTH_MFA_CODE", fileKeys),
      AUTH_DOMAIN: sourceOf("AUTH_DOMAIN", fileKeys),
    },
  };
}

/** True when the host looks like a qa/dev environment, which require the MFA suffix. */
export function looksLikeQaOrDev(url: string): boolean {
  try {
    return /(^|[.-])(qa|dev)([.-]|$)/i.test(new URL(url).hostname);
  } catch {
    return /(^|[.-])(qa|dev)([.-]|$)/i.test(url);
  }
}
