// All dates-of-record are YYYY-MM-DD strings computed in the FAMILY's
// timezone. Never use new Date().toISOString().slice(0, 10): the server
// runs UTC and a 23:50 bedtime check-in must not land on tomorrow.

export function todayIn(timezone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
  }).format(new Date());
}

/** ISO weekday for a calendar date: Mon=1 .. Sun=7. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // Sun=0..Sat=6
  return day === 0 ? 7 : day;
}

/** Monday of the week containing `date`, as YYYY-MM-DD. */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (isoWeekday(date) - 1));
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function currentYearRange(timezone: string): {
  start: string;
  end: string;
  year: number;
} {
  const year = Number(todayIn(timezone).slice(0, 4));
  return { start: `${year}-01-01`, end: `${year}-12-31`, year };
}
