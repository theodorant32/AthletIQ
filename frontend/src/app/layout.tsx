import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const inter = Inter({ subsets: ['latin'] });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
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
          <div className="min-h-screen bg-gray-950 text-gray-100">
            <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                  <div className="flex items-center gap-8">
                    <a href="/" className="text-xl font-bold text-white">
                      AthletIQ
                    </a>
                    <div className="flex gap-4">
                      <a href="/" className="text-gray-400 hover:text-white transition">Home</a>
                      <a href="/progress" className="text-gray-400 hover:text-white transition">Progress</a>
                      <a href="/plan" className="text-gray-400 hover:text-white transition">Plan</a>
                      <a href="/insights" className="text-gray-400 hover:text-white transition">Insights</a>
                      <a href="/chat" className="text-gray-400 hover:text-white transition">Chat</a>
                    </div>
                  </div>
                </div>
              </div>
            </nav>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </div>
        </QueryClientProvider>
      </body>
    </html>
  );
}
