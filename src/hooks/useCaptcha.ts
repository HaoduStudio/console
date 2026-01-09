import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CaptchaManager,
  isCaptchaEnabled,
} from '../services/captchaService';

interface UseCaptchaOptions {
  elementId: string;
  buttonId: string;
  onSuccess?: () => void;
  onFail?: (error: Error) => void;
}

interface UseCaptchaReturn {
  isLoading: boolean;
  isEnabled: boolean;
  error: Error | null;
  /** 触发验证码验证，返回验证码参数（用于携带在请求中发送给 ESA 网关） */
  verifyCaptcha: () => Promise<string | null>;
  /** 获取最后一次成功的验证码参数 */
  getLastCaptchaVerifyParam: () => string | null;
}

export const useCaptcha = (options: UseCaptchaOptions): UseCaptchaReturn => {
  const { elementId, buttonId, onSuccess, onFail } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const managerRef = useRef<CaptchaManager | null>(null);
  const initializedRef = useRef(false);

  const isEnabled = isCaptchaEnabled();

  // 初始化验证码
  useEffect(() => {
    if (!isEnabled || initializedRef.current) {
      return;
    }

    const initCaptcha = async () => {
      try {
        const manager = new CaptchaManager();
        await manager.initialize(elementId, buttonId);
        managerRef.current = manager;
        initializedRef.current = true;
      } catch (err) {
        console.error('Failed to initialize ESA captcha:', err);
        setError(err instanceof Error ? err : new Error('验证码初始化失败'));
      }
    };

    const timer = setTimeout(initCaptcha, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [isEnabled, elementId, buttonId]);

  /**
   * 获取最后一次成功的验证码参数
   */
  const getLastCaptchaVerifyParam = useCallback((): string | null => {
    return managerRef.current?.getLastCaptchaVerifyParam() || null;
  }, []);

  /**
   * 触发验证码验证，返回验证码参数
   */
  const verifyCaptcha = useCallback(async (): Promise<string | null> => {
    if (!isEnabled) {
      // 未启用验证码时直接返回空字符串，允许继续操作
      return '';
    }

    if (!managerRef.current) {
      try {
        const manager = new CaptchaManager();
        await manager.initialize(elementId, buttonId);
        managerRef.current = manager;
      } catch (err) {
        console.error('Failed to initialize ESA captcha on demand:', err);
        const error = err instanceof Error ? err : new Error('验证码初始化失败');
        setError(error);
        onFail?.(error);
        return null;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const captchaVerifyParam = await managerRef.current.triggerVerification();
      if (!captchaVerifyParam) {
        const err = new Error('人机验证失败，请重试');
        setError(err);
        onFail?.(err);
        return null;
      }
      onSuccess?.();
      return captchaVerifyParam;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('验证过程出错');
      setError(error);
      onFail?.(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, elementId, buttonId, onSuccess, onFail]);

  return {
    isLoading,
    isEnabled,
    error,
    verifyCaptcha,
    getLastCaptchaVerifyParam,
  };
};

export default useCaptcha;