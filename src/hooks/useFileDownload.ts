import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { deleteGeneratedFiles } from '@/lib/api';
import { ProcessingSession } from '@/types';
import { toast } from 'react-hot-toast';
import { getOutputPresignedUrl } from '@/lib/azureApi';

interface DownloadParams {
  fileName: string;
  transcript: string;
  bulletPoints: string[];
  minutes: string;
}

/**
 * ファイルのダウンロードと、それに伴うサーバー上のファイル削除処理を管理するカスタムフック。
 * @param session - 現在の処理セッション
 */
export const useFileDownload = (session: ProcessingSession) => {
  const [isDownloadCompleted, setIsDownloadCompleted] = useState(false);

  const downloadMutation = useMutation({
    mutationFn: async ({ fileName, transcript, bulletPoints, minutes }: DownloadParams) => {
      // ダウンロード処理開始時に即座に状態更新
      setIsDownloadCompleted(true);

      const zip = new JSZip();
      const baseFileName = fileName.replace(/\.[^/.]+$/, "").replace(/[\\/:*?"<>|]/g, '_');

      // 文字起こしは常に含める
      zip.file(`文字起こし_${baseFileName}.txt`, transcript);
      
      // 生成されたコンテンツのみをZIPに追加
      if (session.bulletPointsKey && bulletPoints.length > 0) {
        zip.file(`箇条書き_${baseFileName}.txt`, bulletPoints.join('\n'));
      }
      
      if (session.minutesKey && minutes) {
        zip.file(`議事録_${baseFileName}.txt`, minutes);
      }

      // タスク一覧ファイルがあればAzureから取得してZIPに追加
      if (session.tasksKey) {
        try {
          const tasksUrl = await getOutputPresignedUrl(session.sessionId, session.tasksKey);
          const tasksResponse = await fetch(tasksUrl);
          if (tasksResponse.ok) {
            const tasksBlob = await tasksResponse.blob();
            zip.file(`タスク一覧_${baseFileName}.xlsx`, tasksBlob);
          }
        } catch (err) {
          console.error('タスク一覧ファイルの取得またはzip追加エラー:', err);
          toast.error('タスク一覧ファイルのダウンロードに失敗しました。');
          // タスクファイルがなくても他のファイルのダウンロードは続行
        }
      }

      // ZIPファイルを生成してダウンロード
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${baseFileName}_生成ファイル.zip`);

      // サーバー上のファイルを削除
      await deleteGeneratedFiles(session.sessionId);
    },
    onSuccess: () => {
      toast.success('ファイルがダウンロードされ、サーバー上の一時ファイルが削除されました。');
    },
    onError: (error: Error) => {
      // エラー時は状態をリセット（再試行可能にする）
      setIsDownloadCompleted(false);
      
      const errorMessage = error.message.includes('not found') || error.message.includes('AccessDenied')
        ? 'ファイルは既に削除されている可能性があります。'
        : `処理中にエラーが発生しました: ${error.message}`;
      
      toast.error(errorMessage);
    },
  });

  return {
    download: downloadMutation.mutate,
    isDownloading: downloadMutation.isPending,
    isDownloadCompleted,
  };
}; 
