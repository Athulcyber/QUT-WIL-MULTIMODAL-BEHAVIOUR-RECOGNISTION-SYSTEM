"use client";

import { Disclosure } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AlertsButton from "./alerts/AlertsButton";
import dynamic from "next/dynamic";
import { useAppSelector } from "../lib/hooks";
import { RootState } from "../lib/store";
import { isAdmin, loggedIn } from "../lib/slices/authSlice";
import { HeartPulse } from "lucide-react";

const AuthenticationNavigation = dynamic(
  () => import("./authentication/AuthenticationNavigation"),
  { ssr: false },
);

const navigation = [
  { name: "Home", to: "/", requiresLogin: false, adminOnly: false },
  { name: "Residents", to: "/members", requiresLogin: true, adminOnly: true },
  { name: "Activity", to: "/activity", requiresLogin: true, adminOnly: false },
  { name: "Alerts", to: "/alerts", requiresLogin: true, adminOnly: false },
  { name: "Audit", to: "/audit", requiresLogin: true, adminOnly: true },
];

const renderIcon = (open: boolean) => {
  if (!open) {
    return <Bars3Icon className="block h-6 w-6" aria-hidden="true" />;
  }
  return <XMarkIcon className="block h-6 w-6" aria-hidden="true" />;
};

export default function Navigation() {
  const isValidAdmin = useAppSelector((state: RootState) => isAdmin(state));
  const isLoggedIn = useAppSelector((state: RootState) => loggedIn(state));
  const pathname = usePathname();

  const filteredNavigation = navigation.filter((item) => {
    if (!item.requiresLogin) return true;
    if (!isLoggedIn) return false;
    if (item.adminOnly) return isValidAdmin;
    return true;
  });

  return (
    <header>
      <Disclosure as="nav">
        {({ open }) => (
          <>
            <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
              <div className="relative flex h-16 justify-between">
                <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
                  <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-rose-500">
                    <span className="sr-only">Open main menu</span>
                    {renderIcon(open)}
                  </Disclosure.Button>
                </div>

                <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
                  <div className="flex flex-shrink-0 items-center">
                    <Link href="/" className="flex flex-shrink-0 items-center">
                      <HeartPulse className="h-8 w-8 text-red-500" />
                    </Link>
                  </div>

                  <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                    {filteredNavigation.map((item) => (
                      <Link
                        key={item.name}
                        href={item.to}
                        className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                          pathname === item.to
                            ? "text-rose-500"
                            : "text-gray-900 hover:text-rose-500"
                        }`}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                  {isLoggedIn && <AlertsButton />}
                  <AuthenticationNavigation />
                </div>
              </div>
            </div>

            <Disclosure.Panel className="sm:hidden">
              <div className="space-y-1 pt-2 pb-4">
                {filteredNavigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.to}
                    className={`block py-2 pl-3 pr-4 text-base font-medium ${
                      pathname === item.to
                        ? "border-l-4 border-rose-500 bg-rose-50 text-rose-700"
                        : "text-gray-900 hover:border-l-4 hover:border-rose-500 hover:bg-rose-50"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
    </header>
  );
}