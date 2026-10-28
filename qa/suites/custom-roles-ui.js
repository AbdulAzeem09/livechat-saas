"use strict";

/**
 * The Roles screen, driven through a real browser.
 *
 * The API behind this screen is covered by custom-roles.js; what cannot be checked over HTTP
 * is whether an agent can actually reach any of it. So this suite clicks the way a person
 * does — Team, then Roles — and then builds a role, grants it to a teammate and deletes it
 * again, confirming after each step that the API agrees with what the screen is showing.
 *
 * Needs the dashboard running (QA_WEB_URL) and Chrome installed; QA_SKIP_UI=1 skips it.
 */

const puppeteer = require("puppeteer-core");
const { client, results, WEB_URL, newWorkspace } = require("../lib/harness");

const call = client("45.130.0.11");
const { check, finish } = results();

const CHROME_CANDIDATES = [
  process.env.QA_CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].filter(Boolean);

function chromePath() {
  const fs = require("fs");
  const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));

  if (!found) {
    throw new Error(`Chrome not found. Set QA_CHROME to its path. Tried: ${CHROME_CANDIDATES.join(", ")}`);
  }

  return found;
}

/**
 * Click the control a person would click for this label. The left rail's buttons are
 * icon-only and carry their name in `title`, so the visible text alone is not enough to
 * find them.
 */
async function clickByText(page, selector, text) {
  const handles = await page.$$(selector);

  for (const handle of handles) {
    const label = await page.evaluate(
      (node) =>
        (node.textContent?.trim() || node.getAttribute("title") || node.getAttribute("aria-label") || "").replace(
          /\s+/g,
          " "
        ),
      handle
    );

    if (label === text || label.startsWith(`${text} `)) {
      await handle.click();
      return true;
    }
  }

  return false;
}

async function textOnPage(page) {
  return (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
}

async function rolesFor(workspace) {
  const response = await call("GET", `/organizations/${workspace.organizationId}/roles`, undefined, workspace.accessToken);
  return Array.isArray(response.data) ? response.data : [];
}

async function membersFor(workspace) {
  const response = await call("GET", `/organizations/${workspace.organizationId}/members`, undefined, workspace.accessToken);
  return Array.isArray(response.data) ? response.data : [];
}

(async () => {
  const workspace = await newWorkspace(call, "RolesUi");

  // The register call already handed us a real session; putting it where the app looks for it
  // starts this suite on the dashboard rather than re-testing the login form.
  const login = await call("POST", "/auth/login", {
    email: workspace.email,
    password: "OwnerPass2026"
  });
  const session = {
    accessToken: login.data?.accessToken,
    refreshToken: login.data?.refreshToken,
    user: login.data?.user,
    createdAt: new Date().toISOString()
  };
  check("the test workspace can sign in", Boolean(session.accessToken), `${login.status}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const consoleErrors = [];
    const failedRequests = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.evaluate((stored) => {
      window.localStorage.setItem("livechat.session", JSON.stringify(stored));
    }, session);

    await page.goto(`${WEB_URL}/dashboard`, { waitUntil: "networkidle2" });
    await page.waitForFunction(() => document.body.innerText.includes("Overview"), { timeout: 30000 });
    check("the dashboard loads", (await textOnPage(page)).includes("Overview"), "Overview is on the page");

    // ------------------------------------------------------------------ getting there
    const openedTeam = await clickByText(page, "button", "Team");
    check("Team is reachable from the left rail", openedTeam, openedTeam ? "clicked" : "no Team button");
    await page.waitForFunction(() => document.body.innerText.includes("Roles"), { timeout: 15000 });

    const openedRoles = await clickByText(page, "button", "Roles");
    check("Roles is reachable from the Team menu", openedRoles, openedRoles ? "clicked" : "no Roles button");

    await page.waitForFunction(() => document.body.innerText.includes("+ New role"), { timeout: 15000 });
    check("the Roles screen opens, not the agent list", (await textOnPage(page)).includes("+ New role"),
      "New role button is there");

    // The header renders before the roles are fetched, so wait for the list itself rather than
    // reading the page the moment the screen appears.
    await page.waitForFunction(() => !document.body.innerText.includes("Loading roles..."), { timeout: 15000 });
    // The badge is uppercased in CSS, so innerText reports "BUILT IN" whatever the source says.
    const rolesScreen = await textOnPage(page);
    const badged = /built in/i.test(rolesScreen);
    check("the built-in Owner role is listed", rolesScreen.includes("Owner") && badged,
      rolesScreen.includes("Owner") ? "Owner is there but not badged" : "Owner is not listed");

    // A built-in role's permissions must not be editable from here.
    const ownerCheckboxesDisabled = await page.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      return boxes.length > 0 && boxes.slice(0, 5).every((box) => box.disabled);
    });
    check("a built-in role's permissions are locked", ownerCheckboxesDisabled, "its checkboxes are disabled");

    // ------------------------------------------------------------------ building one
    await clickByText(page, "button", "+ New role");
    await page.waitForFunction(() => document.body.innerText.includes("New role"), { timeout: 10000 });

    await page.type('input[placeholder="Support Manager"]', "Night Shift Lead");
    await page.type('input[placeholder="Runs the support floor day to day"]', "Owns the overnight queue");

    // Grant one more permission than the default so the save is visibly ours.
    const tickedTransfer = await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll("label")).find((node) =>
        node.textContent?.includes("Transfer chats")
      );
      const box = label?.querySelector('input[type="checkbox"]');

      if (!box || box.disabled) {
        return false;
      }

      box.click();
      return true;
    });
    check("a permission can be ticked on the new role", tickedTransfer, "Transfer chats ticked");

    await clickByText(page, "button", "Create role");
    await page.waitForFunction(
      () => document.body.innerText.includes("Night Shift Lead"),
      { timeout: 15000 }
    );

    const createdInApi = (await rolesFor(workspace)).find((role) => role.name === "Night Shift Lead");
    check("the role the screen created really exists", Boolean(createdInApi), createdInApi ? createdInApi.id : "not in the API");
    check("it was saved with the permissions that were ticked",
      (createdInApi?.permissions ?? []).includes("chat:transfer") &&
        (createdInApi?.permissions ?? []).includes("chat:read"),
      (createdInApi?.permissions ?? []).join(", "));
    check("it was saved as a custom role, not a built-in one", createdInApi?.isSystem === false,
      String(createdInApi?.isSystem));

    // ------------------------------------------------------------------ handing it out
    const assigned = await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll("h4")).find((node) =>
        node.textContent?.includes("Who has this role")
      );
      const list = heading?.parentElement;
      const box = list?.querySelector('input[type="checkbox"]');

      if (!box) {
        return false;
      }

      box.click();
      return true;
    });
    check("a teammate can be ticked for the role", assigned, assigned ? "ticked" : "no member checkbox found");

    const owner = (await membersFor(workspace))[0];
    let holdsRole = false;
    for (let attempt = 0; attempt < 20 && !holdsRole; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const member = (await membersFor(workspace)).find((entry) => entry.id === owner?.id);
      holdsRole = (member?.roles ?? []).includes("Night Shift Lead");
    }
    check("ticking the box really granted the role", holdsRole, holdsRole ? "the API agrees" : "the API never saw it");

    // ------------------------------------------------------------------ taking it away
    const unassigned = await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll("h4")).find((node) =>
        node.textContent?.includes("Who has this role")
      );
      const box = heading?.parentElement?.querySelector('input[type="checkbox"]');

      if (!box || !box.checked) {
        return false;
      }

      box.click();
      return true;
    });
    check("the same box takes the role back", unassigned, unassigned ? "unticked" : "box was not ticked");

    let revoked = false;
    for (let attempt = 0; attempt < 20 && !revoked; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const member = (await membersFor(workspace)).find((entry) => entry.id === owner?.id);
      revoked = !(member?.roles ?? []).includes("Night Shift Lead");
    }
    check("unticking really revoked it", revoked, revoked ? "the API agrees" : "the API still has it");

    // ------------------------------------------------------------------ deleting it
    page.on("dialog", (dialog) => void dialog.accept());
    await clickByText(page, "button", "Delete role");

    let deleted = false;
    for (let attempt = 0; attempt < 20 && !deleted; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      deleted = !(await rolesFor(workspace)).some((role) => role.name === "Night Shift Lead");
    }
    check("the screen can delete the role it made", deleted, deleted ? "gone from the API" : "still there");

    const ownerSurvived = (await rolesFor(workspace)).some((role) => role.key === "OWNER");
    check("deleting a custom role left the built-in one alone", ownerSurvived, ownerSurvived ? "Owner intact" : "Owner gone");

    // A screen that works but throws on every render would still pass everything above.
    const realErrors = consoleErrors.filter(
      (message) => !/favicon|ERR_BLOCKED|socket|websocket|net::ERR|status of 40/i.test(message)
    );
    check("the screen rendered without console errors", realErrors.length === 0,
      realErrors.slice(0, 2).join(" | ") || "none");

    // Console text does not say which request failed, so the responses are tracked separately.
    const rolesRequestsFailed = failedRequests.filter((entry) => /\/roles|\/members/.test(entry));
    check("no roles or members request came back an error", rolesRequestsFailed.length === 0,
      rolesRequestsFailed.slice(0, 3).join(" | ") || "none");

    if (failedRequests.length) {
      console.log(`      (other failed requests: ${failedRequests.slice(0, 5).join(" | ")})`);
    }
  } finally {
    await browser.close();
  }

  finish();
})();
