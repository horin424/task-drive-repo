"use client";
import { useEffect } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useUiStore } from '@/stores/uiStore';
import { ProcessingStatus } from '@/types';

interface SessionMonitorProps {
  children: React.ReactNode;
}

/**
 * セッション状態を監視し、UIステップを自動的に更新するProvider
 * アプリケーション全体のワークフロー管理を一元化する
 */
export const SessionMonitor: React.FC<SessionMonitorProps> = ({ children }) => {
  const { currentSession } = useSessionStore();
  const { currentStep, setCurrentStep } = useUiStore();

  useEffect(() => {
    const status = currentSession?.status;
    
    // デバッグログを追加
    console.log('[SessionMonitor] Status change detected:', {
      status,
      currentStep,
      sessionId: currentSession?.id
    });
    
    // セッションがない場合はuploadステップ
    if (!status) {
      if (currentStep !== 'upload') {
        console.log('[SessionMonitor] Setting step to upload (no session)');
        setCurrentStep('upload');
      }
      return;
    }
    
    // セッションステータスに応じてUIステップを更新
    switch (status) {
      case ProcessingStatus.UPLOADED:
      case ProcessingStatus.PROCESSING_TRANSCRIPTION:
        if (currentStep !== 'transcribe') {
          console.log('[SessionMonitor] Setting step to transcribe, status:', status);
          setCurrentStep('transcribe');
        }
        break;
        
      case ProcessingStatus.PENDING_SPEAKER_EDIT:
        if (currentStep !== 'edit') {
          console.log('[SessionMonitor] Setting step to edit, status:', status);
          setCurrentStep('edit');
        }
        break;
        
      case ProcessingStatus.SPEAKER_EDIT_COMPLETED:
      case ProcessingStatus.PROCESSING_BULLETS:
      case ProcessingStatus.BULLETS_COMPLETED:
      case ProcessingStatus.PROCESSING_MINUTES:
      case ProcessingStatus.MINUTES_COMPLETED:
      case ProcessingStatus.PROCESSING_TASKS:
      case ProcessingStatus.TASKS_COMPLETED:
        if (currentStep !== 'generate') {
          console.log('[SessionMonitor] Setting step to generate, status:', status);
          setCurrentStep('generate');
        }
        break;
        
      case ProcessingStatus.ALL_COMPLETED:
        if (currentStep !== 'results') {
          console.log('[SessionMonitor] Setting step to results, status:', status);
          setCurrentStep('results');
        }
        break;
        
      case ProcessingStatus.TRANSCRIPTION_FAILED:
      case ProcessingStatus.BULLETS_FAILED:
      case ProcessingStatus.MINUTES_FAILED:
      case ProcessingStatus.TASKS_FAILED:
      case ProcessingStatus.ERROR:
        // エラー状態の場合は現在のステップを維持するか、適切なエラー処理を行う
        console.warn(`[SessionMonitor] Session error status: ${status}`);
        break;
        
      default:
        // 未知のステータスの場合はログを出力
        console.warn(`[SessionMonitor] Unknown session status: ${status}`);
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.status, currentStep, setCurrentStep]);

  return <>{children}</>;
}; 