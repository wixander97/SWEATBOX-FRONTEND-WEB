import { redirect } from "next/navigation";
import { adminPaths } from "@/lib/admin-routes";

export default function Home() {
  redirect(adminPaths.dashboard);
}
