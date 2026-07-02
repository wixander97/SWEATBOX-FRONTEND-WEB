import { PaymentsView } from "@/components/admin/payments/payments-view";

type StatusTab = "all" | "paid" | "pending" | "failed";
const ALLOWED_TABS: StatusTab[] = ["all", "paid", "pending", "failed"];

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp?.status;
  const initialStatus =
    raw && (ALLOWED_TABS as string[]).includes(raw) ? (raw as StatusTab) : undefined;

  return <PaymentsView initialStatus={initialStatus} />;
}
