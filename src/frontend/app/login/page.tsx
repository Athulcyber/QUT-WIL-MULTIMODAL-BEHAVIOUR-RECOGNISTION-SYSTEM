"use client"

import { useAppDispatch, useAppSelector } from "../lib/hooks"
import { login, loggedIn } from "../lib/slices/authSlice"
import { useRouter, useSearchParams } from "next/navigation"
import { tokenIsTOTP, tokenParser } from "../lib/utilities"
import { Suspense, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { ShieldIcon } from "../components/ui/icons"
import Link from "next/link";

const schema = {
  email: { required: true },
  password: { required: true, minLength: 8, maxLength: 64 },
};
const redirectAfterLogin = "/";
const redirectAfterMagic = "/magic";
const redirectTOTP = "/totp";

function UnsuspendedPage() {
  const [oauth, setOauth] = useState(true)
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((state) => state.tokens.access_token)
  const isLoggedIn = useAppSelector((state) => loggedIn(state))
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectTo = (route: string) => {
    router.push(route);
  };

  const {
    register,
    handleSubmit,
    unregister,
    formState: { errors, isSubmitSuccessful },
  } = useForm();

  async function submit(data: any) {
    await dispatch(
      login({ username: data["email"], password: data["password"] }),
    );
  }

  const toggleOauth = (e: any) => {
    // If previous state enabled oauth, unregister password valdiation
    if (oauth) unregister("password");
    setOauth(e);
  };

  useEffect(() => {
    if (searchParams && searchParams.get("oauth")) setOauth(true);
  }, [searchParams]);

  useEffect(() => {
    if (isLoggedIn) return redirectTo(redirectAfterLogin);
    if (
      accessToken &&
      tokenIsTOTP(accessToken) &&
      (!oauth || isSubmitSuccessful)
    )
      return redirectTo(redirectTOTP);
    if (
      accessToken &&
      tokenParser(accessToken).hasOwnProperty("fingerprint") &&
      !oauth
    )
      return redirectTo(redirectAfterMagic);
  }, [isLoggedIn, accessToken, isSubmitSuccessful]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="flex min-h-screen items-top justify-center bg-white px-6 pt-36">
      <div className="w-full max-w-md">
        {/* Header with Icon */}
        <div className="mb-8 text-center">
          <div className="mb-6 flex justify-center">
            <ShieldIcon className="h-16 w-16 text-blue-600" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Sign In</h1>
          <p className="text-gray-500">
            Access monitoring and administration features based on your role
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-gray-200 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">Account login</CardTitle>
            <CardDescription className="text-gray-500">
              {oauth
                ? "Enter your email and password to continue"
                : "Enter your email to receive a magic link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(submit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-900">
                  Email
                </Label>
                <Input
                  {...register("email", schema.email)}
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  className="h-11"
                />
              </div>

              {oauth && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-900">
                    Password
                  </Label>
                  <Input
                    {...register("password", schema.password)}
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="h-11"
                  />
                  <div className="text-right text-sm">
                    <Link
                      href="/recover-password"
                      className="text-blue-600 hover:underline"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-11 bg-black text-white hover:bg-gray-800"
              >
                Sign In
              </Button>
            </form>

            {/* Toggle for password login */}
            {!oauth && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => toggleOauth(true)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Use password instead
                </button>
              </div>
            )}
            {oauth && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => toggleOauth(false)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Use magic link instead
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense><UnsuspendedPage /></Suspense>
}