import { AppLayout } from '@/components/layout/app-layout';

export default function SubscriptionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
