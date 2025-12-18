"use client";
import React from 'react';
import styles from './ProgressIndicator.module.css';
import { ProcessStep } from '@/types';

interface ProgressIndicatorProps {
  currentStep: ProcessStep;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ currentStep }) => {
  const steps: { id: ProcessStep; name: string }[] = [
    { id: 'upload', name: 'ファイル\nアップロード' },
    { id: 'transcribe', name: '文字起こし\n生成' },
    { id: 'edit', name: '話者編集' },
    { id: 'generate', name: 'コンテンツ\n生成' },
    { id: 'results', name: '結果' }
  ];

  // 現在のステップのインデックスを取得
  const currentIndex = steps.findIndex(step => step.id === currentStep);

  // 進捗バーの幅を計算（0%〜100%）
  // 例: 5ステップ中2ステップ目の場合、(2 / (5-1)) * 100 = 50%
  const progressWidth = 
    currentIndex === 0 ? 0 : 
    currentIndex === steps.length - 1 ? 100 : 
    (currentIndex / (steps.length - 1)) * 100;

  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressSteps}>
        {/* 進捗バー */}
        <div className={styles.progressBar}>
          <div 
            className={styles.progressBarFilled} 
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        
        {/* 各ステップ */}
        {steps.map((step, index) => {
          // ステップの状態を判定
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div 
              key={step.id} 
              className={`${styles.step} ${isCompleted ? styles.completed : ''} ${isCurrent ? styles.current : ''}`}
            >
              <div className={styles.stepCircle}>
                {isCompleted ? (
                  // 完了ステップは✓マーク
                  <span>✓</span>
                ) : (
                  // それ以外は番号
                  <span>{index + 1}</span>
                )}
              </div>
              <div className={styles.stepName}>
                {step.name.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < step.name.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressIndicator; 