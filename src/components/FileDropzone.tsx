"use client";
import React, { useState, useRef } from 'react';
import styles from './FileDropzone.module.css';
import { supportedLanguages } from '@/utils/languageUtils';
import Button from '@/components/ui/Button'; // インポート

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  remainingMinutes: number;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileSelect,
  selectedLanguage,
  onLanguageChange,
  remainingMinutes,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="audio/*,video/*"
        onChange={handleFileChange}
        className={styles.fileInput}
        ref={fileInputRef}
        hidden
      />
      <div className={styles.uploadControls}>
        <Button onClick={() => fileInputRef.current?.click()} variant="secondary">
          ファイルを選択
        </Button>
        <p className={styles.helpText}>または、ファイルをここにドラッグ&ドロップ</p>
        <div className={styles.languageSelector}>
          <label htmlFor="language-select" className={styles.languageLabel}>文字起こし言語：</label>
          <select
            id="language-select"
            className={styles.languageDropdown}
            value={selectedLanguage}
            onChange={(e) => onLanguageChange(e.target.value)}
          >
            {supportedLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.remainingTime}>
          <p className={styles.helpText}>残り使用時間: <span className={styles.minutes}>{remainingMinutes}</span> 分</p>
        </div>
      </div>
    </div>
  );
};

export default FileDropzone; 