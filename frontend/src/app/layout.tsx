import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MainLayout } from "@/components/layout/MainLayout";
import Providers from "./providers";
import { SyncManager } from "@/lib/SyncManager";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PosPro - Comprehensive POS Web Application",
  description: "All-in-one POS for retail, cafe, and mobile vendors",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <Providers>
          <MainLayout>{children}</MainLayout>
          <SyncManager />
        </Providers>
      </body>
    </html>
  );
}
