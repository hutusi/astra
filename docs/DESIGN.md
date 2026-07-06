# Astra — Design

A family web app for children's habit building and growth. Not a check-in tool: a growth system that matures with the child and gradually transfers ownership to him.

## Concepts

- **Plan（星图 / Constellation）** — annual growth container, belongs to a **child**. Records `stageAtCreation`. One active plan per child.
- **Habit（习惯）** — recurring behavior under a plan: schedule (`daily` / `weekly_days` / `x_per_week`), streaks, and a `rewardMode`.
- **Goal（目标）** — one-time milestone under a plan with a completion bonus.
- **Star Ledger（星星账本）** — immutable transaction stream owned by the **child** (not the plan — stars survive year-boundary plan rollover). Balance is always derived, never stored.

## Design decisions (and why)

1. **Ledger belongs to the child, not the plan.** Stars must survive the year boundary; a currency that evaporates teaches the child it isn't real. Transactions merely *reference* plan/habit.
2. **`stage` lives on the child, not the plan.** Stage is a developmental property of the person; permissions key off the child's *current* stage, so a mid-year transition is a settings change.
3. **The parent-confirmation bottleneck is the #1 kill risk** — not child disinterest. Check-ins create *pending* entries (visible immediately), parents batch-confirm, and entries auto-confirm after 48h (lazy sweep on read; no cron). The system degrades gracefully when parents are busy.
4. **Habits ≠ Goals.** Habits recur; goals complete once. Different tables, different UI.
5. **`rewardMode: stars | streak | none` per habit.** Makes the teen transition (stars fade, streaks/self-challenges rise) configuration, not migration. Also mitigates the overjustification effect: things he already enjoys are *tracked*, never *paid*.
6. **Penalties are guarded.** Only from pre-agreed written rules (`penalty_rules`), capped per rule, reason required, can never touch stars reserved by an open redemption request, and the balance floors at zero. Confiscating earned tokens is the most trust-damaging lever in a token economy; every deduction must be legible to the child.
7. **Weekly review is a first-class feature.** The parent+child review ritual is where "co-authored" actually happens.

## Growth stages

| Stage | Rough age | Lead | What changes |
|---|---|---|---|
| `parent_led` | ≤9 | Parent | Parent logs check-ins directly; child views. |
| `co_authored` | 10–12 | Together | Child self-checks-in and requests redemptions; parent confirms. **← current (age 11)** |
| `child_led` | 13–15 | Child | Child edits habits and plans; penalties fade; streaks emphasized. |
| `autonomous` | 16+ | Child | Self-confirmation; parent is an observer. |

Stage bumps are made in Settings and shift permissions with zero migrations (see `src/lib/authz.ts`).

## Core loop

```
child taps ✓ (今天)      parent batch-confirms        48h pass, nobody acted
        │                        │                            │
        ▼                        ▼                            ▼
  check_in (pending) ──► earn tx confirmed          auto-confirmed (flagged)
  + pending earn tx
```

## Ledger invariants (enforced only in `src/server/services/ledger.ts`)

- Transaction types: `earn | bonus | penalty | redeem | reversal | adjust`; amounts signed; only `earn` is ever `pending`.
- Balance = `SUM(amount) WHERE status='confirmed'`; floors at zero.
- `reserved` = total cost of `requested` redemptions. Penalties clamp to `min(rule.maxStars, balance − reserved)` and are refused at ≤0; redemption requests require `balance − reserved ≥ cost`.
- Corrections are `reversal` (exact negation, once — unique `reversesId`) or `adjust` (guardian, note required). **Never** UPDATE amount/type.
- Idempotency: unique `(habitId, date)` on check_ins; partial unique `(childId, habitId, occurredOn)` on earn transactions as backstop.
- **Module boundary rule: only `services/ledger.ts` writes `star_transactions`.**

## Permissions

`src/lib/authz.ts` holds a data matrix `PERMISSIONS[action] = { guardian, childMinStage }` over the ladder `parent_led < co_authored < child_led < autonomous`. Every service mutation calls `assertCan(session, action, childId)` — the single authoritative gate. Middleware and layouts are UX-only.

## Auth

Hand-rolled: jose JWT cookie (`astra_session`, 30 days, claims `{sub, fam, role, name}` — stage deliberately not in the token, read fresh from DB). Parent: email + password (bcryptjs). Child: family code → tap avatar → PIN pad. Stage-appropriate: no email for the child.

## Economy guidance (product, not code)

Anchor: one week of good behavior ≈ one meaningful small reward. Prices and star values should be set so this holds; revisit at the weekly review.

## Stack

Next.js (App Router) + Tailwind v4 + shadcn/ui (parent admin screens only; child screens are custom playful components) · Drizzle + libSQL (local file in dev, Turso in prod) · next-intl zh/en without locale routing (cookie-based, synced from user preference) · Bun as package manager/test runner (Next runs under Node — no `Bun.*` APIs in app code) · Vercel.

Dates-of-record are `YYYY-MM-DD` strings computed in the **family's timezone** (`src/lib/dates.ts`) — bedtime at 23:50 vs 00:10 must not split a day; Vercel runs UTC.

## Deferred (v1)

Public registration (seed = onboarding), offline/service worker, push notifications, charts, streak-milestone bonuses, stage-transition ceremony UI, 3am grace window (date stays an explicit service param so it's a one-line policy later).
