declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // AWS Amplify設定
      NEXT_PUBLIC_AWS_REGION: string;
      NEXT_PUBLIC_AWS_USER_POOLS_ID: string;
      NEXT_PUBLIC_AWS_USER_POOLS_WEB_CLIENT_ID: string;
      
      // API設定
      NEXT_PUBLIC_TRANSCRIPTION_API: string;
      NEXT_PUBLIC_ELEVENLABS_API_KEY: string;
      NEXT_PUBLIC_DIFY_API_KEY: string;
      NEXT_PUBLIC_DIFY_MINUTES_API_KEY: string;
      NEXT_PUBLIC_DIFY_API_URL: string;
      
      // 開発モード設定
      NEXT_PUBLIC_USE_MOCK_DATA: string;
      NEXT_PUBLIC_APP_ENV: string;
      NEXT_PUBLIC_CUSTOM_ENDPOINT?: string;
      
      // 機能停止モード設定
      NEXT_PUBLIC_MAINTENANCE_MODE: string;
      NEXT_PUBLIC_MAINTENANCE_MESSAGE: string;
    }
  }
}

export {}; 