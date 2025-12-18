/**
 * 文字起こし言語設定のユーティリティ関数
 */

/**
 * 文字起こし言語設定をlocalStorageに保存
 * @param language 言語コード ('ja'または'en')
 */
export const saveLanguagePreference = (language: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('transcription-language', language);
  }
};

/**
 * localStorageから文字起こし言語設定を取得
 * @returns 言語コード (デフォルトは'ja')
 */
export const getLanguagePreference = (): string => {
  if (typeof window === 'undefined') {
    return 'ja'; // サーバーサイドレンダリング時のデフォルト値
  }
  return localStorage.getItem('transcription-language') || 'ja';
};

/**
 * 現在の言語設定に基づいて表示用のラベルを取得
 * @param langCode 言語コード
 * @returns 表示用の言語名
 */
export const getLanguageLabel = (langCode: string): string => {
  switch (langCode) {
    case 'en':
      return '英語';
    case 'ja':
      return '日本語';
    default:
      return '日本語';
  }
};

/**
 * サポートされている言語のリスト
 */
export const supportedLanguages = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: '英語' }
]; 