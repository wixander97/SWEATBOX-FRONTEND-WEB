import { UsersView } from "@/components/admin/users/users-view";

type Tab = "staff" | "coach";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; active?: string }>;
}) {
  const sp = await searchParams;
  const initialTab: Tab = sp?.tab === "coach" ? "coach" : "staff";
  const initialActive = sp?.active === "true";

  return <UsersView initialTab={initialTab} initialActive={initialActive} />;
}