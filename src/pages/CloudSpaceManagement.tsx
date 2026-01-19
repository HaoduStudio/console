import { useState, useEffect, useCallback, useRef } from 'react';
import { useLogto } from '@logto/react';
import {
  Card,
  Table,
  Button,
  MessagePlugin,
  Dialog,
  Form,
  Input,
  InputNumber,
  Tag,
  Space,
  Tabs,
  Loading,
  DatePicker,
  DialogPlugin,
  Tooltip,
  Select,
  Row,
  Col,
} from 'tdesign-react';
import type { PrimaryTableCol } from 'tdesign-react';
import {
  RefreshIcon,
  AddIcon,
  DeleteIcon,
  EditIcon,
  GiftIcon,
  TicketIcon,
  SettingIcon,
} from 'tdesign-icons-react';
import {
  CloudSpaceApiService,
  type RoleQuotaConfig,
  type RedeemCode,
  type CreateRedeemCodeParams,
  formatStorageSize,
} from '../services/cloudSpaceApi';
import './CloudSpaceManagement.css';

const { FormItem } = Form;
const { TabPanel } = Tabs;
const { Option } = Select;

interface SizeInputProps {
  value: number; // in KB
  onChange: (value: number) => void;
}

const SizeInput = ({ value, onChange }: SizeInputProps) => {
  const [unit, setUnit] = useState<'MB' | 'GB'>(() => {
    if (value > 0 && value % (1024 * 1024) === 0) return 'GB';
    return 'MB';
  });
  
  const [numValue, setNumValue] = useState<number>(() => {
    if (value > 0 && value % (1024 * 1024) === 0) return value / (1024 * 1024);
    return Math.round((value / 1024) * 100) / 100;
  });

  useEffect(() => {
    const currentKb = unit === 'GB' ? numValue * 1024 * 1024 : numValue * 1024;
    if (Math.abs(currentKb - value) > 1) {
       if (value > 0 && value % (1024 * 1024) === 0) {
         setUnit('GB');
         setNumValue(value / (1024 * 1024));
       } else {
         setUnit('MB');
         setNumValue(Math.round((value / 1024) * 100) / 100);
       }
    }
  }, [value]);

  const handleNumChange = (v: number) => {
    setNumValue(v);
    const kb = unit === 'GB' ? v * 1024 * 1024 : v * 1024;
    onChange(kb);
  };

  const handleUnitChange = (u: 'MB' | 'GB') => {
    setUnit(u);
    const kb = u === 'GB' ? numValue * 1024 * 1024 : numValue * 1024;
    onChange(kb);
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <InputNumber
        value={numValue}
        onChange={(v) => handleNumChange(v as number)}
        min={0.1}
        step={1}
        style={{ flex: 1 }}
        placeholder="输入大小"
      />
      <Select 
        value={unit} 
        onChange={(v) => handleUnitChange(v as 'MB' | 'GB')}
        style={{ width: '80px' }}
      >
        <Option value="MB" label="MB" />
        <Option value="GB" label="GB" />
      </Select>
    </div>
  );
};

const getRoleText = (role: string): string => {
  const roleMap: Record<string, string> = {
    default: '默认用户',
    preview: '预览用户',
    vip: 'VIP用户',
    admin: '管理员',
  };
  return roleMap[role] || role;
};

const getRoleTheme = (role: string): 'default' | 'primary' | 'warning' | 'danger' => {
  const themeMap: Record<string, 'default' | 'primary' | 'warning' | 'danger'> = {
    default: 'default',
    preview: 'primary',
    vip: 'warning',
    admin: 'danger',
  };
  return themeMap[role] || 'default';
};

export function CloudSpaceManagement() {
  const { getAccessToken, isAuthenticated } = useLogto();
  const apiServiceRef = useRef<CloudSpaceApiService | null>(null);

  const [roleConfigs, setRoleConfigs] = useState<RoleQuotaConfig[]>([]);
  const [roleConfigLoading, setRoleConfigLoading] = useState(false);
  const [editRoleDialogVisible, setEditRoleDialogVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<string>('');
  const [editingRoleSizeKb, setEditingRoleSizeKb] = useState<number>(0);
  const [savingRole, setSavingRole] = useState(false);

  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([]);
  const [redeemCodesTotal, setRedeemCodesTotal] = useState(0);
  const [redeemCodesPage, setRedeemCodesPage] = useState(1);
  const [redeemCodesLoading, setRedeemCodesLoading] = useState(false);
  const [createCodeDialogVisible, setCreateCodeDialogVisible] = useState(false);
  const [creatingCode, setCreatingCode] = useState(false);
  
  const [newCode, setNewCode] = useState('');
  const [newCodeSpaceKb, setNewCodeSpaceKb] = useState<number>(10240);
  const [newCodeExpiresAt, setNewCodeExpiresAt] = useState<string>('');
  const [newCodeGrantValidDays, setNewCodeGrantValidDays] = useState<number>(30);
  const [newCodeMaxRedemptions, setNewCodeMaxRedemptions] = useState<number | undefined>(undefined);

  const [grantUserId, setGrantUserId] = useState('');
  const [grantSizeKb, setGrantSizeKb] = useState<number>(10240);
  const [grantExpiresAt, setGrantExpiresAt] = useState<string>('');
  const [grantNote, setGrantNote] = useState('');
  const [granting, setGranting] = useState(false);

  const PAGE_SIZE = 20;

  // 初始化 API 服务
  const initApiService = useCallback(async () => {
    if (isAuthenticated) {
      try {
        const token = await getAccessToken(import.meta.env.VITE_LOGTO_RESOURCES?.split(',')[0]);
        if (token) {
          apiServiceRef.current = new CloudSpaceApiService(token);
        }
      } catch (error) {
        console.error('获取 access token 失败:', error);
      }
    }
  }, [isAuthenticated, getAccessToken]);

  useEffect(() => {
    void initApiService();
  }, [initApiService]);

  const loadRoleConfigs = useCallback(async () => {
    if (!apiServiceRef.current) {
      await initApiService();
    }
    if (!apiServiceRef.current) return;

    setRoleConfigLoading(true);
    try {
      const configs = await apiServiceRef.current.getRoleQuotaConfigs();
      setRoleConfigs(configs);
    } catch (error) {
      console.error('加载角色配额配置失败:', error);
      MessagePlugin.error('加载角色配额配置失败');
    } finally {
      setRoleConfigLoading(false);
    }
  }, [initApiService]);

  const loadRedeemCodes = useCallback(async () => {
    if (!apiServiceRef.current) {
      await initApiService();
    }
    if (!apiServiceRef.current) return;

    setRedeemCodesLoading(true);
    try {
      const result = await apiServiceRef.current.getRedeemCodes({
        limit: PAGE_SIZE,
        offset: (redeemCodesPage - 1) * PAGE_SIZE,
      });
      setRedeemCodes(result.items || []);
      setRedeemCodesTotal(result.total || 0);
    } catch (error) {
      console.error('加载兑换码列表失败:', error);
      MessagePlugin.error('加载兑换码列表失败');
    } finally {
      setRedeemCodesLoading(false);
    }
  }, [initApiService, redeemCodesPage]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadRoleConfigs();
      void loadRedeemCodes();
    }
  }, [isAuthenticated, loadRoleConfigs, loadRedeemCodes]);

  const handleEditRoleConfig = (role: string, currentSizeKb: number) => {
    setEditingRole(role);
    setEditingRoleSizeKb(currentSizeKb);
    setEditRoleDialogVisible(true);
  };

  const handleSaveRoleConfig = async () => {
    if (!apiServiceRef.current) {
      MessagePlugin.error('服务未初始化');
      return;
    }

    setSavingRole(true);
    try {
      await apiServiceRef.current.setRoleQuotaConfig(editingRole, editingRoleSizeKb);
      MessagePlugin.success('保存成功');
      setEditRoleDialogVisible(false);
      await loadRoleConfigs();
    } catch (error) {
      console.error('保存角色配额失败:', error);
      MessagePlugin.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSavingRole(false);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode(code);
  };

  const handleCreateCode = async () => {
    if (!apiServiceRef.current) {
      MessagePlugin.error('服务未初始化');
      return;
    }

    if (!newCode.trim()) {
      MessagePlugin.warning('请输入兑换码');
      return;
    }

    setCreatingCode(true);
    try {
      const params: CreateRedeemCodeParams = {
        code: newCode.trim().toUpperCase(),
        space_kb: newCodeSpaceKb,
      };
      if (newCodeExpiresAt) {
        params.code_expires_at = newCodeExpiresAt;
      }
      if (newCodeGrantValidDays != null) {
        params.grant_valid_days = newCodeGrantValidDays;
      }
      if (newCodeMaxRedemptions !== undefined && newCodeMaxRedemptions > 0) {
        params.max_redemptions = newCodeMaxRedemptions;
      }

      await apiServiceRef.current.createRedeemCode(params);
      MessagePlugin.success('兑换码创建成功');
      setCreateCodeDialogVisible(false);
      resetCreateCodeForm();
      await loadRedeemCodes();
    } catch (error) {
      console.error('创建兑换码失败:', error);
      MessagePlugin.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setCreatingCode(false);
    }
  };

  const resetCreateCodeForm = () => {
    setNewCode('');
    setNewCodeSpaceKb(10240);
    setNewCodeExpiresAt('');
    setNewCodeGrantValidDays(30);
    setNewCodeMaxRedemptions(undefined);
  };

  const handleDeleteCode = (code: RedeemCode) => {
    const confirmDialog = DialogPlugin.confirm({
      header: '确认删除',
      body: `确定要删除兑换码 "${code.code}" 吗？`,
      confirmBtn: { theme: 'danger', content: '删除' },
      onConfirm: async () => {
        if (!apiServiceRef.current) {
          MessagePlugin.error('服务未初始化');
          confirmDialog.hide();
          return;
        }
        try {
          await apiServiceRef.current.deleteRedeemCode(code.id);
          MessagePlugin.success('删除成功');
          await loadRedeemCodes();
        } catch (error) {
          console.error('删除兑换码失败:', error);
          MessagePlugin.error(error instanceof Error ? error.message : '删除失败');
        }
        confirmDialog.hide();
      },
      onClose: () => {
        confirmDialog.hide();
      },
    });
  };

  const handleGrantUser = async () => {
    if (!apiServiceRef.current) {
      MessagePlugin.error('服务未初始化');
      return;
    }

    if (!grantUserId.trim()) {
      MessagePlugin.warning('请输入用户 ID');
      return;
    }

    setGranting(true);
    try {
      await apiServiceRef.current.grantUserQuota(grantUserId.trim(), {
        size_kb: grantSizeKb,
        expires_at: grantExpiresAt || undefined,
        note: grantNote.trim() || undefined,
      });
      MessagePlugin.success('赠送成功');
      resetGrantForm();
    } catch (error) {
      console.error('赠送配额失败:', error);
      MessagePlugin.error(error instanceof Error ? error.message : '赠送失败');
    } finally {
      setGranting(false);
    }
  };

  const resetGrantForm = () => {
    setGrantUserId('');
    setGrantSizeKb(10240);
    setGrantExpiresAt('');
    setGrantNote('');
  };

  const roleConfigColumns: PrimaryTableCol<RoleQuotaConfig>[] = [
    {
      colKey: 'role',
      title: '角色',
      cell: ({ row }) => (
        <Tag theme={getRoleTheme(row.role)} variant="light">
          {getRoleText(row.role)}
        </Tag>
      ),
    },
    {
      colKey: 'size_kb',
      title: '默认配额',
      cell: ({ row }) => formatStorageSize(row.size_kb),
    },
    {
      colKey: 'action',
      title: '操作',
      cell: ({ row }) => (
        <Button
          size="small"
          variant="text"
          icon={<EditIcon />}
          onClick={() => handleEditRoleConfig(row.role, row.size_kb)}
        >
          编辑
        </Button>
      ),
    },
  ];

  const redeemCodeColumns: PrimaryTableCol<RedeemCode>[] = [
    {
      colKey: 'code',
      title: '兑换码',
      cell: ({ row }) => (
        <Tooltip content="点击复制">
          <span
            className="code-text"
            role="button"
            tabIndex={0}
            onClick={() => {
              navigator.clipboard.writeText(row.code);
              MessagePlugin.success('已复制到剪贴板');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigator.clipboard.writeText(row.code);
                MessagePlugin.success('已复制到剪贴板');
              }
            }}
          >
            {row.code}
          </span>
        </Tooltip>
      ),
    },
    {
      colKey: 'space_kb',
      title: '空间大小',
      cell: ({ row }) => formatStorageSize(row.space_kb),
    },
    {
      colKey: 'code_expires_at',
      title: '兑换码过期时间',
      cell: ({ row }) => row.code_expires_at ? new Date(row.code_expires_at).toLocaleDateString('zh-CN') : '永不过期',
    },
    {
      colKey: 'usage',
      title: '使用情况',
      cell: ({ row }) => (
        <span>
          {row.redeemed_count} / {row.max_redemptions || '∞'}
        </span>
      ),
    },
    {
      colKey: 'is_active',
      title: '状态',
      cell: ({ row }) => (
        <Tag theme={row.is_active ? 'success' : 'default'} variant="light">
          {row.is_active ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      colKey: 'created_at',
      title: '创建时间',
      cell: ({ row }) => new Date(row.created_at).toLocaleString('zh-CN'),
    },
    {
      colKey: 'action',
      title: '操作',
      cell: ({ row }) => (
        <Space>
          <Button
            size="small"
            variant="text"
            theme="danger"
            icon={<DeleteIcon />}
            onClick={() => handleDeleteCode(row)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="cloud-space-management">
      <div className="page-header">
        <h1>云空间管理</h1>
      </div>

      <Tabs defaultValue="role-config">
        <TabPanel value="role-config" label="角色配额">
          <Row gutter={[24, 24]}>
            <Col xs={12} md={8}>
              <Card 
                bordered
                header={
                  <div className="section-header" style={{ marginBottom: 0 }}>
                    <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SettingIcon /> 角色默认配额
                    </h3>
                    <p className="section-desc" style={{ marginTop: '4px', marginBottom: 0 }}>
                      设置不同用户角色的默认云空间大小
                    </p>
                  </div>
                }
                actions={
                  <Button
                    variant="text"
                    icon={<RefreshIcon />}
                    onClick={loadRoleConfigs}
                    loading={roleConfigLoading}
                  >
                    刷新
                  </Button>
                }
              >
                <Loading loading={roleConfigLoading} showOverlay>
                  <Table
                    data={roleConfigs}
                    columns={roleConfigColumns}
                    rowKey="role"
                    bordered
                    hover
                    stripe
                  />
                </Loading>
              </Card>
            </Col>

            <Col xs={12} md={4}>
              <Card 
                bordered 
                header={
                  <div className="section-header" style={{ marginBottom: 0 }}>
                    <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <GiftIcon /> 临时赠送
                    </h3>
                    <p className="section-desc" style={{ marginTop: '4px', marginBottom: 0 }}>
                      向指定用户赠送额外的云空间配额
                    </p>
                  </div>
                }
              >
                <Form labelAlign="top" style={{ marginTop: '8px' }}>
                  <FormItem label="用户 ID" requiredMark>
                    <Input
                      value={grantUserId}
                      onChange={(val) => setGrantUserId(val as string)}
                      placeholder="请输入 Logto 用户 ID"
                      style={{ width: '100%' }}
                    />
                  </FormItem>
                  <FormItem label="空间大小" requiredMark>
                    <div style={{ width: '100%' }}>
                      <SizeInput
                        value={grantSizeKb}
                        onChange={setGrantSizeKb}
                      />
                      <p className="form-tip" style={{ marginTop: '4px' }}>
                        当前选择: {formatStorageSize(grantSizeKb)}
                      </p>
                    </div>
                  </FormItem>
                  <FormItem label="过期时间">
                    <DatePicker
                      value={grantExpiresAt}
                      onChange={(val) => setGrantExpiresAt(val as string)}
                      placeholder="不设置则永久有效"
                      clearable
                      style={{ width: '100%' }}
                    />
                  </FormItem>
                  <FormItem label="备注">
                    <Input
                      value={grantNote}
                      onChange={(val) => setGrantNote(val as string)}
                      placeholder="赠送原因（可选）"
                      style={{ width: '100%' }}
                    />
                  </FormItem>
                  <FormItem>
                    <Button 
                      theme="primary" 
                      onClick={handleGrantUser} 
                      loading={granting}
                      style={{ width: '100%' }}
                    >
                      确认赠送
                    </Button>
                  </FormItem>
                </Form>
              </Card>
            </Col>
          </Row>
        </TabPanel>

        <TabPanel value="redeem-codes" label="兑换码管理">
          <Card 
            bordered
            actions={
              <Space>
                <Button
                  theme="primary"
                  icon={<AddIcon />}
                  onClick={() => setCreateCodeDialogVisible(true)}
                >
                  创建兑换码
                </Button>
                <Button
                  variant="text"
                  icon={<RefreshIcon />}
                  onClick={loadRedeemCodes}
                  loading={redeemCodesLoading}
                >
                  刷新
                </Button>
              </Space>
            }
          >
            <div className="section-header">
              <h3><TicketIcon /> 兑换码列表</h3>
              <p className="section-desc">管理云空间兑换码</p>
            </div>

            <Loading loading={redeemCodesLoading} showOverlay>
              <Table
                data={redeemCodes}
                columns={redeemCodeColumns}
                rowKey="id"
                bordered
                hover
                stripe
                pagination={{
                  total: redeemCodesTotal,
                  current: redeemCodesPage,
                  pageSize: PAGE_SIZE,
                  onChange: (pageInfo) => setRedeemCodesPage(pageInfo.current),
                }}
              />
            </Loading>
          </Card>
        </TabPanel>
      </Tabs>

      <Dialog
        header={`编辑 ${getRoleText(editingRole)} 默认配额`}
        visible={editRoleDialogVisible}
        onClose={() => setEditRoleDialogVisible(false)}
        onConfirm={handleSaveRoleConfig}
        confirmBtn={{ loading: savingRole, content: '保存' }}
      >
        <Form labelWidth={100} labelAlign="right">
          <FormItem label="角色">
            <Tag theme={getRoleTheme(editingRole)} variant="light">
              {getRoleText(editingRole)}
            </Tag>
          </FormItem>
          <FormItem label="默认配额">
            <SizeInput 
              value={editingRoleSizeKb} 
              onChange={setEditingRoleSizeKb} 
            />
            <p className="form-tip">
              当前设置：{formatStorageSize(editingRoleSizeKb)}
            </p>
          </FormItem>
        </Form>
      </Dialog>

      <Dialog
        header="创建兑换码"
        visible={createCodeDialogVisible}
        onClose={() => {
          setCreateCodeDialogVisible(false);
          resetCreateCodeForm();
        }}
        onConfirm={handleCreateCode}
        confirmBtn={{ loading: creatingCode, content: '创建' }}
        width={500}
      >
        <Form labelWidth={120} labelAlign="right">
          <FormItem label="兑换码" requiredMark>
            <Space>
              <Input
                value={newCode}
                onChange={(val) => setNewCode((val as string).toUpperCase())}
                placeholder="输入或生成兑换码"
                style={{ width: '200px' }}
              />
              <Button variant="outline" onClick={generateRandomCode}>
                随机生成
              </Button>
            </Space>
          </FormItem>
          <FormItem label="空间大小" requiredMark>
            <SizeInput
              value={newCodeSpaceKb}
              onChange={setNewCodeSpaceKb}
            />
            <p className="form-tip">{formatStorageSize(newCodeSpaceKb)}</p>
          </FormItem>
          <FormItem label="兑换码过期时间">
            <DatePicker
              value={newCodeExpiresAt}
              onChange={(val) => setNewCodeExpiresAt(val as string)}
              placeholder="不设置则永不过期"
              clearable
              style={{ width: '100%' }}
            />
          </FormItem>
          <FormItem label="空间有效期">
            <InputNumber
              value={newCodeGrantValidDays}
              onChange={(val) => setNewCodeGrantValidDays(val as number)}
              suffix="天"
              min={1}
              style={{ width: '100%' }}
            />
            <p className="form-tip">兑换后获得的空间有效期</p>
          </FormItem>
          <FormItem label="最大兑换次数">
            <InputNumber
              value={newCodeMaxRedemptions}
              onChange={(val) => setNewCodeMaxRedemptions(val as number | undefined)}
              placeholder="不限制"
              min={1}
              style={{ width: '100%' }}
            />
            <p className="form-tip">留空表示不限制兑换次数</p>
          </FormItem>
        </Form>
      </Dialog>
    </div>
  );
}
