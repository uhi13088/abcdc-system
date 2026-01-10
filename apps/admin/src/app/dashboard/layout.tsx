export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sidebar is now rendered in the root AppLayout
  return <>{children}</>;
}
