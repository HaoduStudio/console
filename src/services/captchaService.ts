// ESA AI 验证码配置
interface ESACaptchaConfig {
  region: string;
  prefix: string;
  sceneId: string;
}

// 验证码实例接口
interface CaptchaInstance {
  show: () => void;
  hide: () => void;
  refresh: () => void;
}

declare global {
  interface Window {
    AliyunCaptchaConfig?: {
      region: string;
      prefix: string;
    };
    initAliyunCaptcha?: (options: ESACaptchaOptions) => Promise<void>;
  }
}

interface ESACaptchaOptions {
  SceneId: string;
  mode: 'popup' | 'embed';
  element: string;
  button: string;
  success: (captchaVerifyParam: string) => void;
  fail?: (result: unknown) => void;
  getInstance?: (instance: CaptchaInstance) => void;
  server?: string[];
  slideStyle?: {
    width: number;
    height: number;
  };
  language?: string;
  timeout?: number;
  onError?: (errorInfo: { code: string; msg: string }) => void;
  onClose?: () => void;
}

// ESA 验证码响应码
export const ESA_VERIFY_CODES = {
  T001: '验证通过',
  F003: 'CaptchaVerifyParam 解析错误',
  F005: '场景 ID（SceneId）不存在',
  F008: '验证码业务验证失败（已过期或内部错误）',
  F017: 'VerifyToken 内容被修改',
  F018: '验签数据重复使用',
  F019: '验签超出时间限制（有效期 90 秒）或未发起验证就验签',
  F020: '验签票据与场景 ID 或用户不匹配',
  F021: '验证的 SceneId 和验签的 SceneId 不一致',
} as const;

const getCaptchaConfig = (): ESACaptchaConfig => ({
  region: import.meta.env.VITE_CAPTCHA_REGION || 'cn',
  prefix: import.meta.env.VITE_CAPTCHA_PREFIX || '',
  sceneId: import.meta.env.VITE_CAPTCHA_SCENE_ID || '',
});

/**
 * 检查 ESA AI 验证码是否已配置启用
 */
export const isCaptchaEnabled = (): boolean => {
  const config = getCaptchaConfig();
  return !!(config.prefix && config.sceneId);
};

let scriptLoaded = false;
let scriptLoadPromise: Promise<void> | null = null;
let scriptLoadedAt = 0;

/**
 * 加载 ESA AI 验证码脚本
 */
export const loadCaptchaScript = (): Promise<void> => {
  if (scriptLoaded) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const config = getCaptchaConfig();

    // 设置全局配置
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
      reject(new Error('Failed to load ESA Captcha script'));
    };

    document.head.appendChild(script);
  });

  return scriptLoadPromise;
};

/**
 * ESA AI 验证码管理器
 * 
 * 使用方式：
 * 1. 创建实例并初始化
 * 2. 调用 triggerVerification() 触发验证
 * 3. 验证成功后获取 captchaVerifyParam
 * 4. 将 captchaVerifyParam 携带在请求中发送给 ESA 网关
 * 5. ESA 网关自动验签，无需后端额外验证
 */
export class CaptchaManager {
  private config: ESACaptchaConfig;
  private initialized = false;
  private buttonSelector: string | null = null;
  private pendingResolve: ((param: string) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private captchaInstance: CaptchaInstance | null = null;
  /** 最后一次成功的验证码参数 */
  private lastCaptchaVerifyParam: string | null = null;

  constructor() {
    this.config = getCaptchaConfig();
  }

  /**
   * 获取最后一次成功的验证码参数
   * 用于携带在请求中发送给 ESA 网关
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

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 初始化验证码
   * @param elementId 验证码渲染容器的选择器
   * @param buttonId 触发验证码弹窗的按钮选择器
   */
  async initialize(elementId: string, buttonId: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!isCaptchaEnabled()) {
      console.warn('ESA Captcha is not enabled. Please check your configuration.');
      return;
    }

    await loadCaptchaScript();

    if (!window.initAliyunCaptcha) {
      throw new Error('ESA Captcha script not loaded properly');
    }

    return new Promise((resolve, reject) => {
      this.buttonSelector = buttonId;
      window.initAliyunCaptcha!({
        SceneId: this.config.sceneId,
        mode: 'popup',
        element: elementId,
        button: buttonId,
        // ESA 专用服务域名
        server: ['captcha-esa-open.aliyuncs.com', 'captcha-esa-open-b.aliyuncs.com'],
        success: (captchaVerifyParam: string) => {
          // 保存验证码参数，用于后续请求携带
          this.lastCaptchaVerifyParam = captchaVerifyParam;
          if (this.pendingResolve) {
            this.pendingResolve(captchaVerifyParam);
            this.pendingResolve = null;
            this.pendingReject = null;
          }
        },
        fail: (result: unknown) => {
          console.error('ESA Captcha verification failed:', result);
          // 清除已保存的验证码参数
          this.lastCaptchaVerifyParam = null;
          // 验证失败后刷新验证码，以便用户可以重新验证
          if (this.captchaInstance) {
            this.captchaInstance.refresh();
          }
          if (this.pendingReject) {
            // 根据结果提供更详细的错误信息
            const failResult = result as { verifyCode?: string; success?: boolean; verifyResult?: boolean };
            let errorMessage = '验证失败，请重试';
            if (failResult?.verifyCode) {
              const codeMessage = ESA_VERIFY_CODES[failResult.verifyCode as keyof typeof ESA_VERIFY_CODES];
              if (codeMessage) {
                errorMessage = codeMessage;
              }
            }
            this.pendingReject(new Error(errorMessage));
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
          console.error('ESA Captcha error:', errorInfo);
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

  /**
   * 触发验证码验证
   * @returns 验证成功返回 captchaVerifyParam，用于携带在请求中
   */
  async triggerVerification(): Promise<string> {
    if (!isCaptchaEnabled()) {
      return '';
    }
    if (!this.initialized || !this.buttonSelector) {
      throw new Error('Captcha not initialized');
    }

    // 确保脚本加载后至少等待 2 秒再触发验证
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

  /**
   * 显示验证码弹窗
   */
  show(): void {
    if (this.captchaInstance) {
      this.captchaInstance.show();
    }
  }

  /**
   * 隐藏验证码弹窗
   */
  hide(): void {
    if (this.captchaInstance) {
      this.captchaInstance.hide();
    }
  }

  /**
   * 刷新验证码
   */
  refresh(): void {
    if (this.captchaInstance) {
      this.captchaInstance.refresh();
    }
  }
}

/**
 * 检查 ESA 响应头中的验证码验证结果
 * @param response Fetch Response 对象
 * @returns 验证是否通过
 */
export const checkESAVerifyResult = (response: Response): { success: boolean; code: string; message: string } => {
  const verifyCode = response.headers.get('x-captcha-verify-code') || response.headers.get('X-Captcha-Verify-Code');
  
  if (!verifyCode) {
    return { success: true, code: '', message: '无验证码验证' };
  }
  
  const success = verifyCode === 'T001';
  const message = ESA_VERIFY_CODES[verifyCode as keyof typeof ESA_VERIFY_CODES] || `未知验证码: ${verifyCode}`;
  
  return { success, code: verifyCode, message };
};
