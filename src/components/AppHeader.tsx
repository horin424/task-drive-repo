"use client";
import React from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { useMsalAuth } from "@/hooks/useMsalAuth";
import VersionInfo from "./VersionInfo";
import Button from "./ui/Button";
import styles from "./AppHeader.module.css";

const AppHeader: React.FC = () => {
  const { user, organization } = useSessionStore();
  const { openChangelog } = useUiStore();
  const { logout } = useMsalAuth();

  return (
    <header className={styles.appHeader}>
      <div className={styles.userInfo}>
        <h1 className={styles.title}>議事録自動化システム</h1>
        <div className={styles.detailsGrid}>
          <span className={styles.label}>ユーザー名：</span>
          <span>{user?.username}</span>

          <span className={styles.label}>組織：</span>
          <span>{organization?.name || "なし"}</span>

          <span className={styles.label}>残り使用時間：</span>
          <span>
            {organization?.remainingMinutes !== undefined
              ? `${organization.remainingMinutes} 分`
              : "未設定"}
          </span>

          <span className={styles.label}>残りタスク一覧生成回数：</span>
          <span>
            {organization?.remainingTaskGenerations !== undefined
              ? `${organization.remainingTaskGenerations} 回`
              : "未設定"}
          </span>
        </div>
      </div>

      <div className={styles.headerActions}>
        <Button onClick={openChangelog} variant="secondary">
          更新履歴 <VersionInfo />
        </Button>

        <Button onClick={logout}>サインアウト</Button>
      </div>
    </header>
  );
};

export default AppHeader;
