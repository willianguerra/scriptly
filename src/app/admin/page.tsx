import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/current-user";
import { AdminUsers } from "@/components/admin/admin-users";

export const metadata: Metadata = {
  title: "Administração",
};

export default async function AdminPage() {
  // Middleware já barra no edge; reconfirmamos no servidor (defesa em camadas).
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  return <AdminUsers />;
}
