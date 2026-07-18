export type ApiPromoBanner = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  redirectType: number;
  redirectValue?: string | null;
  displayOrder: number;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
};

export const REDIRECT_TYPES: { value: number; label: string }[] = [
  { value: 0, label: "None" },
  { value: 1, label: "Drop In" },
  { value: 2, label: "Membership" },
  { value: 3, label: "PT Package" },
  { value: 4, label: "Info URL" },
];

export function redirectTypeLabel(value: number | null | undefined): string {
  if (value == null) return "—";
  return REDIRECT_TYPES.find((t) => t.value === value)?.label ?? String(value);
}