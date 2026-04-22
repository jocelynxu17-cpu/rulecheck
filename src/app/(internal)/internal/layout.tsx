import { AdminSubnav } from "@/components/admin/AdminSubnav";

export default function InternalSubnavLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl">
      <AdminSubnav />
      {children}
    </div>
  );
}
