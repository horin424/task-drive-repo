"use client";
import React from 'react';
import styles from './FileInfoDisplay.module.css';
import { formatDuration } from '@/utils/formatters';

interface FileInfoDisplayProps {
  file: File;
  duration: number | null;
  remainingMinutes: number;
}

const FileInfoDisplay: React.FC<FileInfoDisplayProps> = ({
  file,
  duration,
  remainingMinutes,
}) => {
  // duration値の有効性をチェック
  const isValidDuration = duration !== null && isFinite(duration) && duration > 0;
  const isExceedingRemainingTime = isValidDuration && Math.ceil(duration / 60) > remainingMinutes;
  const durationInMinutes = isValidDuration ? Math.ceil(duration / 60) : 0;

  return (
    <div className={styles.fileInfo}>
      <p><strong>ファイル名:</strong> {file.name}</p>
      <p><strong>ファイルサイズ:</strong> {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
      {isValidDuration ? (
        <>
          <p><strong>長さ:</strong> {formatDuration(duration)}</p>
          <p><strong>使用時間:</strong> 
            <span className={isExceedingRemainingTime ? styles.exceedingTime : ''}>
              {durationInMinutes}分 / {remainingMinutes}分
            </span>
          </p>
          {isExceedingRemainingTime && (
            <div className={styles.warningContainer}>
              <p className={styles.warning}>このファイルの処理に必要な時間が残り使用時間を超えています。</p>
            </div>
          )}
        </>
      ) : duration !== null ? (
        <p><strong>長さ:</strong> <span style={{color: '#f44336'}}>取得できませんでした</span></p>
      ) : (
        <p><strong>長さ:</strong> 計算中...</p>
      )}
    </div>
  );
};

export default FileInfoDisplay; 