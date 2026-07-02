export type SortDir = "asc" | "desc";

export type PagedResponse<T> = {
  items?: T[];
  data?: T[];
  totalCount?: number;
  totalItems?: number;
  total?: number;
  totalPages?: number;
  pageCount?: number;
  pageSize?: number;
  message?: string;
};

export type Branch = {
  id: string;
  branchName?: string | null;
  isActive?: boolean;
};

export type Staff = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  department?: string | null;
  position?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  roleName?: string | null;
  role?: string | null;
  specialization?: string | null;
  hireDate?: number | string | null;
  salary?: number | null;
  payrollType?: string | null;
  payrollRate?: number | null;
  profileImageUrl?: string | null;
  isActive?: boolean;
};

export type StaffDetail = Staff & {
  bio?: string | null;
  notes?: string | null;
};

export type StaffEditForm = {
  branchId: string;
  phoneNumber: string;
  position: string;
  department: string;
  hireDate: string; // datetime-local value, e.g. "2026-07-01T09:07"
  salary: string;
  isActive: boolean;
};

export function emptyStaffEditForm(): StaffEditForm {
  return {
    branchId: "",
    phoneNumber: "",
    position: "",
    department: "",
    hireDate: "",
    salary: "",
    isActive: true,
  };
}

function toDatetimeLocal(v?: number | string | null): string {
  if (v == null || v === "") return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

export function staffToEditForm(s: StaffDetail): StaffEditForm {
  return {
    branchId: s.branchId ?? "",
    phoneNumber: s.phoneNumber ?? "",
    position: s.position ?? "",
    department: s.department ?? "",
    hireDate: toDatetimeLocal(s.hireDate),
    salary: s.salary != null ? String(s.salary) : "",
    isActive: s.isActive ?? true,
  };
}
