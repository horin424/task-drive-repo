import { Word, SpeechSegment } from '@/types';

/**
 * words配列をSpeechSegment配列に変換する
 * 連続する同じspeaker_idの単語を一つのセグメントにまとめる
 */
export function convertWordsToSpeechSegments(words: Word[]): SpeechSegment[] {
  if (!words || words.length === 0) return [];

  const segments: SpeechSegment[] = [];
  let currentSegment: SpeechSegment | null = null;
  let currentSegmentId: string | undefined;

  for (const word of words) {
    const wordSegmentId = word.segment_id;
    if (
      !currentSegment ||
      currentSegment.speakerId !== word.speaker_id ||
      (wordSegmentId && wordSegmentId !== currentSegmentId)
    ) {
      // 新しいセグメントを開始
      if (currentSegment) {
        segments.push(currentSegment);
      }
      
      currentSegment = {
        id: wordSegmentId || `segment_${segments.length}`,
        speakerId: word.speaker_id,
        speakerName: word.speaker_id, // 初期値として speaker_id を使用
        startTime: word.start,
        endTime: word.end,
        text: word.text,
        words: [word],
      };
      currentSegmentId = wordSegmentId;
    } else {
      // 既存のセグメントに単語を追加
      currentSegment.endTime = word.end;
      currentSegment.text += word.text;
      currentSegment.words.push(word);
    }
  }

  // 最後のセグメントを追加
  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * SpeechSegment配列をプレーンテキスト形式に変換する
 * [話者名]:\n発言内容\n\n の形式で出力（話者交代時に空行を挟む）
 */
export function convertSpeechSegmentsToText(segments: SpeechSegment[]): string {
  return segments
    .map(segment => `[${segment.speakerName}]:\n${segment.text}`)
    .join('\n\n');
}

/**
 * SpeechSegment配列をJSON形式に変換する
 * 編集完了後のデータをJSON形式で保存するために使用
 * 元のElevenLabs形式と互換性を保つため、wordsプロパティを含むオブジェクト形式で保存
 */
export function convertSpeechSegmentsToJSON(segments: SpeechSegment[]): string {
  // 元のwords配列の構造を再構築
  const words: Word[] = [];
  
  segments.forEach(segment => {
    segment.words.forEach(word => {
      words.push({
        ...word,
        // 編集された話者名を反映
        speaker_id: segment.speakerName,
      });
    });
  });
  
  // 元のElevenLabs形式と互換性を保つ
  const result = {
    schema_version: "1.0",
    audio_duration: segments.length > 0 ? Math.max(...segments.map(s => s.endTime)) : 0,
    language: "ja", // 固定値（実際の言語情報が必要な場合は引数で受け取る）
    preprocessing_info: null,
    words: words
  };
  
  return JSON.stringify(result, null, 2);
} 
