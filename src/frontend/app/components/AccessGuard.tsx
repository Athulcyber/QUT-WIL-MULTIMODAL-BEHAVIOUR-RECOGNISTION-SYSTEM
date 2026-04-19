"use client";

import { ReactNode } from "react";
import { useAppSelector } from "../lib/hooks";
import { isAdmin, loggedIn } from "../lib/slices/authSlice";

type AccessGuardProps = {
  children: ReactNode;
  requireAdmin?: boolean;
  unauthenticatedMessage?: string;
  unauthorizedMessage?: string;
};

export default function AccessGuard({
  children,
  requireAdmin = false,
  unauthenticatedMessage = "Please log in to continue.",
  unauthorizedMessage = "Access denied",
}: AccessGuardProps) {
  const isLoggedIn = useAppSelector((state) => loggedIn(state));
  const isValidAdmin = useAppSelector((state) => isAdmin(state));

  if (!isLoggedIn) {
    return <div className="p-6 text-gray-600">{unauthenticatedMessage}</div>;
  }

  if (requireAdmin && !isValidAdmin) {
    return <div className="p-6 text-red-600">{unauthorizedMessage}</div>;
  }

  return <>{children}</>;
}
