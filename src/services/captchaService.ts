interface CaptchaConfig {
  region: string;
  prefix: string;
  sceneId: string;
}

// 验证码实例接口
interface CaptchaInstance {
  show: () => void;
  hide: () => void;
}

declare global {
  interface Window {
    AliyunCaptchaConfig?: {
      region: string;
      prefix: string;
    };
    initAliyunCaptcha?: (options: AliyunCaptchaOptions) => Promise<void>;
  }
}

interface AliyunCaptchaOptions {
  SceneId: string;
  mode: 'popup' | 'embed';
  element: string;
  button: string;
  success: (captchaVerifyParam: string) => void;
  fail?: (result: unknown) => void;
  getInstance?: (instance: CaptchaInstance) => void;
  slideStyle?: {
    width: number;
    height: number;
  };
  language?: string;
  timeout?: number;
  onError?: (errorInfo: { code: string; msg: string }) => void;
  onClose?: () => void;
}

const getCaptchaConfig = (): CaptchaConfig => ({
  region: import.meta.env.VITE_CAPTCHA_REGION || 'cn',
  prefix: import.meta.env.VITE_CAPTCHA_PREFIX || '',
  sceneId: import.meta.env.VITE_CAPTCHA_SCENE_ID || '',
});

export const isCaptchaEnabled = (): boolean => {
  const config = getCaptchaConfig();
  return !!(config.prefix && config.sceneId);
};

let scriptLoaded = false;
let scriptLoadPromise: Promise<void> | null = null;
let scriptLoadedAt = 0;

export const loadCaptchaScript = (): Promise<void> => {
  if (scriptLoaded) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const config = getCaptchaConfig();

    window.AliyunCaptchaConfig = {
      region: config.region,
      prefix: config.prefix,
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js';
    script.async = true;

    script.onload = () => {
      scriptLoaded = true;
      scriptLoadedAt = Date.now();
      resolve();
    };

    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error('Failed to load Aliyun Captcha script'));
    };

    document.head.appendChild(script);
  });

  return scriptLoadPromise;
};

export class CaptchaManager {
  private config: CaptchaConfig;
  private initialized = false;
  private buttonSelector: string | null = null;
  private pendingResolve: ((param: string) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private captchaInstance: CaptchaInstance | null = null;
  /** 最后一次成功的验证码参数，可供后端验签使用 */
  private lastCaptchaVerifyParam: string | null = null;

  constructor() {
    this.config = getCaptchaConfig();
  }

  /**
   * 获取最后一次成功的验证码参数
   * 用于后端验签
   */
  getLastCaptchaVerifyParam(): string | null {
    return this.lastCaptchaVerifyParam;
  }

  /**
   * 清除最后一次验证码参数
   */
  clearLastCaptchaVerifyParam(): void {
    this.lastCaptchaVerifyParam = null;
  }

  async initialize(elementId: string, buttonId: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!isCaptchaEnabled()) {
      console.warn('Captcha is not enabled. Please check your configuration.');
      return;
    }

    await loadCaptchaScript();

    if (!window.initAliyunCaptcha) {
      throw new Error('Aliyun Captcha script not loaded properly');
    }

    return new Promise((resolve, reject) => {
      this.buttonSelector = buttonId;
      window.initAliyunCaptcha!({
        SceneId: this.config.sceneId,
        mode: 'popup',
        element: elementId,
        button: buttonId,
        success: (captchaVerifyParam: string) => {
          // 保存验证码参数供后端验签使用
          this.lastCaptchaVerifyParam = captchaVerifyParam;
          if (this.pendingResolve) {
            this.pendingResolve(captchaVerifyParam);
            this.pendingResolve = null;
            this.pendingReject = null;
          }
        },
        fail: (result: unknown) => {
          console.error('Captcha verification failed:', result);
          if (this.pendingReject) {
            this.pendingReject(new Error('验证失败，请重试'));
            this.pendingResolve = null;
            this.pendingReject = null;
          }
        },
        getInstance: (instance: CaptchaInstance) => {
          this.captchaInstance = instance;
        },
        slideStyle: {
          width: 360,
          height: 40,
        },
        language: 'cn',
        timeout: 5000,
        onError: (errorInfo) => {
          console.error('Captcha error:', errorInfo);
          if (this.pendingReject) {
            this.pendingReject(new Error(errorInfo.msg || '验证码加载失败'));
            this.pendingResolve = null;
            this.pendingReject = null;
          }
        },
        onClose: () => {
          if (this.pendingReject) {
            this.pendingReject(new Error('用户取消验证'));
            this.pendingResolve = null;
            this.pendingReject = null;
          }
        },
      })
        .then(() => {
          this.initialized = true;
          resolve();
        })
        .catch((err: Error) => {
          reject(err);
        });
    });
  }

  async triggerVerification(): Promise<string> {
    if (!isCaptchaEnabled()) {
      return '';
    }
    if (!this.initialized || !this.buttonSelector) {
      throw new Error('Captcha not initialized');
    }

    const elapsed = Date.now() - scriptLoadedAt;
    if (scriptLoadedAt > 0 && elapsed < 2000) {
      await new Promise((r) => setTimeout(r, 2000 - elapsed));
    }

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      const trigger = document.querySelector(this.buttonSelector!);
      if (!trigger) {
        reject(new Error('Captcha trigger element not found'));
        return;
      }
      (trigger as HTMLElement).click();
    });
  }

  show(): void {
    if (this.captchaInstance) {
      this.captchaInstance.show();
    }
  }

  hide(): void {
    if (this.captchaInstance) {
      this.captchaInstance.hide();
    }
  }
}
