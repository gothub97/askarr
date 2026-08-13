"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, OctagonXIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Maps a better-auth failure onto copy that says what happened and what to do.
 * Bad credentials and an unreachable server are different problems and must
 * not share a message: one is retyped, the other is a server to go and start.
 */
function describeSignInError(error: {
  status?: number;
  code?: string;
  message?: string;
}): string {
  if (error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD") {
    return "That email and password do not match an account. Check the address, then retype the password.";
  }
  if (error.status === 429) {
    return "Too many attempts in a row. Wait a minute, then try again.";
  }
  if (error.status === 403) {
    return "This account cannot sign in. Ask the administrator to re-enable it.";
  }
  return (
    error.message ??
    "Askarr could not reach the sign-in service. Check that the server is running, then try again."
  );
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(describeSignInError(result.error));
      setPending(false);
      return;
    }

    /*
     * replace(), not push(): the login page must not sit in the history behind
     * the dashboard. refresh() re-runs the server components so the layout
     * picks up the freshly set session cookie.
     */
    router.replace(next);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>
          Askarr accounts are created by an administrator.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <OctagonXIcon />
              <AlertTitle>Sign-in failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              aria-invalid={error ? true : undefined}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={error ? true : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="w-full"
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            {pending ? "Signing in" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
