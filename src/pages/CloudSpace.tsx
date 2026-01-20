import { useState, useEffect, useCallback } from 'react';
import { useLogto } from '@logto/react';
import {
  Card,
  Button,
  MessagePlugin,
  Dialog,
  Form,
  Input,
  Progress,
  List,
  Loading,
  Divider,
} from 'tdesign-react';
import {
  CloudIcon,
  GiftIcon,
  TicketIcon,
  UserIcon,
  RefreshIcon,
  InfoCircleIcon,
} from 'tdesign-icons-react';
import {
  CloudSpaceApiService,
  type CloudQuotaResponse,
  type QuotaSegment,
  formatStorageSize,
  getQuotaSourceText,
  calculateUsagePercentage,
} from '../services/cloudSpaceApi';
import './CloudSpace.css';

const { FormItem } = Form;
const { ListItem, ListItemMeta } = List;

export function CloudSpacePage() {
  const { getAccessToken, isAuthenticated } = useLogto();
  const [loading, setLoading] = useState(true);
  const [cloudSpaceService, setCloudSpaceService] = useState<CloudSpaceApiService | null>(null);
  const [cloudQuota, setCloudQuota] = useState<CloudQuotaResponse | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [redeemDialogVisible, setRedeemDialogVisible] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [quotaDetailsVisible, setQuotaDetailsVisible] = useState(false);
  const [hasSignedInToday, setHasSignedInToday] = useState(false);

  // 初始化云空间服务
  const initCloudSpaceService = useCallback(async () => {
    if (!isAuthenticated) return null;
    
    try {
      const token = await getAccessToken(import.meta.env.VITE_LOGTO_RESOURCES?.split(',')[0]);
      if (token) {
        const service = new CloudSpaceApiService(token);
        setCloudSpaceService(service);
        return service;
      }
    } catch (error) {
      console.error('初始化云空间服务失败:', error);
    }
    return null;
  }, [getAccessToken, isAuthenticated]);

  // 加载云空间配额
  const loadCloudQuota = useCallback(async () => {
    setLoading(true);
    try {
      let service = cloudSpaceService;
      if (!service) {
        service = await initCloudSpaceService();
      }
      if (service) {
        const quota = await service.getQuota();
        setCloudQuota(quota);
      }
    } catch (error) {
      console.error('加载云空间配额失败:', error);
      MessagePlugin.error('加载云空间信息失败');
    } finally {
      setLoading(false);
    }
  }, [cloudSpaceService, initCloudSpaceService]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadCloudQuota();
    }
  }, [isAuthenticated, loadCloudQuota]);

  // 每日签到
  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      let service = cloudSpaceService;
      if (!service) {
        service = await initCloudSpaceService();
      }
      if (!service) {
        MessagePlugin.error('服务初始化失败，请稍后重试');
        return;
      }
      
      const result = await service.checkIn();
      if (result.already_checked_in) {
        MessagePlugin.warning(result.message || '今日已签到');
        setHasSignedInToday(true);
      } else {
        MessagePlugin.success(`签到成功！获得 ${formatStorageSize(result.reward_kb || 0)} 云空间`);
        setHasSignedInToday(true);
        await loadCloudQuota();
      }
    } catch (error) {
      console.error('签到失败:', error);
      MessagePlugin.error(error instanceof Error ? error.message : '签到失败');
    } finally {
      setCheckingIn(false);
    }
  };

  // 兑换码兑换
  const handleRedeem = async () => {
    if (!redeemCode.trim()) {
      MessagePlugin.warning('请输入兑换码');
      return;
    }
    
    setRedeeming(true);
    try {
      let service = cloudSpaceService;
      if (!service) {
        service = await initCloudSpaceService();
      }
      if (!service) {
        MessagePlugin.error('服务初始化失败，请稍后重试');
        return;
      }
      
      const result = await service.redeemCode(redeemCode.trim());
      MessagePlugin.success(`兑换成功！获得 ${formatStorageSize(result.reward_kb)} 云空间`);
      setRedeemDialogVisible(false);
      setRedeemCode('');
      await loadCloudQuota();
    } catch (error) {
      console.error('兑换失败:', error);
      MessagePlugin.error(error instanceof Error ? error.message : '兑换失败');
    } finally {
      setRedeeming(false);
    }
  };

  const formatExpiresAt = (expiresAt: string | null): string => {
    if (!expiresAt) return '永久有效';
    const date = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return '已过期';
    if (diffDays === 0) return '今日到期';
    if (diffDays <= 7) return `${diffDays}天后到期`;
    return date.toLocaleDateString('zh-CN');
  };

  if (loading) {
    return (
      <div className="cloud-space-loading">
        <Loading text="加载中..." />
      </div>
    );
  }

  return (
    <div className="cloud-space-container">
      <div className="page-header">
        <h1>云空间</h1>
      </div>

      <Card 
        className="quota-overview-card" 
        bordered
        actions={
          <Button
            variant="text"
            icon={<RefreshIcon />}
            onClick={loadCloudQuota}
          >
            刷新
          </Button>
        }
      >
        {cloudQuota ? (
          <div className="quota-overview">
            <div className="quota-icon-wrapper">
              <CloudIcon />
            </div>
            <div className="quota-details">
              <div className="quota-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="quota-title">云空间总览</span>
                  <Button
                    shape="circle"
                    variant="text"
                    size="small"
                    icon={<InfoCircleIcon />}
                    onClick={() => setQuotaDetailsVisible(true)}
                  />
                </div>
                <span className="quota-percent">
                  {calculateUsagePercentage(cloudQuota.used_kb, cloudQuota.total_quota_kb)}%
                </span>
              </div>
              <Progress
                percentage={calculateUsagePercentage(cloudQuota.used_kb, cloudQuota.total_quota_kb)}
                color={calculateUsagePercentage(cloudQuota.used_kb, cloudQuota.total_quota_kb) > 90 ? 'var(--td-error-color)' : undefined}
                strokeWidth="16px"
              />
              <div className="quota-stats">
                <div className="stat-item">
                  <span className="stat-label">已使用</span>
                  <span className="stat-value">{formatStorageSize(cloudQuota.used_kb)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">剩余可用</span>
                  <span className="stat-value highlight">{formatStorageSize(cloudQuota.available_kb)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">总配额</span>
                  <span className="stat-value">{formatStorageSize(cloudQuota.total_quota_kb)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">基础配额</span>
                  <span className="stat-value">{formatStorageSize(cloudQuota.default_quota_kb)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="quota-empty">
            <p>无法加载云空间信息</p>
            <Button theme="primary" onClick={loadCloudQuota}>
              重新加载
            </Button>
          </div>
        )}
      </Card>

      <Card className="actions-card" title="获取更多空间" bordered>
        <div className="action-buttons">
          <div className="action-item">
            <div className="action-icon checkin">
              <GiftIcon />
            </div>
            <div className="action-info">
              <h4>每日签到</h4>
              <p>每日签到可随机获得 1-10 MB 云空间</p>
            </div>
            <Button
              theme="primary"
              onClick={handleCheckIn}
              loading={checkingIn}
              disabled={hasSignedInToday}
            >
              {hasSignedInToday ? '今日已签到' : '立即签到'}
            </Button>
          </div>

          <Divider />

          <div className="action-item">
            <div className="action-icon redeem">
              <TicketIcon />
            </div>
            <div className="action-info">
              <h4>兑换码</h4>
              <p>使用兑换码获取额外云空间</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setRedeemDialogVisible(true)}
            >
              输入兑换码
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        header="配额明细"
        visible={quotaDetailsVisible}
        onClose={() => setQuotaDetailsVisible(false)}
        footer={null}
        width={480}
      >
        <List split>
          {cloudQuota?.segments.map((segment: QuotaSegment, index: number) => (
            <ListItem key={index}>
              <ListItemMeta
                title={getQuotaSourceText(segment.source)}
                description={
                  <div style={{ fontSize: '12px', color: 'var(--td-text-color-secondary)' }}>
                    <span>{formatExpiresAt(segment.expires_at)}</span>
                    {segment.note && <span style={{ marginLeft: 8 }}>({segment.note})</span>}
                  </div>
                }
              />
              <div style={{ fontWeight: 500 }}>
                {formatStorageSize(segment.size_kb)}
              </div>
            </ListItem>
          ))}
        </List>
      </Dialog>

      <Dialog
        header="兑换云空间"
        visible={redeemDialogVisible}
        onClose={() => {
          setRedeemDialogVisible(false);
          setRedeemCode('');
        }}
        onConfirm={handleRedeem}
        confirmBtn={{ loading: redeeming, content: '兑换' }}
      >
        <Form labelWidth={80} labelAlign="right">
          <FormItem label="兑换码" requiredMark>
            <Input
              value={redeemCode}
              onChange={(val) => { setRedeemCode(val as string); }}
              placeholder="请输入兑换码"
              onEnter={handleRedeem}
            />
          </FormItem>
        </Form>
        <div className="redeem-tips">
          <p>• 每个兑换码只能使用一次</p>
          <p>• 兑换获得的空间可能有有效期</p>
        </div>
      </Dialog>
    </div>
  );
}
