import { ClassesView } from "@/components/admin/classes/classes-view";

type StatusTab = "all" | "active" | "upcoming" | "completed" | "cancelled";
const ALLOWED_TABS: StatusTab[] = ["all", "active", "upcoming", "completed", "cancelled"];

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp?.status;
  const initialStatus =
    raw && (ALLOWED_TABS as string[]).includes(raw) ? (raw as StatusTab) : undefined;

  return <ClassesView initialStatus={initialStatus} />;
}
