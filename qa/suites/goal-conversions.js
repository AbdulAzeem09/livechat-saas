"use strict";

/**
 * A goal counts a conversion when a visitor who chatted later reaches the page the goal
 * points at.
 *
 * Goals could be created and reported on before this, but nothing ever incremented them, so
 * every workspace that set one up watched it sit at zero forever. The three things that make
 * the number trustworthy are all checked here: it only counts people who chatted, it counts
 * each of them once however often they reload, and it never counts one workspace's visitors
 * for another's goal.
 */

const { client, results, waitFor, newWorkspace, visitorIp } = require("../lib/harness");

const call = client("45.130.0.4");
const { check, finish } = results();

const THANK_YOU = "https://shop.example.com/thank-you?order=4821";

async function goalsFor(workspace) {
  const response = await call("GET", `/organizations/${workspace.organizationId}/goals`, undefined, workspace.accessToken);
  return Array.isArray(response.data) ? response.data : [];
}

async function countFor(workspace, goalId) {
  const goals = await goalsFor(workspace);
  return goals.find((goal) => goal.id === goalId)?.completedCount ?? null;
}

/** A visitor with their own browser identity, so each one is a separate person. */
async function arrive(workspace, externalId, ip, pageUrl) {
  const session = await call("POST", `/widgets/public/${workspace.widgetKey}/sessions`, {
    visitorExternalId: externalId,
    pageUrl
  }, undefined, ip);
  return session.data?.sessionToken;
}

(async () => {
  const workspace = await newWorkspace(call, "Goals");

  const created = await call("POST", `/organizations/${workspace.organizationId}/goals`, {
    name: "Order placed",
    type: "url",
    target: "/thank-you",
    valueCents: 4999
  }, workspace.accessToken);
  check("a goal can be created", created.status === 201, `${created.status}`);

  const goalId = created.data?.id;
  check("it starts at zero", created.data?.completedCount === 0, String(created.data?.completedCount));

  // ------------------------------------ someone who never chatted reaches the same page
  const browserOnly = await arrive(workspace, `nochat-${Date.now()}`, visitorIp(1), "https://shop.example.com/kettles");
  await call("POST", `/widgets/public/${workspace.widgetKey}/heartbeat`, { sessionToken: browserOnly, pageUrl: THANK_YOU }, undefined, visitorIp(1));
  await new Promise((resolve) => setTimeout(resolve, 1500));

  check("a visitor who never chatted is not counted", (await countFor(workspace, goalId)) === 0,
    `count is ${await countFor(workspace, goalId)}`);

  // ------------------------------------------- someone who chatted, then reaches the page
  const buyerId = `buyer-${Date.now()}`;
  const buyerIp = visitorIp(2);
  const buyerSession = await arrive(workspace, buyerId, buyerIp, "https://shop.example.com/kettles");
  const conversation = await call("POST", `/widgets/public/${workspace.widgetKey}/conversations`, {
    sessionToken: buyerSession,
    body: "Does this kettle ship today?"
  }, undefined, buyerIp);
  check("setup: they chatted first", conversation.status === 201, String(conversation.status));

  await call("POST", `/widgets/public/${workspace.widgetKey}/heartbeat`, { sessionToken: buyerSession, pageUrl: THANK_YOU }, undefined, buyerIp);

  const counted = await waitFor(async () => (await countFor(workspace, goalId)) === 1, { timeoutMs: 15000, everyMs: 500 });
  check("a visitor who chatted and then converted is counted", counted, `count is ${await countFor(workspace, goalId)}`);

  // ----------------------------------------------- reloading must not count again
  for (let i = 0; i < 4; i += 1) {
    await call("POST", `/widgets/public/${workspace.widgetKey}/heartbeat`, { sessionToken: buyerSession, pageUrl: "https://shop.example.com/kettles" }, undefined, buyerIp);
    await call("POST", `/widgets/public/${workspace.widgetKey}/heartbeat`, { sessionToken: buyerSession, pageUrl: THANK_YOU }, undefined, buyerIp);
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
  check("reloading the page does not count again", (await countFor(workspace, goalId)) === 1,
    `count is ${await countFor(workspace, goalId)}`);

  // --------------------------------------------- a second buyer is a second conversion
  const secondId = `buyer2-${Date.now()}`;
  const secondIp = visitorIp(3);
  const secondSession = await arrive(workspace, secondId, secondIp, "https://shop.example.com/mugs");
  await call("POST", `/widgets/public/${workspace.widgetKey}/conversations`, {
    sessionToken: secondSession,
    body: "Do you have these in blue?"
  }, undefined, secondIp);
  await call("POST", `/widgets/public/${workspace.widgetKey}/heartbeat`, { sessionToken: secondSession, pageUrl: THANK_YOU }, undefined, secondIp);

  const twice = await waitFor(async () => (await countFor(workspace, goalId)) === 2, { timeoutMs: 15000, everyMs: 500 });
  check("a different buyer counts separately", twice, `count is ${await countFor(workspace, goalId)}`);

  // ------------------------------------------------------- a page that is not the target
  const browserIp = visitorIp(4);
  const browserSession = await arrive(workspace, `other-${Date.now()}`, browserIp, "https://shop.example.com/kettles");
  await call("POST", `/widgets/public/${workspace.widgetKey}/conversations`, { sessionToken: browserSession, body: "Just looking" }, undefined, browserIp);
  await call("POST", `/widgets/public/${workspace.widgetKey}/heartbeat`, { sessionToken: browserSession, pageUrl: "https://shop.example.com/returns" }, undefined, browserIp);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  check("an unrelated page does not count", (await countFor(workspace, goalId)) === 2,
    `count is ${await countFor(workspace, goalId)}`);

  // ------------------------------------------------------------- a disabled goal is inert
  const disabled = await call("POST", `/organizations/${workspace.organizationId}/goals`, {
    name: "Switched off",
    type: "url",
    target: "/thank-you",
    enabled: false
  }, workspace.accessToken);
  const disabledIp = visitorIp(5);
  const disabledSession = await arrive(workspace, `off-${Date.now()}`, disabledIp, "https://shop.example.com/kettles");
  await call("POST", `/widgets/public/${workspace.widgetKey}/conversations`, { sessionToken: disabledSession, body: "Hello" }, undefined, disabledIp);
  await call("POST", `/widgets/public/${workspace.widgetKey}/heartbeat`, { sessionToken: disabledSession, pageUrl: THANK_YOU }, undefined, disabledIp);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  check("a disabled goal never fires", (await countFor(workspace, disabled.data?.id)) === 0,
    `count is ${await countFor(workspace, disabled.data?.id)}`);

  // ------------------------------------------------------- an empty target matches nothing
  const emptyTarget = await call("POST", `/organizations/${workspace.organizationId}/goals`, {
    name: "Unfinished goal",
    type: "url",
    target: ""
  }, workspace.accessToken);
  await new Promise((resolve) => setTimeout(resolve, 500));
  check("a goal with no target does not fire on every page", (await countFor(workspace, emptyTarget.data?.id)) === 0,
    `count is ${await countFor(workspace, emptyTarget.data?.id)}`);

  // ---------------------------------------------------------------- cross-workspace safety
  const neighbour = await newWorkspace(call, "GoalsNeighbour");
  const neighbourGoal = await call("POST", `/organizations/${neighbour.organizationId}/goals`, {
    name: "Their order page",
    type: "url",
    target: "/thank-you"
  }, neighbour.accessToken);
  check("the neighbour's goal was not touched by our visitors",
    (await countFor(neighbour, neighbourGoal.data?.id)) === 0,
    `count is ${await countFor(neighbour, neighbourGoal.data?.id)}`);

  // ------------------------------------------------------------------ the report agrees
  // Compared against the goals' own counts rather than a number written here: the figure an
  // agent reads on Reports has to be the same one the Goals screen shows, whatever it is.
  const summary = await call("GET", `/organizations/${workspace.organizationId}/reports/summary`, undefined, workspace.accessToken);
  const reported = summary.data?.campaigns?.goalsCompleted;
  const expected = (await goalsFor(workspace)).reduce((total, goal) => total + goal.completedCount, 0);
  check("the reports screen shows the same number as the goals themselves", reported === expected,
    `reports say ${reported}, goals add up to ${expected}`);

  finish();
})();
