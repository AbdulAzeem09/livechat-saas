"use strict";

/**
 * A visitor's question is answered from the workspace's own knowledge, with no AI key present.
 *
 * This is the state a workspace is in before anyone pays for an Anthropic key: the assistant
 * cannot compose anything, so the fallback posts whichever published article matches the
 * visitor's words. It is crude — a broad question pulls a loosely-related article — but it must
 * work, because it is what every new workspace gets for free.
 */

const { client, results, waitFor, newWorkspace } = require("../lib/harness");

const call = client("45.120.0.9");
const { check, note, finish } = results();

/** Deliberately small and distinct, so a match is unambiguous rather than lucky. */
const ARTICLES = [
  {
    title: "Installing the chat widget",
    category: "Getting started",
    published: true,
    content:
      "Paste this line just before the closing body tag of every page:\n\n" +
      '<script async src="https://talkzen.tech/api/v1/widget.js" data-widget-key="YOUR_KEY"></script>\n\n' +
      "Reload the page and the chat bubble appears in the corner."
  },
  {
    title: "Refund policy",
    category: "Billing",
    published: true,
    content: "Refunds are given within 30 days of purchase. Tell us the order number and the money goes back to the original card."
  },
  {
    title: "Opening hours",
    category: "Getting started",
    published: true,
    content: "The team answers chats Monday to Friday, 9am to 6pm. Outside those hours leave an email address and we reply the next working day."
  },
  {
    title: "An unpublished draft nobody should ever be shown",
    category: "Internal",
    published: false,
    content: "Internal note about refunds that must never reach a visitor."
  }
];

(async () => {
  const workspace = await newWorkspace(call, "Knowledge");

  const created = [];
  for (const article of ARTICLES) {
    const response = await call("POST", `/organizations/${workspace.organizationId}/knowledge`, article, workspace.accessToken);
    created.push(response.status);
  }
  check("every article is accepted by the knowledge hub", created.every((status) => status === 201),
    `statuses: ${[...new Set(created)].join(",")}`);

  const list = await call("GET", `/organizations/${workspace.organizationId}/knowledge`, undefined, workspace.accessToken);
  check("they are all there afterwards", Array.isArray(list.data) && list.data.length === ARTICLES.length,
    `${Array.isArray(list.data) ? list.data.length : "?"} listed`);

  // --------------------------------------------------- a visitor asks something covered
  const session = await call("POST", `/widgets/public/${workspace.widgetKey}/sessions`, { pageUrl: "https://talkzen.tech/pricing" });
  const conversation = await call("POST", `/widgets/public/${workspace.widgetKey}/conversations`, {
    sessionToken: session.data.sessionToken,
    body: "What is your refund policy?"
  });
  check("the visitor can start a chat", conversation.status === 201, String(conversation.status));

  const conversationId = conversation.data?.conversation?.id;
  let reply = null;
  await waitFor(async () => {
    const messages = await call("GET", `/organizations/${workspace.organizationId}/conversations/${conversationId}/messages`, undefined, workspace.accessToken);
    const items = Array.isArray(messages.data) ? messages.data : (messages.data?.items ?? []);
    reply = items.find((message) => message.senderType !== "VISITOR" && message.body) ?? null;
    return Boolean(reply);
  });

  check("the visitor is answered automatically, with no Anthropic key configured", Boolean(reply),
    reply ? `${reply.body.slice(0, 60).replace(/\n/g, " ")}…` : "no automatic reply arrived");

  const cited = reply ? ((reply.body.match(/— from "(.+)"/) ?? [])[1] ?? "") : "";
  check("the answer is drawn from the knowledge base, not a canned greeting", Boolean(cited), `cites: ${cited || "nothing"}`);
  check("and it is the article that actually answers the question", /refund/i.test(cited), `cites: ${cited}`);
  check("an unpublished draft is never sent to a visitor", !/unpublished draft/i.test(reply?.body ?? ""),
    reply ? reply.body.slice(0, 60).replace(/\n/g, " ") : "n/a");

  note("without an AI key the fallback posts a whole article verbatim; an Anthropic key is what");
  note("lets the assistant compose an answer from the right articles instead.");

  finish();
})();
