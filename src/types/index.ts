/**
 * プログレスインジケーターの各ステップを示す型
 * 'upload' -> 'transcribe' -> 'edit' -> 'generate' -> 'results'
 */
export type ProcessStep = 'upload' | 'transcribe' | 'edit' | 'generate' | 'results';

/**
 * 話者IDと話者名のマッピングを保持するオブジェクトの型
 * e.g. { speaker_0: '話者A', speaker_1: '田中' }
 */
export type SpeakerMap = {
  [key: string]: string;
};

/**
 * `transcriptParser`によって解析された文字起こしの各行のデータ構造
 */
export type TranscriptLine = {
    type: 'speaker' | 'line';
    speakerId?: string;
    speakerTag?: string;
    content: string;
    isSameSpeakerAsLast: boolean;
};

/**
 * ElevenLabs APIから取得される単語の情報
 */
export type Word = {
    text: string;
    start: number;
    end: number;
    speaker_id: string;
    segment_id?: string;
};

/**
 * 話者編集UIで使用する発言ブロックの型
 */
export type SpeechSegment = {
    id: string;
    speakerId: string;
    speakerName: string;
    startTime: number;
    endTime: number;
    text: string;
    words: Word[];
    isIndividuallyEdited?: boolean; // 個別編集されたかどうかのフラグ
};

// Azure types (re-exported for app-wide use)
export type {
  ProcessingSessionAzure as ProcessingSession,
  OrganizationAzure as Organization,
  UserAzure as User,
} from '@/types/types-azure';

export {
  ProcessingStatusAzure as ProcessingStatus,
  TranscriptFormatAzure as TranscriptFormat,
} from '@/types/types-azure';
