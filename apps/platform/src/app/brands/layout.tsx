import { AppLayout } from '@/components/layout/app-layout';

export default function BrandsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
