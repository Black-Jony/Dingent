import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

import "./globals.css";
import "@copilotkit/react-ui/v2/styles.css";

import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { DirectionProvider, ThemeProvider } from "@/providers";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans", // 定义 CSS 变量名
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
interface RootLayoutProps {
  children: ReactNode;
  bodyClassName?: string;
}

function StoreInitializer() {
  return null; // This component renders nothing
}
export default async function RootLayout({
  children,
  bodyClassName = "",
}: RootLayoutProps) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased ${bodyClassName}`}
      >
        <StoreInitializer />
        <NextIntlClientProvider>
          <ThemeProvider>
            <DirectionProvider>
              {children}
              <Toaster richColors position="top-right" />
            </DirectionProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
export const metadata: Metadata = {
  title: "Dingent Frontend",
  description: "Dingent AI agent platform",
};
