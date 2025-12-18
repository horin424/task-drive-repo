import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateContents } from '@/lib/generationApi';
import { updateSession } from '@/lib/api';
import { ProcessingSession, ProcessingStatus } from '@/types';
import { toast } from 'react-hot-toast';
import { useRef } from 'react';
import { useSessionStore } from '@/stores/sessionStore';

interface GenerateContentParams {
  transcript: string;
  processingTypes: ('bullets' | 'minutes' | 'tasks')[];
  taskFileKey?: string;
  informationFileKey?: string;
}

/**
 * コンテンツ生成（箇条書き、議事録など）のロジックを管理するカスタムフック。
 * @param session - 現在の処理セッション
 */
export const useContentGeneration = (session: ProcessingSession) => {
  const queryClient = useQueryClient();
  const isRequestInProgress = useRef(false);
  const { organization, refreshOrganization, updateCurrentSession } = useSessionStore();

  const generationMutation = useMutation({
    mutationFn: async ({ transcript, processingTypes, taskFileKey, informationFileKey }: GenerateContentParams) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[useContentGeneration] mutationFn called with:', { 
          transcript: transcript.substring(0, 100) + '...', 
          processingTypes, 
          taskFileKey, 
          informationFileKey 
        });
      }
      
      // 既にリクエストが進行中の場合は処理を停止
      if (isRequestInProgress.current) {
        console.log('[useContentGeneration] Request already in progress, throwing error');
        throw new Error('生成処理が既に実行中です。');
      }

      if (!transcript || !session.sessionId) {
        throw new Error('文字起こしデータまたはセッションIDがありません。');
      }

      // タスク生成が含まれている場合、残り回数をチェック
      if (processingTypes.includes('tasks')) {
        const remainingTaskGenerations = organization?.remainingTaskGenerations ?? 100; // デフォルト値更新
        if (remainingTaskGenerations <= 0) {
          throw new Error('タスク生成の回数上限に達しています。月末にリセットされます。');
        }
      }

      isRequestInProgress.current = true;

      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('[useContentGeneration] Updating session with processingTypes:', processingTypes);
        }
        // 1. 生成するコンテンツタイプをDBに保存
        const shouldMarkEditComplete = session.status === ProcessingStatus.PENDING_SPEAKER_EDIT;
        await updateSession(session.id, {
          processingTypes,
          ...(taskFileKey && { taskFileKey }),
          ...(informationFileKey && { informationFileKey }),
          ...(shouldMarkEditComplete && { status: ProcessingStatus.SPEAKER_EDIT_COMPLETED }),
        });

        // Immediately update local session state so the UI progresses even if realtime updates lag.
        if (shouldMarkEditComplete) {
          updateCurrentSession({
            ...session,
            processingTypes,
            taskFileKey: taskFileKey ?? session.taskFileKey,
            informationFileKey: informationFileKey ?? session.informationFileKey,
            status: ProcessingStatus.SPEAKER_EDIT_COMPLETED,
          });
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[useContentGeneration] Session updated, calling generateContents');
        }
        // 2. Dify APIを呼び出してコンテンツ生成をリクエスト
        const response = await generateContents(
          transcript,
          session.sessionId,
          processingTypes,
          taskFileKey,
          informationFileKey
        );
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[useContentGeneration] generateContents response:', response);
        }

        if (!response.success) {
          throw new Error(response.message || 'コンテンツ生成リクエストに失敗しました。');
        }

        return response;
      } finally {
        isRequestInProgress.current = false;
      }
    },
    onSuccess: () => {
      toast.success('コンテンツ生成リクエストを受け付けました。');
      // リアルタイム更新はWebSocketサブスクリプションに任せる
      // 必要であれば、ここでキャッシュを更新することも可能
      queryClient.invalidateQueries({ queryKey: ['transcriptionResult', session.id] });
      // 組織情報を更新（残り回数が減少している可能性があるため）
      refreshOrganization();
    },
    onError: (error: Error) => {
      // タスク生成回数不足エラーの場合は特別な処理
      if (error.message.includes('タスク生成の回数上限')) {
        toast.error(error.message, {
          duration: 5000, // 長めに表示
          icon: '⚠️',
        });
        // 組織情報を更新して最新の残り回数を取得
        refreshOrganization();
      } else {
        toast.error(`エラー: ${error.message}`);
      }
      isRequestInProgress.current = false; // エラー時もフラグをリセット
    },
  });

  return {
    generate: generationMutation.mutate,
    isGenerating: generationMutation.isPending,
  };
}; 
