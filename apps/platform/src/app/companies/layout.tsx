import { AppLayout } from '@/components/layout/app-layout';

export default function CompaniesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
