export type UserStatus = "pending" | "accepted" | "rejected";

export function normalizeUserStatus(user: { status?: string | null; is_approved?: boolean | null; is_admin?: boolean | null }): UserStatus {
  if (user.is_admin) {
    return "accepted";
  }

  if (user.status === "accepted" || user.status === "rejected" || user.status === "pending") {
    return user.status;
  }

  if (user.is_approved) {
    return "accepted";
  }

  return "pending";
}

export function statusToLegacyApproval(status: UserStatus): boolean {
  return status === "accepted";
}
