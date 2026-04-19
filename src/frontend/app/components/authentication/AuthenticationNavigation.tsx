"use client";

import { useAppDispatch, useAppSelector } from "../../lib/hooks";
import type { RootState } from "../../lib/store";
import { Menu, Transition } from "@headlessui/react";
import Link from "next/link";
import { loggedIn, logout, isAdmin } from "../../lib/slices/authSlice";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "../ui/button";
import { Shield, User } from "lucide-react";

const redirectRoute = "/";

type RenderUserProps = {
  isLoggedIn: boolean;
  isValidAdmin: boolean;
  pathname: string;
  router: ReturnType<typeof useRouter>;
};

const renderAdminLinks = () => (
  <Menu.Item>
    {({ active }) => (
      <Link
        href="/settings"
        className={[
          active ? "bg-gray-100 cursor-pointer" : "",
          "block px-4 py-2 text-sm text-gray-700 cursor-pointer",
        ].join(" ")}
      >
        Settings
      </Link>
    )}
  </Menu.Item>
);

const renderUser = ({
  isLoggedIn,
  isValidAdmin,
  pathname,
  router,
}: RenderUserProps) => {
  if (!isLoggedIn) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant={pathname === "/login" ? "default" : "outline"}
          size="sm"
          onClick={() => router.push("/login")}
        >
          <Shield className="mr-2 h-4 w-4" />
          Sign In
        </Button>
      </div>
    );
  }

  if (isValidAdmin) {
    return (
      <Menu.Button className="flex rounded-full bg-white text-sm focus:outline-none">
        <Button variant="outline" size="sm">
          <Shield className="mr-2 h-4 w-4" />
          Admin Menu
        </Button>
      </Menu.Button>
    );
  }

  return (
    <Menu.Button className="flex rounded-full bg-white text-sm focus:outline-none">
      <Button variant="outline" size="sm">
        <User className="mr-2 h-4 w-4" />
        Account
      </Button>
    </Menu.Button>
  );
};

export default function AuthenticationNavigation() {
  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((state: RootState) => loggedIn(state));
  const isValidAdmin = useAppSelector((state: RootState) => isAdmin(state));
  const router = useRouter();
  const pathname = usePathname();

  const logoutUser = () => {
    dispatch(logout());
    router.push(redirectRoute);
  };

  return (
    <Menu as="div" className="relative z-10 ml-3">
      {renderUser({ isLoggedIn, isValidAdmin, pathname, router })}

      {isLoggedIn && (
        <Transition
          enter="transition ease-out duration-200"
          enterFrom="transform scale-95 opacity-0"
          enterTo="transform scale-100 opacity-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform scale-100 opacity-100"
          leaveTo="transform scale-95 opacity-0"
        >
          <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            {isValidAdmin && renderAdminLinks()}

            <Menu.Item>
              {({ active }) => (
                <button
                  type="button"
                  className={[
                    active ? "bg-gray-100 cursor-pointer" : "",
                    "block w-full px-4 py-2 text-left text-sm text-gray-700 cursor-pointer",
                  ].join(" ")}
                  onClick={logoutUser}
                >
                  Logout
                </button>
              )}
            </Menu.Item>
          </Menu.Items>
        </Transition>
      )}
    </Menu>
  );
}