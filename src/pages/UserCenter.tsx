import { useState, useEffect, useCallback, useRef } from 'react';
import { useLogto } from '@logto/react';
import {
  Card,
  Form,
  Input,
  Button,
  Avatar,
  MessagePlugin,
  Dialog,
  Space,
  Tabs,
  Divider,
  Loading,
  Select,
} from 'tdesign-react';
import {
  UserIcon,
  LockOnIcon,
  MailIcon,
  CallIcon,
  EditIcon,
  CheckIcon,
  CloseIcon,
} from 'tdesign-icons-react';
import { AccountApiService, type AccountInfo } from '../services/accountApi';
import {
  CaptchaManager,
  isCaptchaEnabled,
  loadCaptchaScript,
} from '../services/captchaService';
import {
  verifyPasswordWithCaptcha,
  isSecurityApiEnabled,
} from '../services/securityApi';
import './UserCenter.css';

const { FormItem } = Form;
const { TabPanel } = Tabs;

// 工具函数：格式化手机号显示（只显示最后4位）
const formatPhoneDisplay = (phone: string | null | undefined): string => {
  if (!phone) return '未绑定手机';
  const cleanPhone = phone.replace(/\s+/g, ''); // 去除空格
  if (cleanPhone.length <= 4) return cleanPhone;
  return '****' + cleanPhone.slice(-4);
};

// 工具函数：格式化邮箱显示（显示前两位和域名）
const formatEmailDisplay = (email: string | null | undefined): string => {
  if (!email) return '未绑定邮箱';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [localPart, domain] = parts;
  if (localPart.length <= 2) return email;
  return localPart.slice(0, 2) + '***@' + domain;
};

export function UserCenterPage() {
  const { getAccessToken, isAuthenticated } = useLogto();
  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [accountService, setAccountService] = useState<AccountApiService | null>(null);

  // 编辑状态
  const [editingName, setEditingName] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // 敏感操作对话框状态
  const [verifyPasswordDialogVisible, setVerifyPasswordDialogVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<'password' | 'email' | 'phone' | null>(null);
  const [passwordDialogVisible, setPasswordDialogVisible] = useState(false);
  const [emailDialogVisible, setEmailDialogVisible] = useState(false);
  const [phoneDialogVisible, setPhoneDialogVisible] = useState(false);

  // 验证状态
  const [verifying, setVerifying] = useState(false);
  const [verificationRecordId, setVerificationRecordId] = useState('');

  // 表单值
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailVerificationId, setEmailVerificationId] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+86');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneVerificationId, setPhoneVerificationId] = useState('');
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [phoneCountdown, setPhoneCountdown] = useState(0);

  // Captcha 相关状态
  const [captchaVerifying, setCaptchaVerifying] = useState(false);
  const emailCaptchaManagerRef = useRef<CaptchaManager | null>(null);
  const phoneCaptchaManagerRef = useRef<CaptchaManager | null>(null);
  const passwordCaptchaManagerRef = useRef<CaptchaManager | null>(null);
  const captchaEnabled = isCaptchaEnabled();
  const securityApiEnabled = isSecurityApiEnabled();

  // 初始化 Captcha
  useEffect(() => {
    if (!captchaEnabled) return;

    const initCaptcha = async () => {
      try {
        await loadCaptchaScript();
        
        // 初始化邮箱验证码 Captcha
        const emailManager = new CaptchaManager();
        emailCaptchaManagerRef.current = emailManager;
        
        // 初始化手机验证码 Captcha
        const phoneManager = new CaptchaManager();
        phoneCaptchaManagerRef.current = phoneManager;

        // 初始化密码验证 Captcha（用于敏感操作前的身份验证）
        const passwordManager = new CaptchaManager();
        passwordCaptchaManagerRef.current = passwordManager;
      } catch (error) {
        console.error('Captcha 初始化失败:', error);
      }
    };

    initCaptcha();
  }, [captchaEnabled]);

  // 当密码验证对话框打开时，初始化验证码（确保 DOM 元素已渲染）
  useEffect(() => {
    if (!verifyPasswordDialogVisible || !captchaEnabled || !passwordCaptchaManagerRef.current) {
      return;
    }

    const initPasswordCaptcha = async () => {
      try {
        // 等待 DOM 元素渲染完成
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!passwordCaptchaManagerRef.current?.isInitialized()) {
          await passwordCaptchaManagerRef.current?.initialize(
            '#password-captcha-element',
            '#password-captcha-trigger-btn'
          );
        }
      } catch (error) {
        console.error('密码验证码初始化失败:', error);
      }
    };

    initPasswordCaptcha();
  }, [verifyPasswordDialogVisible, captchaEnabled]);

  // 初始化 Account API 服务
  const initAccountService = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const token = await getAccessToken();
      if (token) {
        const service = new AccountApiService(token);
        setAccountService(service);
        return service;
      }
    } catch (error) {
      console.error('获取访问令牌失败:', error);
      MessagePlugin.error('获取访问令牌失败');
    }
    return null;
  }, [getAccessToken, isAuthenticated]);

  // 加载用户信息
  const loadAccountInfo = useCallback(async () => {
    setLoading(true);
    try {
      let service = accountService;
      if (!service) {
        service = (await initAccountService()) || null;
      }
      if (service) {
        const info = await service.getAccountInfo();
        setAccountInfo(info);
        setNameValue(info.name || '');
        setAvatarUrl(info.avatar || '');
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
      MessagePlugin.error('加载用户信息失败');
    } finally {
      setLoading(false);
    }
  }, [accountService, initAccountService]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAccountInfo();
    }
  }, [isAuthenticated, loadAccountInfo]);

  // 邮箱验证码倒计时
  useEffect(() => {
    if (emailCountdown > 0) {
      const timer = setTimeout(() => setEmailCountdown(emailCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailCountdown]);

  // 手机验证码倒计时
  useEffect(() => {
    if (phoneCountdown > 0) {
      const timer = setTimeout(() => setPhoneCountdown(phoneCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneCountdown]);

  // 更新姓名
  const handleUpdateName = async () => {
    if (!accountService || !nameValue.trim()) {
      MessagePlugin.warning('请输入姓名');
      return;
    }
    try {
      await accountService.updateAccountInfo({ name: nameValue.trim() });
      MessagePlugin.success('姓名更新成功');
      setEditingName(false);
      loadAccountInfo();
    } catch (error) {
      console.error('更新姓名失败:', error);
      MessagePlugin.error('更新姓名失败');
    }
  };

  // 更新头像
  const handleUpdateAvatar = async () => {
    if (!accountService || !avatarUrl.trim()) {
      MessagePlugin.warning('请输入头像地址');
      return;
    }
    try {
      await accountService.updateAccountInfo({ avatar: avatarUrl.trim() });
      MessagePlugin.success('头像更新成功');
      setEditingAvatar(false);
      loadAccountInfo();
    } catch (error) {
      console.error('更新头像失败:', error);
      MessagePlugin.error('更新头像失败');
    }
  };

  // 验证当前密码（仅用于验证对话框）
  // 使用后端安全 API 代理进行验证码验证 + 密码验证
  const handleVerifyPasswordForAction = async () => {
    if (!accountService || !currentPassword) {
      MessagePlugin.warning('请输入当前密码');
      return;
    }

    // 检查后端安全 API 是否可用
    if (!securityApiEnabled) {
      MessagePlugin.error('安全服务未配置，无法进行身份验证');
      return;
    }

    setVerifying(true);
    setCaptchaVerifying(true);

    try {
      // 1. 实时获取最新的 access token（避免使用缓存的过期 token）
      // 必须指定 resource 才能获取有效的 access token
      const resource = import.meta.env.VITE_API_BASE || 'https://api.dailys.zone';
      const accessToken = await getAccessToken(resource);
      
      if (!accessToken) {
        MessagePlugin.error('无法获取访问令牌，请重新登录');
        return;
      }

      // 2. 触发验证码验证获取 captchaVerifyParam
      let captchaVerifyParam: string | null = null;
      if (captchaEnabled && passwordCaptchaManagerRef.current) {
        // 检查验证码是否已初始化（在对话框打开时由 useEffect 初始化）
        if (!passwordCaptchaManagerRef.current.isInitialized()) {
          MessagePlugin.error('验证码初始化中，请稍后重试');
          return;
        }
        captchaVerifyParam = await passwordCaptchaManagerRef.current.triggerVerification();
        if (!captchaVerifyParam) {
          MessagePlugin.error('人机验证失败，请重试');
          return;
        }
      } else if (captchaEnabled) {
        MessagePlugin.error('验证码服务未初始化，请刷新页面重试');
        return;
      }

      // 3. 调用后端 API 进行密码验证
      const result = await verifyPasswordWithCaptcha(
        captchaVerifyParam || '',
        currentPassword,
        accessToken
      );

      if (!result) {
        // 验证失败（错误已在 hook 中处理并显示）
        return;
      }

      // 后端返回的是 snake_case，需要转换
      setVerificationRecordId(result.verification_record_id);
      MessagePlugin.success('身份验证成功');
      
      // 关闭验证对话框
      setVerifyPasswordDialogVisible(false);
      
      // 打开对应的修改对话框
      if (pendingAction === 'password') {
        setPasswordDialogVisible(true);
      } else if (pendingAction === 'email') {
        setEmailDialogVisible(true);
      } else if (pendingAction === 'phone') {
        setPhoneDialogVisible(true);
      }
    } catch (error) {
      console.error('身份验证失败:', error);
      MessagePlugin.error(error instanceof Error ? error.message : '身份验证失败，请检查当前密码是否正确');
    } finally {
      setVerifying(false);
    }
  };

  // 更新密码
  const handleUpdatePassword = async () => {
    if (!accountService) return;
    
    if (!newPassword) {
      MessagePlugin.warning('请输入新密码');
      return;
    }
    if (newPassword !== confirmPassword) {
      MessagePlugin.warning('两次输入的密码不一致');
      return;
    }
    if (newPassword.length < 8) {
      MessagePlugin.warning('密码长度不能少于8位');
      return;
    }

    setVerifying(true);
    try {
      await accountService.updatePassword(newPassword, verificationRecordId);
      MessagePlugin.success('密码更新成功');
      setPasswordDialogVisible(false);
      resetPasswordForm();
    } catch (error) {
      console.error('更新密码失败:', error);
      MessagePlugin.error('更新密码失败');
    } finally {
      setVerifying(false);
    }
  };

  // 发送邮箱验证码（带 Captcha 验证）
  const handleSendEmailCode = async () => {
    if (!accountService || !newEmail) {
      MessagePlugin.warning('请输入新邮箱地址');
      return;
    }
    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      MessagePlugin.warning('请输入有效的邮箱地址');
      return;
    }

    // 如果启用了 Captcha，先进行人机验证（纯前端门槛，无后端验签）
    if (captchaEnabled && emailCaptchaManagerRef.current) {
      setCaptchaVerifying(true);
      try {
        // 初始化并触发验证
        await emailCaptchaManagerRef.current.initialize(
          '#email-captcha-element',
          '#email-captcha-trigger-btn'
        );
        const captchaVerifyParam = await emailCaptchaManagerRef.current.triggerVerification();
        if (!captchaVerifyParam) {
          MessagePlugin.error('人机验证失败，请重试');
          return;
        }
      } catch (error) {
        // 用户取消验证或验证失败
        if (error instanceof Error && error.message !== '用户取消验证') {
          MessagePlugin.error('人机验证失败，请重试');
        }
        return;
      } finally {
        setCaptchaVerifying(false);
      }
    }

    try {
      const result = await accountService.sendVerificationCode('email', newEmail);
      setEmailVerificationId(result.verificationRecordId);
      setEmailCountdown(60);
      MessagePlugin.success('验证码已发送到新邮箱');
    } catch (error) {
      console.error('发送验证码失败:', error);
      MessagePlugin.error('发送验证码失败');
    }
  };

  // 更新邮箱
  const handleUpdateEmail = async () => {
    if (!accountService) return;

    if (!newEmail || !emailCode) {
      MessagePlugin.warning('请填写完整信息');
      return;
    }

    setVerifying(true);
    try {
      // 验证邮箱验证码
      const emailResult = await accountService.verifyCode(
        'email',
        newEmail,
        emailVerificationId,
        emailCode
      );

      // 更新邮箱（使用之前验证的密码记录ID）
      await accountService.updatePrimaryEmail(
        newEmail,
        emailResult.verificationRecordId,
        verificationRecordId
      );

      MessagePlugin.success('邮箱更新成功');
      setEmailDialogVisible(false);
      setEmailCountdown(0); // 验证成功，取消倒计时
      resetEmailForm();
      loadAccountInfo();
    } catch (error) {
      console.error('更新邮箱失败:', error);
      MessagePlugin.error('更新邮箱失败');
    } finally {
      setVerifying(false);
    }
  };

  // 发送手机验证码（带 Captcha 验证）
  const handleSendPhoneCode = async () => {
    if (!accountService || !newPhone) {
      MessagePlugin.warning('请输入新手机号');
      return;
    }
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(newPhone)) {
      MessagePlugin.warning('请输入有效的手机号');
      return;
    }

    // 如果启用了 Captcha，先进行人机验证（纯前端门槛，无后端验签）
    if (captchaEnabled && phoneCaptchaManagerRef.current) {
      setCaptchaVerifying(true);
      try {
        // 初始化并触发验证
        await phoneCaptchaManagerRef.current.initialize(
          '#phone-captcha-element',
          '#phone-captcha-trigger-btn'
        );
        const captchaVerifyParam = await phoneCaptchaManagerRef.current.triggerVerification();
        if (!captchaVerifyParam) {
          MessagePlugin.error('人机验证失败，请重试');
          return;
        }
      } catch (error) {
        // 用户取消验证或验证失败
        if (error instanceof Error && error.message !== '用户取消验证') {
          MessagePlugin.error('人机验证失败，请重试');
        }
        return;
      } finally {
        setCaptchaVerifying(false);
      }
    }

    try {
      const fullPhone = `${phoneCountryCode.replace('+', '')}${newPhone}`;
      const result = await accountService.sendVerificationCode('phone', fullPhone);
      setPhoneVerificationId(result.verificationRecordId);
      setPhoneCountdown(60);
      MessagePlugin.success('验证码已发送到新手机');
    } catch (error) {
      console.error('发送验证码失败:', error);
      MessagePlugin.error('发送验证码失败');
    }
  };

  // 更新手机号
  const handleUpdatePhone = async () => {
    if (!accountService) return;

    if (!newPhone || !phoneCode) {
      MessagePlugin.warning('请填写完整信息');
      return;
    }

    setVerifying(true);
    try {
      const fullPhone = `${phoneCountryCode.replace('+', '')}${newPhone}`;

      // 验证手机验证码
      const phoneResult = await accountService.verifyCode(
        'phone',
        fullPhone,
        phoneVerificationId,
        phoneCode
      );

      // 更新手机号（使用之前验证的密码记录ID）
      await accountService.updatePrimaryPhone(
        fullPhone,
        phoneResult.verificationRecordId,
        verificationRecordId
      );

      MessagePlugin.success('手机号更新成功');
      setPhoneDialogVisible(false);
      setPhoneCountdown(0); // 验证成功，取消倒计时
      resetPhoneForm();
      loadAccountInfo();
    } catch (error) {
      console.error('更新手机号失败:', error);
      MessagePlugin.error('更新手机号失败');
    } finally {
      setVerifying(false);
    }
  };

  // 重置表单
  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setVerificationRecordId('');
  };

  const resetEmailForm = () => {
    setCurrentPassword('');
    setNewEmail('');
    setEmailCode('');
    setEmailVerificationId('');
  };

  const resetPhoneForm = () => {
    setCurrentPassword('');
    setNewPhone('');
    setPhoneCountryCode('+86');
    setPhoneCode('');
    setPhoneVerificationId('');
  };

  if (loading) {
    return (
      <div className="user-center-loading">
        <Loading text="加载中..." />
      </div>
    );
  }

  return (
    <div className="user-center-container">
      <h1 className="user-center-title">用户中心</h1>
      
      <Tabs defaultValue="profile">
        <TabPanel value="profile" label="基本信息">
          <div className="user-center-content">
            {/* 头像区域 */}
            <Card className="user-center-card" title="头像" bordered>
              <div className="avatar-section">
                <Avatar
                  size="100px"
                  image={accountInfo?.avatar || undefined}
                  icon={!accountInfo?.avatar ? <UserIcon /> : undefined}
                />
                <div className="avatar-actions">
                  {editingAvatar ? (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Input
                        value={avatarUrl}
                        onChange={(val) => setAvatarUrl(val as string)}
                        placeholder="请输入头像 URL"
                      />
                      <Space>
                        <Button
                          theme="primary"
                          icon={<CheckIcon />}
                          onClick={handleUpdateAvatar}
                        >
                          保存
                        </Button>
                        <Button
                          variant="outline"
                          icon={<CloseIcon />}
                          onClick={() => {
                            setEditingAvatar(false);
                            setAvatarUrl(accountInfo?.avatar || '');
                          }}
                        >
                          取消
                        </Button>
                      </Space>
                    </Space>
                  ) : (
                    <Button
                      variant="outline"
                      icon={<EditIcon />}
                      onClick={() => setEditingAvatar(true)}
                    >
                      更换头像
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* 基本信息卡片 */}
            <Card className="user-center-card" title="账户信息" bordered>
              <Form labelWidth={100} labelAlign="right">
                <FormItem label="用户 ID">
                  <Input
                    value={accountInfo?.id || ''}
                    disabled
                    readonly
                  />
                </FormItem>
                <FormItem label="用户名">
                  <Input
                    value={accountInfo?.username || '暂无'}
                    disabled
                    readonly
                  />
                </FormItem>
                <FormItem label="姓名">
                  {editingName ? (
                    <Space>
                      <Input
                        value={nameValue}
                        onChange={(val) => setNameValue(val as string)}
                        placeholder="请输入姓名"
                        style={{ width: '200px' }}
                      />
                      <Button
                        theme="primary"
                        icon={<CheckIcon />}
                        onClick={handleUpdateName}
                      >
                        保存
                      </Button>
                      <Button
                        variant="outline"
                        icon={<CloseIcon />}
                        onClick={() => {
                          setEditingName(false);
                          setNameValue(accountInfo?.name || '');
                        }}
                      >
                        取消
                      </Button>
                    </Space>
                  ) : (
                    <Space>
                      <Input
                        value={accountInfo?.name || '暂无'}
                        disabled
                        readonly
                        style={{ width: '200px' }}
                      />
                      <Button
                        variant="text"
                        icon={<EditIcon />}
                        onClick={() => setEditingName(true)}
                      >
                        编辑
                      </Button>
                    </Space>
                  )}
                </FormItem>
              </Form>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="security" label="安全设置">
          <div className="user-center-content">
            <Card className="user-center-card" bordered>
              <div className="security-item">
                <div className="security-info">
                  <LockOnIcon className="security-icon" />
                  <div>
                    <div className="security-title">登录密码</div>
                    <div className="security-desc">
                      {accountInfo?.hasPassword ? '已设置密码' : '未设置密码'}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetPasswordForm();
                    setPendingAction('password');
                    setVerifyPasswordDialogVisible(true);
                  }}
                >
                  {accountInfo?.hasPassword ? '修改密码' : '设置密码'}
                </Button>
              </div>

              <Divider />

              <div className="security-item">
                <div className="security-info">
                  <MailIcon className="security-icon" />
                  <div>
                    <div className="security-title">电子邮箱</div>
                    <div className="security-desc">
                      {formatEmailDisplay(accountInfo?.primaryEmail)}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetEmailForm();
                    setPendingAction('email');
                    setVerifyPasswordDialogVisible(true);
                  }}
                >
                  {accountInfo?.primaryEmail ? '更换邮箱' : '绑定邮箱'}
                </Button>
              </div>

              <Divider />

              <div className="security-item">
                <div className="security-info">
                  <CallIcon className="security-icon" />
                  <div>
                    <div className="security-title">手机号码</div>
                    <div className="security-desc">
                      {formatPhoneDisplay(accountInfo?.primaryPhone)}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetPhoneForm();
                    setPendingAction('phone');
                    setVerifyPasswordDialogVisible(true);
                  }}
                >
                  {accountInfo?.primaryPhone ? '更换手机' : '绑定手机'}
                </Button>
              </div>
            </Card>
          </div>
        </TabPanel>
      </Tabs>

      {/* 密码验证对话框 */}
      <Dialog
        header="身份验证"
        visible={verifyPasswordDialogVisible}
        onClose={() => {
          setVerifyPasswordDialogVisible(false);
          setCurrentPassword('');
          setPendingAction(null);
        }}
        onConfirm={handleVerifyPasswordForAction}
        confirmBtn={{ loading: verifying || captchaVerifying, content: captchaVerifying ? '验证中...' : '验证' }}
      >
        <Form labelWidth={100} labelAlign="right">
          <FormItem label="当前密码" requiredMark>
            <Input
              type="password"
              value={currentPassword}
              onChange={(val) => setCurrentPassword(val as string)}
              placeholder="请输入当前密码进行身份验证"
              onEnter={handleVerifyPasswordForAction}
            />
          </FormItem>
        </Form>
        {/* Captcha 元素（用于密码验证前的人机验证） */}
        <div id="password-captcha-element" style={{ display: 'none' }} />
        <button id="password-captcha-trigger-btn" type="button" style={{ display: 'none' }} />
      </Dialog>

      {/* 修改密码对话框 */}
      <Dialog
        header="修改密码"
        visible={passwordDialogVisible}
        onClose={() => {
          setPasswordDialogVisible(false);
          resetPasswordForm();
        }}
        onConfirm={handleUpdatePassword}
        confirmBtn={{ loading: verifying, content: '确认修改' }}
      >
        <Form labelWidth={100} labelAlign="right">
          <FormItem label="新密码" requiredMark>
            <Input
              type="password"
              value={newPassword}
              onChange={(val) => setNewPassword(val as string)}
              placeholder="请输入新密码（至少8位）"
            />
          </FormItem>
          <FormItem label="确认密码" requiredMark>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(val) => setConfirmPassword(val as string)}
              placeholder="请再次输入新密码"
            />
          </FormItem>
        </Form>
      </Dialog>

      {/* 修改邮箱对话框 */}
      <Dialog
        header="更换邮箱"
        visible={emailDialogVisible}
        onClose={() => {
          setEmailDialogVisible(false);
          setEmailCountdown(0); // 关闭对话框时清除倒计时
          resetEmailForm();
        }}
        onConfirm={handleUpdateEmail}
        confirmBtn={{ loading: verifying, content: '确认更换' }}
      >
        <Form labelWidth={100} labelAlign="right">
          <FormItem label="新邮箱" requiredMark>
            <Input
              value={newEmail}
              onChange={(val) => setNewEmail(val as string)}
              placeholder="请输入新邮箱地址"
            />
          </FormItem>
          <FormItem label="验证码" requiredMark>
            <Space>
              <Input
                value={emailCode}
                onChange={(val) => setEmailCode(val as string)}
                placeholder="请输入验证码"
                style={{ width: '150px' }}
              />
              <Button
                id="email-send-code-btn"
                variant="outline"
                disabled={emailCountdown > 0 || captchaVerifying}
                loading={captchaVerifying}
                onClick={handleSendEmailCode}
              >
                {captchaVerifying ? '验证中...' : (emailCountdown > 0 ? `${emailCountdown}秒后重发` : '发送验证码')}
              </Button>
            </Space>
          </FormItem>
        </Form>
        {/* Captcha */}
        <div id="email-captcha-element" style={{ display: 'none' }} />
        <button id="email-captcha-trigger-btn" type="button" style={{ display: 'none' }} />
      </Dialog>

      {/* 修改手机号对话框 */}
      <Dialog
        header="更换手机号"
        visible={phoneDialogVisible}
        onClose={() => {
          setPhoneDialogVisible(false);
          setPhoneCountdown(0); // 关闭对话框时清除倒计时
          resetPhoneForm();
        }}
        onConfirm={handleUpdatePhone}
        confirmBtn={{ loading: verifying, content: '确认更换' }}
      >
        <Form labelWidth={100} labelAlign="right">
          <FormItem label="国家/地区" requiredMark>
            <Select
              value={phoneCountryCode}
              onChange={(val) => setPhoneCountryCode(val as string)}
              options={[
                { label: '🇨🇳 中国大陆 (+86)', value: '+86' },
                { label: '🇺🇸 美国 (+1)', value: '+1' },
                { label: '🇬🇧 英国 (+44)', value: '+44' },
                { label: '🇯🇵 日本 (+81)', value: '+81' },
                { label: '🇰🇷 韩国 (+82)', value: '+82' },
                { label: '🇭🇰 香港 (+852)', value: '+852' },
                { label: '🇹🇼 台湾 (+886)', value: '+886' },
                { label: '🇸🇬 新加坡 (+65)', value: '+65' },
              ]}
            />
          </FormItem>
          <FormItem label="新手机号" requiredMark>
            <Input
              value={newPhone}
              onChange={(val) => setNewPhone(val as string)}
              placeholder="请输入手机号（不含区号）"
            />
          </FormItem>
          <FormItem label="验证码" requiredMark>
            <Space>
              <Input
                value={phoneCode}
                onChange={(val) => setPhoneCode(val as string)}
                placeholder="请输入验证码"
                style={{ width: '150px' }}
              />
              <Button
                id="phone-send-code-btn"
                variant="outline"
                disabled={phoneCountdown > 0 || captchaVerifying}
                loading={captchaVerifying}
                onClick={handleSendPhoneCode}
              >
                {captchaVerifying ? '验证中...' : (phoneCountdown > 0 ? `${phoneCountdown}秒后重发` : '发送验证码')}
              </Button>
            </Space>
          </FormItem>
        </Form>
        {/* Captcha */}
        <div id="phone-captcha-element" style={{ display: 'none' }} />
        <button id="phone-captcha-trigger-btn" type="button" style={{ display: 'none' }} />
      </Dialog>
    </div>
  );
}
