/**
 * 秒数を「〇分〇秒」の形式の文字列にフォーマットする
 * @param seconds - フォーマットする秒数
 * @returns フォーマットされた文字列
 */
export const formatDuration = (seconds: number): string => {
  // 無効な値のチェック
  if (!isFinite(seconds) || seconds < 0) {
    return '不明';
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}分 ${remainingSeconds}秒`;
}; 