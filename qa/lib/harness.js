"use strict";

/**
 * Shared plumbing for the end-to-end suites.
 *
 * Every suite talks to a running API over HTTP exactly as a real client would — no mocks and
 * no imports from apps/api — so what passes here is what a browser or a widget would get.
 */

const API_URL = (process.env.QA_API_URL || "http://127.0.0.1:4100/api/v1").replace(/\/$/, "");
const WEB_URL = (process.env.QA_WEB_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

/** Socket.IO lives at the server root, not under the API prefix. */
const SOCKET_URL = API_URL.replace(/\/api\/v\d+$/, "");

/**
 * Per-IP rate limits are real, so each suite claims its own address. Pass a suite's own
 * CLIENT_IP into client() and its requests never eat another suite's allowance.
 */
function client(clientIp) {
  return async function call(method, path, body, token, ip = clientIp) {
    const response = await fetch(API_URL + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(ip ? { "x-forwarded-for": ip } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: response.status, data };
  };
}

/** Collects results and prints the "N/N passed" line the runner checks for. */
function results() {
  const outcomes = [];

  return {
    /** Record one check. `info` is printed on both pass and fail — it is how you debug a failure. */
    check(name, passed, info = "") {
      outcomes.push(Boolean(passed));
      console.log(`${passed ? "PASS" : "FAIL"}  ${name}${info ? `  -> ${info}` : ""}`);
    },
    /** Free-text line for something worth knowing that is not a pass/fail. */
    note(text) {
      console.log(`NOTE  ${text}`);
    },
    /** Print the summary and exit. The runner treats anything else as a failure. */
    finish() {
      console.log(`\n${outcomes.filter(Boolean).length}/${outcomes.length} passed`);
      process.exit(outcomes.every(Boolean) ? 0 : 1);
    }
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll until `predicate()` is true, instead of sleeping a guessed amount. Returns whether it
 * came true — a fixed sleep either makes the suite slow or makes it flaky, and usually both.
 */
async function waitFor(predicate, { timeoutMs = 20000, everyMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    if (await predicate()) {
      return true;
    }
    if (Date.now() >= deadline) {
      return false;
    }
    await sleep(everyMs);
  }
}

/** A fresh workspace with an owner, so suites never share state. */
async function newWorkspace(call, label) {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const registration = await call("POST", "/auth/register", {
    name: `${label} Owner`,
    email: `${label.toLowerCase().replace(/[^a-z0-9]/g, "")}${stamp}@example.com`,
    password: "OwnerPass2026",
    organizationName: `${label} ${stamp}`
  });

  const organizationId = registration.data?.user?.memberships?.[0]?.organizationId;
  const accessToken = registration.data?.accessToken;

  if (!organizationId || !accessToken) {
    throw new Error(`could not register a workspace: ${JSON.stringify(registration.data).slice(0, 200)}`);
  }

  const widget = await call("GET", `/organizations/${organizationId}/widgets/default`, undefined, accessToken);

  return {
    organizationId,
    accessToken,
    widgetKey: widget.data?.publicKey,
    email: `${label.toLowerCase().replace(/[^a-z0-9]/g, "")}${stamp}@example.com`
  };
}

/**
 * A routable public address per simulated visitor. Reserved ranges (203.0.113.x and friends)
 * are rejected as non-public by the API, so simulating separate people needs real ones.
 */
function visitorIp(index) {
  return `45.${33 + Math.floor(index / 64516)}.${Math.floor(index / 254) % 254}.${(index % 254) + 1}`;
}

module.exports = { API_URL, WEB_URL, SOCKET_URL, client, results, sleep, waitFor, newWorkspace, visitorIp };
