import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CaptchaManager,
  isCaptchaEnabled,
} from '../services/captchaService';
import {
  verifyPasswordWithCaptcha as verifyPasswordApi,
  isSecurityApiEnabled,
  type VerifyPasswordResponse,
} from '../services/securityApi';

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
  /** 触发验证码验证，返回验证码参数（用于后端验签） */
  verifyCaptcha: () => Promise<string | null>;
  /** 
   * 验证码 + 密码验证，获取 verificationRecordId（推荐用于敏感操作）
   * @param password 用户当前密码
   * @param accessToken Logto access token
   * @returns verificationRecordId 和过期时间，失败返回 null
   */
  verifyPasswordWithCaptcha: (
    password: string,
    accessToken: string
  ) => Promise<VerifyPasswordResponse | null>;
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
        console.error('Failed to initialize captcha:', err);
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
      throw new Error('验证码调用失败');
    }

    if (!managerRef.current) {
      try {
        const manager = new CaptchaManager();
        await manager.initialize(elementId, buttonId);
        managerRef.current = manager;
      } catch (err) {
        console.error('Failed to initialize captcha on demand:', err);
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

  /**
   * 验证码 + 密码验证，获取 verificationRecordId
   * 这是敏感操作的推荐入口
   */
  const verifyPasswordWithCaptcha = useCallback(async (
    password: string,
    accessToken: string
  ): Promise<VerifyPasswordResponse | null> => {
    // 检查后端安全 API 是否可用
    if (!isSecurityApiEnabled()) {
      const err = new Error('安全 API 未配置');
      setError(err);
      onFail?.(err);
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!isEnabled) {
        throw new Error('验证码未启用，无法进行安全验证');
      }
      
      const captchaVerifyParam = await verifyCaptcha();
      
      // 如果验证码未启用，返回空字符串允许继续；如果启用但验证失败，返回 null
      if (captchaVerifyParam === null) {
        // 验证失败，错误已在 verifyCaptcha 中设置
        return null;
      }

      // 2. 调用后端接口进行密码验证并获取 verificationRecordId
      const result = await verifyPasswordApi(
        captchaVerifyParam,
        password,
        accessToken
      );

      onSuccess?.();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('验证失败');
      setError(error);
      onFail?.(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [verifyCaptcha, onSuccess, onFail]);

  return {
    isLoading,
    isEnabled,
    error,
    verifyCaptcha,
    verifyPasswordWithCaptcha,
    getLastCaptchaVerifyParam,
  };
};

export default useCaptcha;