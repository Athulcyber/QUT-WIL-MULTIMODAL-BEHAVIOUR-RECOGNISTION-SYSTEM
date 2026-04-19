"use client";

import { BellIcon } from "@heroicons/react/24/outline";
import { useAppSelector } from "../../lib/hooks";
import { useRouter } from "next/navigation";

export default function AlertsButton() {
  const hasAlert = useAppSelector((state: any) => state.alerts.hasActiveAlert);
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/alerts")}
      className="relative rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
    >
      <span className="sr-only">View notifications</span>
      <BellIcon className="h-6 w-6" aria-hidden="true" />
      {hasAlert && (
        <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
      )}
    </button>
  );
}