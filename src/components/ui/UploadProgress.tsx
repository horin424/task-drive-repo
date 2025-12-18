"use client";
import React from 'react';
import styles from './UploadProgress.module.css';

interface UploadProgressProps {
  progress: number;
}

const UploadProgress: React.FC<UploadProgressProps> = ({ progress }) => {
  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <p className={styles.progressText}>{progress}% アップロード中...</p>
    </div>
  );
};

export default UploadProgress; 