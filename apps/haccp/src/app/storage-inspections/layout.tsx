import { AppLayout } from '@/components/layout/app-layout';

export default function StorageInspectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
