import { AppShell } from "@/components/AppShell";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
