"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "./QueryProvider";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "@/lib/msal";
import AppHeader from "@/components/AppHeader";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { SessionMonitor } from "@/providers/SessionMonitor";
import AuthInitializer from "@/components/AuthInitializer";

const inter = Inter({ subsets: ["latin"] });

function RealtimeUpdatesWrapper({ children }: { children: React.ReactNode }) {
  useRealtimeUpdates();
  return <>{children}</>;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useRealtimeUpdates();
  return (
    <html lang="en">
      <head>
        <title>議事録自動化システム</title>
      </head>
      <body className={inter.className}>
        <MsalProvider instance={msalInstance}>
          <QueryProvider>
            <AuthInitializer>
              <SessionMonitor>
                <RealtimeUpdatesWrapper>
                  <div className="app-container">
                    <AppHeader />
                    <main className="main-content">{children}</main>
                  </div>
                </RealtimeUpdatesWrapper>
              </SessionMonitor>
            </AuthInitializer>
          </QueryProvider>
        </MsalProvider>
      </body>
    </html>
  );
}
