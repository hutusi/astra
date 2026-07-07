import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireGuardian } from "@/lib/session";
import { ChildTabs } from "./child-tabs";
import { getChild } from "./get-child";

export default async function ChildSectionLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ childId: string }>;
}>) {
  const session = await requireGuardian();
  const { childId } = await params;
  const child = await getChild(session.familyId, childId);
  if (!child) notFound();
  const tStages = await getTranslations("stages");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{child.avatar}</span>
        <h1 className="text-xl font-semibold">{child.name}</h1>
        {child.stage && (
          <Badge variant="secondary">{tStages(child.stage)}</Badge>
        )}
      </div>
      <ChildTabs childId={childId} />
      {children}
    </div>
  );
}
