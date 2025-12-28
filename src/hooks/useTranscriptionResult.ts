import { useQuery } from '@tanstack/react-query';
import { ProcessingSession, TranscriptFormat, Word, ProcessingStatus } from '@/types';
import { getOutputPresignedUrl } from '@/lib/azureApi';

type CustomJsonData = {
  schema_version: string;
  audio_duration: number;
  language: string;
  preprocessing_info: null;
  words: Word[];
};

type ResultData = {
  transcript: string;
  bulletPoints: string[];
  minutes: string;
  customJsonData?: CustomJsonData;
};

/**
 * 処理セッションを受け取り、関連する結果ファイル（文字起こし、箇条書きなど）を
 * Azure Blob (outputs) から取得・管理するためのカスタムフック。
 * @param session - 表示対象のProcessingSession
 */
export const useTranscriptionResult = (session: ProcessingSession) => {
  const fetchResultFile = async (key: string | null | undefined) => {
    if (!key) return null;
    try {
      const sasUrl = await getOutputPresignedUrl(session.sessionId, key);
      const response = await fetch(sasUrl);
      if (!response.ok) {
        return null; // blob not ready yet
      }
      return await response.text();
    } catch {
      return null; // treat all errors as "not ready" to avoid console noise
    }
  };
  
  const { data, isLoading, isError, error } = useQuery<ResultData, Error>({
    queryKey: ['transcriptionResult', session.id, session.transcriptKey, session.bulletPointsKey, session.minutesKey, session.transcriptFormat],
    queryFn: async () => {
      let transcriptText = '';
      let customJsonData: CustomJsonData | undefined;
      
      // JSON形式のみをサポート
      const transcriptKey = session.transcriptKey;
      const shouldParseJson =
        session.transcriptFormat === TranscriptFormat.JSON ||
        (typeof transcriptKey === "string" &&
          transcriptKey.toLowerCase().endsWith(".json"));

      if (shouldParseJson) {
        const jsonText = await fetchResultFile(transcriptKey) || '';
        if (jsonText) {
          try {
            const jsonData = JSON.parse(jsonText);
            customJsonData = jsonData as CustomJsonData;
            
            // words配列から話者タグ付きテキストを再構築
            // 話者編集後: 直接配列 vs 元の形式: {words: [...], ...}
            let wordsArray: Word[] = [];
            if (Array.isArray(jsonData)) {
              // 話者編集後の形式（直接配列）
              wordsArray = jsonData as Word[];
            } else if (jsonData.words && Array.isArray(jsonData.words)) {
              // 元のElevenLabs形式
              wordsArray = jsonData.words as Word[];
              customJsonData = jsonData as CustomJsonData;
            }

            if (wordsArray.length > 0) {
              const transcript: Array<[string, string]> = [];
              let currentSpeaker: string | null = null;
              let currentSegmentId: string | undefined;
              let currentChunks: string[] = [];
              let previousEnd: number | null = null;

              for (const item of wordsArray) {
                const speaker = (item as Word).speaker_id;
                const text = (item as Word).text;
                const segmentId = (item as Word).segment_id;

                const hasSpeakerBoundary = speaker !== currentSpeaker;
                const hasSegmentBoundary =
                  !!segmentId && segmentId !== currentSegmentId;
                const hasGapBoundary =
                  previousEnd !== null && item.start - previousEnd > 1.0;

                // スピーカーが切り替わったら、これまでの内容をまとめる
                if (hasSpeakerBoundary || hasSegmentBoundary || hasGapBoundary) {
                  if (currentSpeaker !== null) {
                    transcript.push([currentSpeaker, currentChunks.join('')]);
                  }
                  currentSpeaker = speaker;
                  currentSegmentId = segmentId;
                  currentChunks = [];
                }

                currentChunks.push(text);
                previousEnd = item.end;
              }

              // ループ終了後の最後のスピーカー
              if (currentSpeaker !== null && currentChunks.length > 0) {
                transcript.push([currentSpeaker, currentChunks.join('')]);
              }

              // 整形した結果を文字列にまとめる（設計書通りの形式に統一）
              const outputLines = [];
              for (const [speaker, combinedText] of transcript) {
                outputLines.push(`[${speaker}]:`);
                outputLines.push(combinedText);
                outputLines.push(""); // 空行で区切る
              }

              transcriptText = outputLines.join("\n");
            }
          } catch (error) {
            console.error('Failed to parse JSON transcript:', error);
            transcriptText = jsonText; // フォールバック
          }
        }
      } else {
        // JSON形式以外はサポートしない
        transcriptText = (await fetchResultFile(transcriptKey)) || "";
      }
      
      let bulletPoints: string[] = [];
      const bulletPointsText = await fetchResultFile(session.bulletPointsKey);
      if (bulletPointsText) {
          bulletPoints = bulletPointsText.split('\n').filter(line => line.trim());
      }
      
      const minutesText = await fetchResultFile(session.minutesKey) || '';

      return {
        transcript: transcriptText,
        bulletPoints,
        minutes: minutesText,
        customJsonData,
      };
    },
    enabled:
      !!session?.transcriptKey &&
      session.status !== ProcessingStatus.PROCESSING_TRANSCRIPTION, // skip during transcription phase
    staleTime: 5 * 60 * 1000, // 5分間はキャッシュを有効にする
  });

  return {
    transcript: data?.transcript ?? '',
    bulletPoints: data?.bulletPoints ?? [],
    minutes: data?.minutes ?? '',
    customJsonData: data?.customJsonData,
    isLoading,
    isError,
    error,
  };
}; 
