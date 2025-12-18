/**
 * エラーオブジェクトからユーザーフレンドリーなメッセージを抽出する。
 * Amplifyのエラー、一般的なErrorオブジェクト、文字列など様々な形式を想定。
 * 
 * @param error - 処理対象のエラーオブジェクト
 * @returns ユーザーに表示するためのエラーメッセージ文字列
 */
export const getErrorMessage = (error: unknown): string => {
    if (!error) {
      return '不明なエラーが発生しました。';
    }
  
    // Amplify GraphQLエラーの場合 (errors配列を持つ)
    if (typeof error === 'object' && error !== null && 'errors' in error) {
      const gqlError = error as { errors: { message: string }[] };
      if (gqlError.errors && gqlError.errors.length > 0 && gqlError.errors[0].message) {
        return gqlError.errors[0].message;
      }
    }
  
    //一般的なErrorオブジェクトの場合
    if (error instanceof Error) {
      return error.message;
    }
  
    // 文字列としてスローされた場合
    if (typeof error === 'string') {
      return error;
    }
  
    // その他のオブジェクトの場合
    if (typeof error === 'object') {
        // 'message' プロパティがあればそれを使う
        if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
            return (error as { message: string }).message;
        }
        try {
            return JSON.stringify(error);
        } catch {
            // stringifyできない循環参照など
        }
    }
    
    return '予期せぬエラーが発生しました。詳細はコンソールを確認してください。';
}; 