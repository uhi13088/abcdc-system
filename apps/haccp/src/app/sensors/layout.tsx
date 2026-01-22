import { AppLayout } from '@/components/layout/app-layout';

export default function SensorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
