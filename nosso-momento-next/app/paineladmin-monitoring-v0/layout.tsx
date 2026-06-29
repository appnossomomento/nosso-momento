import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Monitoring',
  robots: { index: false, follow: false },
};

export default function AdminMonitoringLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
