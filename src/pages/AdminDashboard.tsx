import { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Loading, MessagePlugin } from 'tdesign-react';
import { useLogto } from '@logto/react';
import type { UserRoleStats } from '../services/identityApi';
import { IdentityApiService } from '../services/identityApi';
import type { CloudResourceStats } from '../services/cloudResourceApi';
import { CloudResourceApiService } from '../services/cloudResourceApi';
import { getApiResource } from '../config/logto';
import './AdminDashboard.css';

export const AdminDashboard = () => {
  const { getAccessToken } = useLogto();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    users: UserRoleStats | null;
    resources: CloudResourceStats | null;
  }>({
    users: null,
    resources: null,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const accessToken = await getAccessToken(getApiResource());
        
        if (!accessToken) {
          throw new Error('未获取到访问令牌');
        }
        
        const identityService = new IdentityApiService(accessToken);
        const resourceService = new CloudResourceApiService(accessToken);

        const [userStats, resourceStats] = await Promise.all([
          identityService.getUserStats(),
          resourceService.getResourceStats(),
        ]);

        setStats({
          users: userStats,
          resources: resourceStats,
        });
      } catch (error) {
        console.error('加载统计数据失败:', error);
        MessagePlugin.error('加载数据失败，请刷新重试');
      } finally {
        setLoading(false);
      }
    };

    void loadStats();
  }, [getAccessToken]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <Loading />
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <h1>仪表盘</h1>
      
      {/* 用户统计卡片 */}
      <Card title="用户统计" className="stats-card" bordered>
        <Row gutter={24}>
          <Col xs={12} sm={6} md={4}>
            <Statistic
              title="总用户数"
              value={stats.users?.total || 0}
              color="blue"
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Statistic
              title="默认用户"
              value={stats.users?.default || 0}
              color="gray"
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Statistic
              title="预览用户"
              value={stats.users?.preview || 0}
              color="orange"
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Statistic
              title="VIP用户"
              value={stats.users?.vip || 0}
              color="purple"
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Statistic
              title="管理员"
              value={stats.users?.admin || 0}
              color="red"
            />
          </Col>
        </Row>
      </Card>

      {/* 资源统计卡片 */}
      <Card title="资源统计" className="stats-card" bordered>
        <Row gutter={24}>
          <Col xs={12} sm={6} md={6}>
            <Statistic
              title="总资源数"
              value={stats.resources?.total || 0}
              color="blue"
            />
          </Col>
          <Col xs={12} sm={6} md={6}>
            <Statistic
              title="待审核"
              value={stats.resources?.pending || 0}
              trend={stats.resources?.pending ? 'increase' : undefined}
              color="orange"
            />
          </Col>
          <Col xs={12} sm={6} md={6}>
            <Statistic
              title="已通过"
              value={stats.resources?.approved || 0}
              color="green"
            />
          </Col>
          <Col xs={12} sm={6} md={6}>
            <Statistic
              title="已拒绝"
              value={stats.resources?.rejected || 0}
              color="red"
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
};
