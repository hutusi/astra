"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginGuardian } from "./actions";

export function ParentLoginForm() {
  const t = useTranslations("login");
  const [state, formAction, pending] = useActionState(loginGuardian, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-slate-200">
          {t("email")}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="bg-white/10 border-white/20 text-white"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-slate-200">
          {t("password")}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="bg-white/10 border-white/20 text-white"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-400">
          {t(state.error)}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </Button>
    </form>
  );
}
