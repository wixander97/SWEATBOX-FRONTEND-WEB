export type SortDir = "asc" | "desc";
export type SortKey = "fullName" | "email" | "roleName" | "isActive";

export type ChangePasswordForm = { currentPassword: string; newPassword: string };

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

export type Role = {
  id: string;
  name?: string | null;
};

export type Branch = {
  id: string;
  branchName: string;
  isActive: boolean;
};

export type UserCrudForm = {
  fullName: string;
  password: string;
  email: string;
  roleId: string;
  branchId: string;
  phoneNumber: string;
  position: string;
  department: string;
  specialization: string;
  notes: string;
  bio: string;
  payrollType: string;
  payrollRate: string;
  salary: string;
  isActive: boolean;
  profileImageUrl: string;
};

export function emptyUserCrudForm(): UserCrudForm {
  return {
    fullName: "",
    password: "",
    email: "",
    roleId: "",
    branchId: "",
    phoneNumber: "",
    position: "",
    department: "",
    specialization: "",
    notes: "",
    bio: "",
    payrollType: "",
    payrollRate: "",
    salary: "",
    isActive: true,
    profileImageUrl: "",
  };
}

export type User = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  password?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  role?: string | null;
  specialization?: string | null;
  department?: string | null;
  hireDate?: number | null;
  salary?: number | null;
  branchId?: string | null;
  branchName?: string | null;
  profileImageUrl?: string | null;
  isActive?: boolean;
  position?: string | null;
  notes?: string | null;
  bio?: string | null;
  payrollType?: string | null;
  payrollRate?: number | null;
};