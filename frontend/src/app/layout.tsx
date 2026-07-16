import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MainLayout } from "@/components/layout/MainLayout";
import Providers from "./providers";
import { SyncManager } from "@/lib/SyncManager";
import UpdateNotifier from "@/components/UpdateNotifier";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PosPro - Comprehensive POS Web Application",
  description: "All-in-one POS for retail, cafe, and mobile vendors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Anti-flash: pasang class `dark` sebelum paint pertama berdasarkan
            pilihan tersimpan, fallback ke preferensi sistem. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <MainLayout>{children}</MainLayout>
          <SyncManager />
          <UpdateNotifier />
        </Providers>
      </body>
    </html>
  );
}
