export type TranscriptLine = {
    type: 'speaker' | 'line';
    lineNumber: number;
    speakerId?: string;
    speakerTag?: string;
    content: string;
    isSameSpeakerAsLast: boolean;
};
  
/**
 * 様々な形式の文字起こしテキストを解析し、表示用のデータ構造に変換する
 * @param transcript - 解析対象の文字起こしテキスト
 * @returns 表示用の行データ配列
 */
export const parseTranscript = (transcript: string): TranscriptLine[] => {
    if (!transcript) {
        return [];
    }

    let contentToParse = transcript;

    // 1. 全体が { "text": "..." } 形式のJSONかチェック
    try {
        const parsedJson = JSON.parse(transcript);
        if (parsedJson && typeof parsedJson.text === 'string') {
            contentToParse = parsedJson.text;
        }
    } catch {
        // JSONではないので、そのままパースを続行
    }

    // 2. speaker_X: "..." という形式のJSONかチェック
    try {
        const parsedJson = JSON.parse(contentToParse);
        const keys = Object.keys(parsedJson);
        if (keys.every(key => key.startsWith('speaker_'))) {
            const lines: string[] = [];
            for (const key of keys.sort()) {
                lines.push(`**[${key}]**\n${parsedJson[key]}`);
            }
            contentToParse = lines.join('\n\n');
        }
    } catch {
        // JSONではないので、そのままパースを続行
    }


    const lines = contentToParse.split('\n');
    let lastSpeakerId: string | null = null;
    
    const parsedLines = lines.map((line, index) => {
        // **[speaker_0]** または **[話者名]** の両方に対応
        const speakerMatch = line.match(/^\*\*\[(speaker_\d+|[^\]]+)\]\*\*$/) || line.match(/^\*\*\[(speaker_\d+|[^\]]+)\]\*\*(.*)/);
        
        // [話者名]: 形式の話者タグにも対応
        const simpleSpeakerMatch = line.match(/^\[([^\]]+)\]:\s*(.*)$/);

        if (speakerMatch) {
            const speakerTag = speakerMatch[1];
            // speaker_0 のような形式でなければ、タグそのものをIDとして使う
            const speakerId = speakerTag.startsWith('speaker_') ? speakerTag : speakerTag;
            const content = speakerMatch[2]?.trim() || '';
            const isSameSpeakerAsLast = lastSpeakerId === speakerId;
            lastSpeakerId = speakerId;

            return {
                type: 'speaker',
                lineNumber: index,
                speakerId: speakerId,
                speakerTag: `[${speakerTag}]`,
                content: content,
                isSameSpeakerAsLast: isSameSpeakerAsLast,
            } as TranscriptLine;
        }
        
        if (simpleSpeakerMatch) {
            const speakerTag = simpleSpeakerMatch[1];
            const speakerId = speakerTag; // 話者名をそのままIDとして使用
            const content = simpleSpeakerMatch[2]?.trim() || '';
            const isSameSpeakerAsLast = lastSpeakerId === speakerId;
            lastSpeakerId = speakerId;

            return {
                type: 'speaker',
                lineNumber: index,
                speakerId: speakerId,
                speakerTag: `[${speakerTag}]`,
                content: content,
                isSameSpeakerAsLast: isSameSpeakerAsLast,
            } as TranscriptLine;
        }

        if (line.trim()) {
            // 話者タグのない行は、直前の話者の発言の続きとみなす
            return { type: 'line', lineNumber: index, content: line, isSameSpeakerAsLast: true } as TranscriptLine;
        }
        
        return { type: 'line', lineNumber: index, content: '', isSameSpeakerAsLast: false } as TranscriptLine;
    });

    // 連続するlineをまとめる
    return parsedLines.reduce((acc, current) => {
        const last = acc[acc.length - 1];
        if (last && last.type === 'speaker' && current.type === 'line' && current.content) {
            last.content += '\n' + current.content;
        } else if (last && last.type === 'line' && current.type === 'line' && current.content) {
            last.content += '\n' + current.content;
        }
        else if (current.content || current.type === 'speaker') {
            acc.push(current);
        }
        return acc;
    }, [] as TranscriptLine[]);
}; 