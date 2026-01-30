import { AppLayout } from '@/components/layout/app-layout';

export default function EquipmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
