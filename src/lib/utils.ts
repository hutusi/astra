import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Path-boundary-safe nav active check: `/child/plan` matches itself and
 * `/child/plan/x`, but never a sibling like `/child/plan-b`.
 */
export function pathStartsWith(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
