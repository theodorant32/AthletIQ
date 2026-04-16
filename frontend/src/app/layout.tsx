import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Navigation } from '@/components/Navigation';

const inter = Inter({ subsets: ['latin'] });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

export const metadata: Metadata = {
  title: 'AthletIQ - Personal Athletic Intelligence',
  description: 'Cloud-native training platform powered by your data',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <div className="min-h-screen bg-gray-950 text-gray-100">
              <Navigation />
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </main>
            </div>
          </ErrorBoundary>
        </QueryClientProvider>
      </body>
    </html>
  );
}
