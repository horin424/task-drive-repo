"use client";
import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal'; // 共通モーダルをインポート
import styles from './VersionHistoryModal.module.css';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ isOpen, onClose }) => {
  const [changelog, setChangelog] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetch('/changelog.md')
        .then(response => response.text())
        .then(text => setChangelog(text));
    }
  }, [isOpen]);

  // dangerouslySetInnerHTML を使うため、簡単なサニタイズ処理
  // 本番環境ではDOMPurifyなどのライブラリを使うことを強く推奨
  const createMarkup = (markdown: string) => {
    // 簡単なMarkdown風の置換
    const html = markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`(.*)`/gim, '<code>$1</code>')
      .replace(/\n/g, '<br />');
    return { __html: html };
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="更新履歴"
    >
      <div
        className={`${styles.changelogContent} changelogContent`} 
        dangerouslySetInnerHTML={createMarkup(changelog)}
      />
    </Modal>
  );
};

export default VersionHistoryModal; 