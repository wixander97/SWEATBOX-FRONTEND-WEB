---
name: nextjs-dev
description: Next.js development guide for Sweatbox Admin UI. Use when working on page components, API routes, server/client components, data fetching, authentication, or any Next.js-specific patterns in this project.
---

# Next.js Development Guide - Sweatbox Admin UI

## Project Overview

This is a Next.js 16 admin dashboard for Sweatbox gym management. Key characteristics:

- **Framework**: Next.js 16.2.2 with App Router
- **React**: 19.2.4
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 with custom design tokens
- **Auth Pattern**: Cookie-based authentication with proxy to backend API
- **API Strategy**: Next.js API routes proxy requests to external backend (`https://api.sweatboxfnp.com`)

---

## Architecture Patterns

### 1. Project Structure

```
admin-ui/
├── app/
│   ├── (auth)/           # Auth group routes (login, register)
│   ├── admin/             # Protected admin routes
│   │   ├── dashboard/
│   │   ├── members/
│   │   ├── classes/
│   │   ├── coaches/
│   │   ├── payments/
│   │   ├── payroll/
│   │   ├── reports/
│   │   ├── users/
│   │   ├── workout/
│   │   └── page.tsx      # Redirects to /admin/dashboard
│   ├── api/               # API routes (proxy to backend)
│   │   ├── auth/          # Login, logout, profile, change-password
│   │   ├── members/
│   │   ├── coaches/
│   │   ├── payments/
│   │   └── stats/
│   ├── layout.tsx         # Root layout with RoleProvider
│   └── page.tsx           # Redirects to /admin
├── components/
│   └── admin/             # Admin-specific components
│       ├── admin-sidebar.tsx
│       ├── admin-header.tsx
│       ├── members-view.tsx
│       ├── dashboard-view.tsx
│       └── ...
├── contexts/
│   └── role-context.tsx   # React Context for role simulation
├── lib/
│   ├── auth/              # Auth utilities
│   │   ├── constants.ts   # API_BASE_URL, cookie names
│   │   ├── service.ts      # API calls (login, register)
│   │   ├── types.ts        # Auth types
│   │   ├── token.ts        # Client-side token management
│   │   ├── server-token.ts # Server-side token from cookies
│   │   └── client-guard.ts # Client-side auth guard
│   ├── admin-routes.ts     # Admin route path constants
│   └── mock-data.ts        # Mock data for development
└── public/                # Static assets
```

### 2. Component Types

#### Server Components (default)
- Use for data fetching, static content
- Can use `async/await` directly
- Cannot use `useState`, `useEffect`, event handlers
- Example: `app/admin/members/page.tsx` can be async

#### Client Components (`"use client"`)
- Use for interactivity (forms, state, event handlers)
- Must explicitly import contexts
- Can use hooks (`useState`, `useEffect`, `useCallback`, etc.)
- Most view components are client components
- Example: `components/admin/members-view.tsx`

**Decision Rule**: If the component needs interactivity, state, or browser APIs → `"use client"`. Otherwise → server component.

### 3. API Routes Pattern

API routes act as proxies to the backend API. Pattern:

```typescript
// app/api/members/route.ts
import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();

  const url = new URL(req.url);
  // Transform params as needed
  const page = url.searchParams.get("page") ?? "1";
  const search = url.searchParams.get("search") ?? "";

  const backendUrl = new URL(`${API_BASE_URL}/api/v1/members/paged`);
  backendUrl.searchParams.set("page", page);
  if (search) backendUrl.searchParams.set("search", search);

  const res = await fetch(backendUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);

  if (!res.ok) {
    return NextResponse.json(
      { message: "Failed to fetch members" },
      { status: res.status }
    );
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();
  
  const body = await req.json();

  const res = await fetch(`${API_BASE_URL}/api/v1/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      { message: data?.message ?? "Failed to create member" },
      { status: res.status }
    );
  }

  return NextResponse.json(await res.json());
}
```

### 4. Authentication Flow

```
Client                    Next.js API               Backend API
   |                           |                         |
   |-- POST /api/auth/login --→|                         |
   |                           |-- POST /api/v1/auth --→|
   |                           |←─ { token, ... } ──────|
   |←─ Sets cookie ────────────|                         |
   |                           |                         |
   |-- GET /api/members ───────→|                         |
   |                           |-- GET /api/v1/members ─→|
   |                           |←─ { items, ... } ───────|
   |←─ { items, ... } ──────────|                         |
```

#### Server-side Token Access
```typescript
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

export async function GET() {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  // Use token...
}
```

#### Client-side Auth Guard
```typescript
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

// In client component
const res = await fetch("/api/members");
if (redirectToLoginIfUnauthorized(res.status)) return;
```

### 5. Data Fetching in Client Components

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";

type Member = {
  id: string;
  fullName?: string | null;
  membershipType?: string | null;
  // ...
};

type PagedResponse<T> = {
  items?: T[];
  data?: T[];
  totalCount?: number;
  pageSize?: number;
  // Flexible response parsing
};

export function MembersView() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/members", { cache: "no-store" });
    
    if (redirectToLoginIfUnauthorized(res.status)) return;
    
    const payload = await res.json().catch(() => []);
    
    if (!res.ok) {
      const msg = typeof payload === "object" ? payload.message : "Failed";
      setError(msg || "Gagal mengambil data");
      setMembers([]);
      return;
    }

    // Handle flexible response format
    if (Array.isArray(payload)) {
      setMembers(payload);
    } else {
      const list = payload.items || payload.data || [];
      setMembers(list);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  // Render...
}
```

### 6. Tailwind CSS Design Tokens

Custom colors defined in `app/globals.css`:

```css
/* Custom properties */
:root {
  --color-dark: #0f0f11;
  --color-sweat: #facc15;
  --color-sidebar: #1a1a1d;
  --color-card: #1a1a1d;
  --color-border: #2a2a2e;
}
```

Usage in components:
```tsx
<div className="bg-dark text-sweat border border-border">
  <button className="bg-sweat text-black hover:bg-yellow-400">
  <p className="text-white font-display">Title</p>
</div>
```

Key design tokens:
- `bg-dark` / `text-dark`: Primary background
- `bg-sweat` / `text-sweat`: Accent color (yellow)
- `bg-sidebar` / `bg-card`: Secondary surfaces
- `border-border`: Standard border color
- `font-display`: Oswald font for headings
- `font-sans`: Inter font for body

### 7. Responsive Design Patterns

Admin UI uses responsive classes:

```tsx
<div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
  <button className="w-full sm:w-auto">Full on mobile, auto on desktop</button>
  <table className="w-full min-w-[860px] overflow-x-auto">Table scroll on mobile</table>
</div>
```

Breakpoints:
- `sm`: 640px
- `lg`: 1024px
- `xl`: 1280px

### 8. Component Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| View Components | `*-view.tsx` | `members-view.tsx`, `dashboard-view.tsx` |
| Modal Components | `create-*-modal.tsx` | `create-class-modal.tsx` |
| Layout Components | `admin-*.tsx` | `admin-sidebar.tsx`, `admin-header.tsx` |
| Page Components | `page.tsx` | `app/admin/members/page.tsx` |
| API Routes | `route.ts` | `app/api/members/route.ts` |

---

## Common Tasks

### Creating a New Admin Page

1. Create the page route:
```tsx
// app/admin/new-feature/page.tsx
"use client";

import { NewFeatureView } from "@/components/admin/new-feature-view";

export default function NewFeaturePage() {
  return <NewFeatureView />;
}
```

2. Create the view component:
```tsx
// components/admin/new-feature-view.tsx
"use client";

export function NewFeatureView() {
  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h2 className="text-xl font-display font-bold text-white">Feature Title</h2>
      {/* Feature content */}
    </div>
  );
}
```

3. Add route constant:
```typescript
// lib/admin-routes.ts
export const adminPaths = {
  // ... existing
  newFeature: "/admin/new-feature",
} as const;
```

4. Add to sidebar navigation:
```tsx
// components/admin/admin-sidebar.tsx
const mainNav = [
  // ... existing
  { href: adminPaths.newFeature, label: "New Feature", icon: "fa-icon", id: "new-feature" },
];
```

### Creating a New API Route

1. Create the route handler:
```typescript
// app/api/new-resource/route.ts
import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();

  // Transform request params
  // Proxy to backend
  // Transform response
  
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  // Similar pattern
}
```

### Adding Form with CRUD Operations

Follow the pattern in `members-view.tsx`:

1. Modal state management:
```typescript
const [modal, setModal] = useState<null | { mode: "create" } | { mode: "edit"; id: string }>(null);
```

2. Form state with TypeScript:
```typescript
type FormState = {
  field1: string;
  field2: string;
  isActive: boolean;
};

function emptyForm(): FormState {
  return { field1: "", field2: "", isActive: true };
}
```

3. Save handler with error handling:
```typescript
async function saveModal() {
  if (!modal) return;
  setSaving(true);
  setError("");
  try {
    const body = transformFormToApiPayload(form);
    const res = await fetch(url, {
      method: modal.mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    if (redirectToLoginIfUnauthorized(res.status)) return;
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "Failed");
      return;
    }
    
    setModal(null);
    void reloadData();
  } finally {
    setSaving(false);
  }
}
```

### Pagination Pattern

```typescript
const [page, setPage] = useState(1);
const [pageSize] = useState(10);
const [totalItems, setTotalItems] = useState(0);
const [totalPages, setTotalPages] = useState(1);

// In load function:
const params = new URLSearchParams({
  page: String(page),
  pageSize: String(pageSize),
});

// After fetch:
const list = payload.items || payload.data || [];
const computedTotal = payload.totalCount ?? payload.totalItems ?? list.length;
const computedPages = Math.max(1, Math.ceil(computedTotal / pageSize));
```

### Search/Filter Pattern

```typescript
const [keyword, setKeyword] = useState("");

useEffect(() => {
  const timeout = setTimeout(() => {
    void loadData(keyword);
  }, 300); // Debounce
  return () => clearTimeout(timeout);
}, [keyword]);
```

### CSV Export Pattern

```typescript
function exportCsv(data: Item[]) {
  const header = ["Column1", "Column2", "Column3"];
  const rows = data.map((item) => [
    item.field1,
    item.field2,
    String(item.field3),
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "export.csv";
  a.click();
  URL.revokeObjectURL(url);
}
```

### Sorting Pattern

```typescript
type SortKey = keyof ItemType;
type SortDir = "asc" | "desc";

const [sortKey, setSortKey] = useState<SortKey | null>(null);
const [sortDir, setSortDir] = useState<SortDir>("asc");

function toggleSort(key: SortKey) {
  if (sortKey === key) {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  } else {
    setSortKey(key);
    setSortDir("asc");
  }
}

const sortedData = useMemo(() => {
  if (!sortKey) return data;
  return [...data].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });
}, [data, sortKey, sortDir]);
```

---

## Environment Variables

```bash
# .env.example
SWEATBOX_API_BASE_URL=https://api.sweatboxfnp.com
AUTH_COOKIE_NAME=sb_access_token
AUTH_COOKIE_MAX_AGE_SECONDS=604800
```

---

## Development Commands

```bash
pnpm dev        # Start development server
pnpm build      # Build for production
pnpm lint       # Run ESLint
pnpm start      # Start production server
```

---

## Important Notes

1. **Always use `cache: "no-store"`** in fetch calls to prevent stale data
2. **Handle 401 responses** with `redirectToLoginIfUnauthorized()`
3. **API routes must check auth** with `getAuthTokenFromCookie()`
4. **Form inputs require error handling** and disabled states during save
5. **Use `useCallback` for fetch functions** to avoid stale closures in useEffect dependencies
6. **Debounce search inputs** to reduce API calls
7. **Use TypeScript types** for all API responses (flexible parsing handles backend variations)
8. **Responsive classes first letter**: `sm:`, `lg:` for breakpoints