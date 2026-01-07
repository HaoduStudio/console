/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Logto 配置
  readonly VITE_LOGTO_ENDPOINT: string;
  readonly VITE_LOGTO_APP_ID: string;
  readonly VITE_LOGTO_RESOURCES?: string;

  // 阿里云 Captcha 配置
  readonly VITE_CAPTCHA_REGION?: string;
  readonly VITE_CAPTCHA_PREFIX?: string;
  readonly VITE_CAPTCHA_SCENE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
