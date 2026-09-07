import AdminBookForm from "@/components/admin/AdminBookForm";

export const dynamic = "force-dynamic";

export default function AdminNewBookPage() {
  return (
    <div>
      <AdminBookForm mode="create" />
    </div>
  );
}
