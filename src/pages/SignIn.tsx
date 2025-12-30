import { useState } from 'react';
import { useLogto } from '@logto/react';
import { Button, Checkbox, Link, MessagePlugin } from 'tdesign-react';
import { redirectUri } from '../config/logto';
import './SignIn.css';

export function SignInPage() {
  const { signIn, isAuthenticated } = useLogto();
  const [agreed, setAgreed] = useState(false);
  const [showError, setShowError] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    window.location.href = '/';
    return null;
  }

  const handleSignIn = async () => {
    if (!agreed) {
      setShowError(true);
      MessagePlugin.warning('请先阅读并同意相关协议');
      return;
    }

    setLoading(true);
    try {
      await signIn(redirectUri);
    } catch (error) {
      console.error('登录失败:', error);
      MessagePlugin.error('登录失败，请稍后重试');
      setLoading(false);
    }
  };

  return (
    <div className="signin-container">
      <div className="signin-card">
        <div className="signin-header">
          <h1 className="signin-title">登录</h1>
          <p className="signin-subtitle">欢迎使用 Dailys Network 在线服务</p>
        </div>

        <div className="signin-content">
          <Button
            theme="primary"
            size="large"
            block
            loading={loading}
            onClick={handleSignIn}
          >
            通过 洛丽通行证 登录
          </Button>

          <div className={`signin-agreement ${showError ? 'agreement-error' : ''}`}>
            <Checkbox
              checked={agreed}
              onChange={(checked) => {
                setAgreed(checked as boolean);
                if (checked) setShowError(false);
              }}
            >
              <span className="agreement-text">
                我已阅读并同意
                <Link theme="primary" href="/terms" target="_blank">《用户协议》</Link>
                <Link theme="primary" href="/privacy" target="_blank">《隐私政策》</Link>
                <Link theme="primary" href="/data-transfer" target="_blank">《Dailys Network个人数据跨境传输知情书》</Link>
              </span>
            </Checkbox>
          </div>
        </div>
      </div>
    </div>
  );
}
