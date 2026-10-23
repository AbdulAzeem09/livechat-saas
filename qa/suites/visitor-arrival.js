"use strict";

/**
 * A visitor landing on a customer's website reaches the agents immediately, and a hundred
 * landing together still all get through.
 *
 * Before this, Traffic found out on its next ten-second poll and only while an agent happened
 * to be looking at that screen, so someone browsing for half a minute could come and go unseen.
 */

const { io } = require("socket.io-client");
const { SOCKET_URL, client, results, sleep, waitFor, newWorkspace, visitorIp } = require("../lib/harness");

const call = client("45.70.0.1");
const { check, finish } = results();

function connectAgent(token, organizationId) {
  const socket = io(`${SOCKET_URL}/chat`, { transports: ["websocket"], auth: { token, organizationId } });

  return new Promise((resolve) => {
    socket.on("chat.ready", () => resolve(socket));
    socket.on("connect_error", () => resolve(null));
    setTimeout(() => resolve(null), 10000);
  });
}

(async () => {
  const workspace = await newWorkspace(call, "Arrival");
  const other = await newWorkspace(call, "Arrival Other");

  const agent = await connectAgent(workspace.accessToken, workspace.organizationId);
  check("the agent dashboard socket connects", Boolean(agent));

  const bystander = await connectAgent(other.accessToken, other.organizationId);
  check("setup: a second workspace is also listening", Boolean(bystander));

  const arrivals = [];
  const heardElsewhere = [];
  agent.on("visitor.arrived", (payload) => arrivals.push({ at: Date.now(), payload }));
  bystander.on("visitor.arrived", (payload) => heardElsewhere.push(payload));

  // ---------------------------------------------------------------- one visitor lands
  const sentAt = Date.now();
  const session = await call("POST", `/widgets/public/${workspace.widgetKey}/sessions`, {
    pageUrl: "https://shop.example.com/kettles",
    pageTitle: "Kettles",
    referrer: "https://www.google.com/search?q=kettles"
  });
  check("the visitor session is created", session.status === 201, String(session.status));

  await waitFor(() => arrivals.length > 0, { timeoutMs: 8000, everyMs: 50 });

  const first = arrivals[0];
  check("the agent is told a visitor arrived, without polling", Boolean(first), `${arrivals.length} events`);

  const latency = first ? first.at - sentAt : Infinity;
  check("it arrives in well under the old ten-second poll", latency < 3000, `${latency}ms`);

  const visitor = first?.payload?.visitor;
  check("the pushed visitor carries an id", Boolean(visitor?.id), String(visitor?.id));
  check("they are marked Browsing", visitor?.activity === "Browsing", String(visitor?.activity));
  check("the page they landed on comes with it", visitor?.currentPage === "https://shop.example.com/kettles", String(visitor?.currentPage));
  check("so does where they came from", visitor?.referrer === "https://www.google.com/search?q=kettles", String(visitor?.referrer));
  check("no chat is attached yet", visitor?.activeConversationId === null, String(visitor?.activeConversationId));

  // The dashboard opens the detail panel from this id, so it has to be the real visitor.
  const detail = await call("GET", `/organizations/${workspace.organizationId}/visitors/${visitor?.id}`, undefined, workspace.accessToken);
  check("the id in the push is a visitor the API knows", detail.status === 200, String(detail.status));

  check("the other workspace heard nothing", heardElsewhere.length === 0, `${heardElsewhere.length} events`);

  // ------------------------------------------------- a hundred, each from their own machine
  arrivals.length = 0;
  const BURST = 100;
  const burstSentAt = Date.now();
  const burst = await Promise.all(
    Array.from({ length: BURST }, (_, index) =>
      call("POST", `/widgets/public/${workspace.widgetKey}/sessions`, { pageUrl: `https://shop.example.com/p/${index}` }, undefined, visitorIp(index))
    )
  );
  const created = burst.filter((item) => item.status === 201).length;
  check("all 100 sessions are accepted at once", created === BURST, `${created}/${BURST}, statuses: ${[...new Set(burst.map((b) => b.status))].join(",")}`);

  await waitFor(() => arrivals.length >= BURST, { timeoutMs: 20000, everyMs: 50 });
  check("every one of the 100 arrivals reaches the agent", arrivals.length === BURST, `${arrivals.length}/${BURST}`);

  const burstLatency = arrivals.length ? arrivals[arrivals.length - 1].at - burstSentAt : Infinity;
  check("the burst does not stall the stream", burstLatency < 15000, `last event at ${burstLatency}ms`);

  const uniqueIds = new Set(arrivals.map((item) => item.payload?.visitor?.id));
  check("each push is a distinct visitor, none duplicated", uniqueIds.size === arrivals.length, `${uniqueIds.size} unique of ${arrivals.length}`);

  // A burst that killed the connection would leave the agent silently blind from then on.
  check("the socket is still connected after the burst", agent.connected === true, String(agent.connected));

  arrivals.length = 0;
  await call("POST", `/widgets/public/${workspace.widgetKey}/sessions`, { pageUrl: "https://shop.example.com/after" }, undefined, visitorIp(BURST + 5));
  await waitFor(() => arrivals.length > 0, { timeoutMs: 8000, everyMs: 50 });
  check("a visitor arriving after the burst is still announced", arrivals.length === 1, `${arrivals.length} events`);

  agent.close();
  bystander.close();
  await sleep(100);
  finish();
})();
