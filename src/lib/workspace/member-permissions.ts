export type WorkspaceMemberRole = "owner" | "admin" | "member";

export function isElevatedRole(role: string): role is "owner" | "admin" {
  return role === "owner" || role === "admin";
}

/** Admin may remove only plain members (not owner/admin). */
export function adminCanRemoveTarget(actorRole: string, targetRole: string): boolean {
  if (actorRole !== "admin") return false;
  return targetRole === "member";
}

/** Only owner may change roles between admin and member. */
export function canChangeMemberRole(actorRole: string): boolean {
  return actorRole === "owner";
}

export function canAssignInviteRole(actorRole: string, inviteRole: "admin" | "member"): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return inviteRole === "member";
  return false;
}
