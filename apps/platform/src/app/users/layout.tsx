import { AppLayout } from '@/components/layout/app-layout';

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
