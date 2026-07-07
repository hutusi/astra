"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  loginChild,
  lookupFamilyChildren,
  type FamilyChildren,
  type LoginError,
} from "./actions";

const FAMILY_CODE_KEY = "astra_family_code";
const PIN_LENGTH = 4;

export function ChildLoginForm() {
  const t = useTranslations("login");
  const [family, setFamily] = useState<FamilyChildren | null>(null);
  const [code, setCode] = useState("");
  const [childId, setChildId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<LoginError | null>(null);
  const [pending, startTransition] = useTransition();

  // Returning children skip the code step: reuse the cached family code.
  useEffect(() => {
    const cached = localStorage.getItem(FAMILY_CODE_KEY);
    if (!cached) return;
    startTransition(async () => {
      const found = await lookupFamilyChildren(cached);
      if (found) setFamily(found);
    });
  }, []);

  function submitCode() {
    setError(null);
    startTransition(async () => {
      const found = await lookupFamilyChildren(code);
      if (!found) {
        setError("familyNotFound");
        return;
      }
      localStorage.setItem(FAMILY_CODE_KEY, code.trim().toUpperCase());
      setFamily(found);
    });
  }

  function pressDigit(digit: string) {
    if (pending || pin.length >= PIN_LENGTH) return;
    setError(null);
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH && childId) {
      startTransition(async () => {
        const result = await loginChild(childId, next);
        if (result?.error) {
          setError(result.error);
          setPin("");
        }
      });
    }
  }

  if (!family) {
    return (
      <div className="flex flex-col gap-4">
        <label htmlFor="family-code" className="text-sm text-slate-200">
          {t("familyCode")}
        </label>
        <Input
          id="family-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && submitCode()}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ASTRA"
          className="bg-white/10 border-white/20 text-center text-2xl tracking-[0.3em] text-white"
        />
        <p className="text-xs text-slate-400">{t("familyCodeHint")}</p>
        {error === "familyNotFound" && (
          <p role="alert" className="text-sm text-red-400">
            {t("familyNotFound")}
          </p>
        )}
        <Button onClick={submitCode} disabled={pending || !code.trim()}>
          {t("next")}
        </Button>
      </div>
    );
  }

  if (!childId) {
    return (
      <div className="flex flex-col items-center gap-6">
        <p className="text-lg font-medium">{t("whoAreYou")}</p>
        <div className="flex flex-wrap justify-center gap-4">
          {family.children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => setChildId(child.id)}
              className="flex w-24 flex-col items-center gap-2 rounded-2xl bg-white/10 p-4 transition hover:bg-white/20 active:scale-95"
            >
              <span className="text-4xl">{child.avatar}</span>
              <span className="text-sm">{child.name}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(FAMILY_CODE_KEY);
            setFamily(null);
            setCode("");
          }}
          className="text-xs text-slate-400 underline"
        >
          {t("changeFamily")}
        </button>
      </div>
    );
  }

  const child = family.children.find((c) => c.id === childId);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-1">
        <span className="text-4xl">{child?.avatar}</span>
        <p className="text-lg font-medium">{child?.name}</p>
        <p className="text-sm text-slate-300">{t("enterPin")}</p>
      </div>

      <div className="flex gap-3" aria-label="PIN">
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`size-4 rounded-full border border-white/40 ${
              i < pin.length ? "bg-white" : "bg-transparent"
            }`}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {t(error === "locked" ? "locked" : "wrongPin")}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
          (key, i) =>
            key === "" ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type="button"
                disabled={pending}
                onClick={() =>
                  key === "⌫" ? setPin(pin.slice(0, -1)) : pressDigit(key)
                }
                className="size-16 rounded-full bg-white/10 text-2xl font-medium transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
              >
                {key}
              </button>
            ),
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setChildId(null);
          setPin("");
          setError(null);
        }}
        className="text-xs text-slate-400 underline"
      >
        {t("back")}
      </button>
    </div>
  );
}
