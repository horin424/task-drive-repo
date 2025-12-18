import React, { useEffect } from 'react';
import { useGenerationOptions } from '@/hooks/useGenerationOptions';
import { useSessionStore } from '@/stores/sessionStore';
import styles from './GenerationOptions.module.css';

const GenerationOptions: React.FC = () => {
  const { options, updateOption } = useGenerationOptions();
  const { organization } = useSessionStore();
  
  // タスク生成の無効化判定
  const isTaskGenerationDisabled = (organization?.remainingTaskGenerations ?? 0) <= 0;

  // タスク生成が無効化された場合、ローカルストレージの状態も同期
  useEffect(() => {
    if (isTaskGenerationDisabled && options.tasks) {
      updateOption('tasks', false);
    }
  }, [isTaskGenerationDisabled, options.tasks, updateOption]);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>生成するコンテンツ</h3>
      
      <div className={styles.optionsGrid}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={options.bullets}
            onChange={(e) => updateOption('bullets', e.target.checked)}
            className={styles.checkbox}
          />
          <span className={styles.labelText}>箇条書き</span>
        </label>

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={options.minutes}
            onChange={(e) => updateOption('minutes', e.target.checked)}
            className={styles.checkbox}
          />
          <span className={styles.labelText}>議事録</span>
        </label>

        <label className={`${styles.checkboxLabel} ${isTaskGenerationDisabled ? styles.disabled : ''}`}>
          <input
            type="checkbox"
            checked={options.tasks}
            disabled={isTaskGenerationDisabled}
            onChange={(e) => updateOption('tasks', e.target.checked)}
            className={styles.checkbox}
          />
          <span className={styles.labelText}>
            タスク一覧
            {isTaskGenerationDisabled && (
              <span className={styles.disabledNote}>（回数上限に達しています）</span>
            )}
          </span>
        </label>
      </div>
    </div>
  );
};

export default GenerationOptions; 