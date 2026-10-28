"use strict";

/**
 * Custom roles: what a workspace can hand out, and who holds it.
 *
 * The dashboard's Roles screen is only as trustworthy as the rules underneath it, so the
 * guard rails are what this suite pins down: a built-in role cannot be rewritten or deleted,
 * two roles cannot share a name, an invented permission is refused rather than stored, and a
 * role belongs to the workspace that made it and is invisible to everyone else. The ordinary
 * path — create, edit, assign, revoke, delete — is checked alongside them, because a screen
 * that cannot complete that round trip is no use however well guarded it is.
 */

const { client, results, newWorkspace } = require("../lib/harness");

const call = client("45.130.0.9");
const { check, finish } = results();

async function rolesFor(workspace) {
  const response = await call("GET", `/organizations/${workspace.organizationId}/roles`, undefined, workspace.accessToken);
  return Array.isArray(response.data) ? response.data : [];
}

async function membersFor(workspace) {
  const response = await call("GET", `/organizations/${workspace.organizationId}/members`, undefined, workspace.accessToken);
  return Array.isArray(response.data) ? response.data : [];
}

(async () => {
  const workspace = await newWorkspace(call, "Roles");

  // ------------------------------------------------------------------ what ships with a workspace
  const initial = await rolesFor(workspace);
  const systemRoles = initial.filter((role) => role.isSystem);
  check("a new workspace already has built-in roles", systemRoles.length > 0, `${systemRoles.length} built in`);

  const ownerRole = initial.find((role) => role.key === "OWNER");
  check("one of them is Owner", Boolean(ownerRole), ownerRole ? ownerRole.name : "not found");

  // ------------------------------------------------------------------ creating one
  const created = await call("POST", `/organizations/${workspace.organizationId}/roles`, {
    name: "Support Manager",
    description: "Runs the support floor day to day",
    permissions: ["chat:read", "chat:write", "analytics:read"]
  }, workspace.accessToken);
  check("a custom role can be created", created.status === 201, `${created.status}`);

  const roleId = created.data?.id;
  check("it is not marked as built in", created.data?.isSystem === false, String(created.data?.isSystem));
  check("it keeps the permissions it was given", (created.data?.permissions ?? []).length === 3,
    (created.data?.permissions ?? []).join(", "));

  // ------------------------------------------------------------------ the guard rails
  const duplicate = await call("POST", `/organizations/${workspace.organizationId}/roles`, {
    name: "Support Manager",
    permissions: ["chat:read"]
  }, workspace.accessToken);
  check("a second role cannot reuse the name", duplicate.status === 409, `${duplicate.status}`);

  const invented = await call("POST", `/organizations/${workspace.organizationId}/roles`, {
    name: "Nonsense",
    permissions: ["chat:read", "database:drop"]
  }, workspace.accessToken);
  check("an invented permission is refused", invented.status === 400, `${invented.status}`);

  const afterRefusals = await rolesFor(workspace);
  check("neither refusal left a role behind", afterRefusals.filter((role) => !role.isSystem).length === 1,
    `${afterRefusals.filter((role) => !role.isSystem).length} custom roles`);

  const editSystem = await call("PATCH", `/organizations/${workspace.organizationId}/roles/${ownerRole?.id}`, {
    permissions: ["chat:read"]
  }, workspace.accessToken);
  check("a built-in role cannot be rewritten", editSystem.status === 400, `${editSystem.status}`);

  const deleteSystem = await call("DELETE", `/organizations/${workspace.organizationId}/roles/${ownerRole?.id}`, undefined, workspace.accessToken);
  check("a built-in role cannot be deleted", deleteSystem.status === 400, `${deleteSystem.status}`);

  const ownerStillThere = (await rolesFor(workspace)).find((role) => role.key === "OWNER");
  check("Owner survived both attempts", Boolean(ownerStillThere), ownerStillThere ? "still there" : "gone");

  // ------------------------------------------------------------------ editing it
  const updated = await call("PATCH", `/organizations/${workspace.organizationId}/roles/${roleId}`, {
    name: "Floor Manager",
    permissions: ["chat:read", "chat:write", "chat:transfer", "analytics:read"]
  }, workspace.accessToken);
  check("a custom role can be renamed and re-permissioned", updated.status === 200, `${updated.status}`);
  check("the new name stuck", updated.data?.name === "Floor Manager", String(updated.data?.name));
  check("the new permissions stuck", (updated.data?.permissions ?? []).includes("chat:transfer"),
    (updated.data?.permissions ?? []).join(", "));

  // ------------------------------------------------------------------ who holds it
  const members = await membersFor(workspace);
  const owner = members[0];
  check("the workspace has a member to assign to", Boolean(owner?.id), owner ? owner.email : "none");

  const assigned = await call("POST", `/organizations/${workspace.organizationId}/members/${owner?.id}/roles/${roleId}`, undefined, workspace.accessToken);
  check("the role can be assigned to a member", assigned.status === 201 || assigned.status === 200, `${assigned.status}`);

  // The members list is what the dashboard reads to tick its checkboxes, so the assignment has
  // to be visible there and not only in the assignment response.
  const afterAssign = (await membersFor(workspace)).find((member) => member.id === owner?.id);
  check("the member list shows the new role", (afterAssign?.roles ?? []).includes("Floor Manager"),
    (afterAssign?.roles ?? []).join(", "));

  const assignedTwice = await call("POST", `/organizations/${workspace.organizationId}/members/${owner?.id}/roles/${roleId}`, undefined, workspace.accessToken);
  const afterSecond = (await membersFor(workspace)).find((member) => member.id === owner?.id);
  const floorCount = (afterSecond?.roles ?? []).filter((role) => role === "Floor Manager").length;
  check("assigning the same role twice does not duplicate it",
    (assignedTwice.status === 201 || assignedTwice.status === 200) && floorCount === 1, `listed ${floorCount} times`);

  const revoked = await call("DELETE", `/organizations/${workspace.organizationId}/members/${owner?.id}/roles/${roleId}`, undefined, workspace.accessToken);
  check("the role can be revoked", revoked.status === 200, `${revoked.status}`);

  const afterRevoke = (await membersFor(workspace)).find((member) => member.id === owner?.id);
  check("the member list drops it again", !(afterRevoke?.roles ?? []).includes("Floor Manager"),
    (afterRevoke?.roles ?? []).join(", "));

  check("revoking a custom role did not cost them Owner", (afterRevoke?.roles ?? []).includes("OWNER"),
    (afterRevoke?.roles ?? []).join(", "));

  // ------------------------------------------------------------------ it belongs to one workspace
  const neighbour = await newWorkspace(call, "Neighbour");

  const neighbourSees = await rolesFor(neighbour);
  check("a neighbouring workspace does not see our role",
    !neighbourSees.some((role) => role.name === "Floor Manager"),
    neighbourSees.map((role) => role.name).join(", "));

  const neighbourEdit = await call("PATCH", `/organizations/${neighbour.organizationId}/roles/${roleId}`, {
    name: "Hijacked"
  }, neighbour.accessToken);
  check("they cannot edit it through their own workspace", neighbourEdit.status === 404, `${neighbourEdit.status}`);

  const neighbourDelete = await call("DELETE", `/organizations/${neighbour.organizationId}/roles/${roleId}`, undefined, neighbour.accessToken);
  check("they cannot delete it either", neighbourDelete.status === 404, `${neighbourDelete.status}`);

  const stillOurs = (await rolesFor(workspace)).find((role) => role.id === roleId);
  check("our role came through untouched", stillOurs?.name === "Floor Manager", String(stillOurs?.name));

  // ------------------------------------------------------------------ removing it
  const removed = await call("DELETE", `/organizations/${workspace.organizationId}/roles/${roleId}`, undefined, workspace.accessToken);
  check("a custom role can be deleted", removed.status === 200, `${removed.status}`);

  const remaining = await rolesFor(workspace);
  check("it is gone from the list", !remaining.some((role) => role.id === roleId),
    `${remaining.filter((role) => !role.isSystem).length} custom roles left`);
  check("the built-in roles are still there", remaining.filter((role) => role.isSystem).length === systemRoles.length,
    `${remaining.filter((role) => role.isSystem).length} built in`);

  finish();
})();
