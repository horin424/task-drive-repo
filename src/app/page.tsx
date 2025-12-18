"use client";
import React from "react";
import MediaUploader from "@/components/MediaUploader";
import ProgressIndicator from "../components/ProgressIndicator";
import MaintenanceNotice from "@/components/MaintenanceNotice";
import VersionHistoryModal from "@/components/VersionHistoryModal";
import { useMsalAuth } from "@/hooks/useMsalAuth";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import Spinner from "@/components/ui/Spinner";

const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";
const MAINTENANCE_MESSAGE =
  process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE ||
  "The system is currently under maintenance. We apologize for the inconvenience.";

export default function Home() {
  const { login, isLoading, isAuthenticated } = useMsalAuth();
  const { isAdmin } = useSessionStore();
  const { currentStep, isChangelogOpen, closeChangelog } = useUiStore();

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "80vh",
        }}
      >
        <Spinner />
        <p style={{ marginLeft: "1rem" }}>Loading user information...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div style={{ width: "100%", padding: "2rem", boxSizing: "border-box" }}>
        {MAINTENANCE_MODE && !isAdmin && (
          <MaintenanceNotice message={MAINTENANCE_MESSAGE} />
        )}

        {(!MAINTENANCE_MODE || isAdmin) && (
          <div
            style={{
              marginTop: "1rem",
              backgroundColor: "var(--background-main, white)",
              borderRadius: "0.5rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "1.5rem",
            }}
          >
            <ProgressIndicator currentStep={currentStep} />
            <MediaUploader />
          </div>
        )}

        <VersionHistoryModal
          isOpen={isChangelogOpen}
          onClose={closeChangelog}
        />
      </div>
    );
  }

  // 3. If not loading and not authenticated, show the login screen.
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "80vh",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <h2>Transcript Minute</h2>
      <button
        onClick={() => login()}
        style={{
          padding: "1rem 2rem",
          fontSize: "1.1rem",
          backgroundColor: "#0078d4",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Login
      </button>
    </div>
  );
}
