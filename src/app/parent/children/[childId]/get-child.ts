import { cache } from "react";
import { db } from "@/db";
import { getFamilyChild } from "@/server/services/families";

// Per-request deduped: the section layout and its pages share one query.
export const getChild = cache(async (familyId: string, childId: string) =>
  getFamilyChild(db, familyId, childId),
);
