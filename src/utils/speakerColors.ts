// 話者に割り当てる色のセット（背景色として最適化済み）
const SPEAKER_COLORS = [
  '#2563eb', // Blue - より深い青（明度を下げた）
  '#dc2626', // Red - より深い赤
  '#059669', // Green - より深い緑  
  '#d97706', // Amber - より深いアンバー
  '#7c3aed', // Violet - より深い紫
  '#c2185b', // Pink - より深いピンク（マゼンタ寄り）
  '#4f46e5', // Indigo - より深いインディゴ
  '#0891b2', // Teal - より深いティール
];

/**
 * 話者IDから色を取得する関数
 * @param speakerId - 話者ID
 * @returns 16進数カラーコード
 */
export const getSpeakerColor = (speakerId: string): string => {
  // speaker_0, speaker_1 などから数値を抽出
  const match = speakerId.match(/speaker_(\d+)/);
  if (match) {
    const index = parseInt(match[1], 10);
    return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
  }
  
  // speaker_X 形式でない場合、文字列をハッシュ化して色を決定
  let hash = 0;
  for (let i = 0; i < speakerId.length; i++) {
    const char = speakerId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit整数に変換
  }
  
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
};

/**
 * 話者IDリストから色マップを生成する関数
 * @param speakerIds - 話者IDの配列
 * @returns 話者ID -> 色のマップ
 */
export const generateSpeakerColorMap = (speakerIds: string[]): Record<string, string> => {
  const colorMap: Record<string, string> = {};
  
  speakerIds.forEach((speakerId) => {
    colorMap[speakerId] = getSpeakerColor(speakerId);
  });
  
  return colorMap;
}; 