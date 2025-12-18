/**
 * 文字起こし処理に関するユーティリティ関数
 */

/**
 * S3オブジェクトキーからセッションIDを抽出する
 * 
 * @param {string} objectKey - S3オブジェクトキー
 * @returns {string|null} セッションID、抽出できない場合はnull
 */
export const extractSessionId = (objectKey) => {
  if (!objectKey) return null;

  // パスの部分を取得
  const parts = objectKey.split('/');

  // テスト環境のフォーマット: private/us-east-1:01a05726-3427-c33d-a4f6-a80f3a7e0cde/2554bfe7-d96c-41db-950a-aabb1bb0a652/0204_converted.mp3
  // この場合、セッションIDは parts[3] の "2554bfe7-d96c-41db-950a-aabb1bb0a652"
  if (parts.length >= 4 && parts[1].includes(':')) {
    // ユーザーIDの後のUUIDをセッションIDとして使用
    return parts[2];
  }
  
  // 従来のフォーマット: uploads/SESSION_ID/audio.mp3
  if (parts.length >= 2) {
    return parts[1];
  }
  
  return null;
};

/**
 * ファイル名から拡張子を取得する
 * 
 * @param {string} filename - ファイル名
 * @returns {string} 拡張子（ドットを含まない）
 */
export const getFileExtension = (filename) => {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

/**
 * 音声ファイルかどうかを判定する
 * 
 * @param {string} filename - ファイル名
 * @returns {boolean} 音声ファイルの場合はtrue
 */
export const isAudioFile = (filename) => {
  const extension = getFileExtension(filename);
  const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
  return audioExtensions.includes(extension);
}; 