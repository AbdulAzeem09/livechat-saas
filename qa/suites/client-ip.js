"use strict";

/**
 * Per-IP bans and rate limits are only worth having if the caller cannot pick their own IP.
 *
 * X-Forwarded-For is a list the caller starts and each proxy appends to, so only the entries
 * our own proxy added may be believed. Reading the left-hand end once let anyone mint a fresh
 * rate-limit bucket per request by typing a different address each time.
 *
 * There is no nginx in front of the API this suite talks to, so the suite plays the proxy:
 * it sends the chain exactly as nginx hands it over — "<what the caller claimed>, <what the
 * proxy actually saw>" — and checks the bucket follows the last entry, not the first.
 */

const { API_URL, client, results, sleep, newWorkspace } = require("../lib/harness");

const call = client("45.80.0.1");
const { check, finish } = results();

/** The widget session limit is 60 a minute per client. Push past it and count what got through. */
const OVER_LIMIT = 80;

async function burst(widgetKey, chainFor) {
  const out = await Promise.all(
    Array.from({ length: OVER_LIMIT }, (_, index) =>
      call("POST", `/widgets/public/${widgetKey}/sessions`, { pageUrl: `https://shop.example.com/${index}` }, undefined, chainFor(index))
    )
  );

  return {
    accepted: out.filter((item) => item.status === 201).length,
    throttled: out.filter((item) => item.status === 429).length
  };
}

(async () => {
  const workspace = await newWorkspace(call, "ClientIp");
  check("setup: a workspace to aim at", Boolean(workspace.widgetKey));

  // ------------------------------------- one caller claiming a different IP every request
  const spoofed = await burst(workspace.widgetKey, (index) => `45.90.${Math.floor(index / 254)}.${(index % 254) + 1}, 45.99.0.7`);
  check("a caller who renames themselves each request is still throttled", spoofed.throttled > 0,
    `${spoofed.accepted}/${OVER_LIMIT} accepted, ${spoofed.throttled} throttled`);
  check("and gets no more through than one caller is allowed", spoofed.accepted <= 60,
    `${spoofed.accepted} accepted (limit 60)`);

  // --------------------------------- genuinely separate people are not punished for it
  const real = await burst(workspace.widgetKey, (index) => `45.91.0.1, 45.100.${Math.floor(index / 254)}.${(index % 254) + 1}`);
  check("separate visitors are each given their own allowance", real.accepted === OVER_LIMIT,
    `${real.accepted}/${OVER_LIMIT} accepted`);

  // ------------------------------------------------ a CDN header is not a free pass either
  const cdn = await Promise.all(
    Array.from({ length: OVER_LIMIT }, (_, index) =>
      fetch(`${API_URL}/widgets/public/${workspace.widgetKey}/sessions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "45.92.0.1, 45.99.0.8",
          "cf-connecting-ip": `45.93.${Math.floor(index / 254)}.${(index % 254) + 1}`,
          "true-client-ip": `45.94.${Math.floor(index / 254)}.${(index % 254) + 1}`
        },
        body: JSON.stringify({ pageUrl: `https://shop.example.com/cdn/${index}` })
      }).then((response) => response.status)
    )
  );
  check("claiming a CDN header does not mint a new identity", cdn.filter((status) => status === 429).length > 0,
    `${cdn.filter((status) => status === 201).length}/${OVER_LIMIT} accepted`);

  // ------------------------------- the address we store is the real one, not the claimed one
  await sleep(1000);
  const live = await call("GET", `/organizations/${workspace.organizationId}/visitors/live`, undefined, workspace.accessToken);
  const invented = Array.isArray(live.data)
    ? live.data.filter((row) => typeof row.ip === "string" && /^45\.(90|93|94)\./.test(row.ip))
    : [];
  check("no visitor is recorded under an address the caller invented", invented.length === 0,
    `${invented.length} rows carry a claimed ip`);

  finish();
})();
