"use client";
import { useAuthInitAzure } from "@/hooks/useAuthInit-azure";

export default function AuthInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  // This hook fetches the user from Azure DB and sets 'dbUser' in the store
  useAuthInitAzure();

  return <>{children}</>;
}
