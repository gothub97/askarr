"use client";

import { useState, useTransition, type FormEvent } from "react";
import { OctagonXIcon } from "lucide-react";
import {
  createAdministratorAction,
  type AdministratorField,
} from "@/lib/actions/onboarding";
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
import type { Administrator } from "./onboarding-wizard";

/**
 * Step 1 — the administrator account.
 *
 * The account is created server-side through better-auth and the session is
 * opened in the same round trip, so the rest of the wizard runs authenticated
 * and the operator never types their new password twice.
 */

const MIN_PASSWORD_LENGTH = 10;

export function StepAccount({
  onDone,
}: {
  onDone: (administrator: Administrator) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<AdministratorField | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setField(null);

    startTransition(async () => {
      const result = await createAdministratorAction({
        name,
        email,
        password,
        confirmPassword,
      });

      if (!result.ok) {
        setError(result.message);
        setField(result.field ?? null);
        return;
      }

      onDone({ name: result.name, email: result.email });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">
          Create the administrator
        </CardTitle>
        <CardDescription>
          One account, created once. Everyone else reaches Askarr through
          Telegram.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <OctagonXIcon />
              <AlertTitle>Account not created</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-name">Name</Label>
            <Input
              id="admin-name"
              autoComplete="name"
              required
              autoFocus
              aria-invalid={field === "name" || undefined}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              aria-invalid={field === "email" || undefined}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              aria-describedby="admin-password-hint"
              aria-invalid={field === "password" || undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p id="admin-password-hint" className="text-xs text-muted-foreground">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-confirm">Confirm password</Label>
            <Input
              id="admin-confirm"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={field === "confirmPassword" || undefined}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? "Creating account" : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
