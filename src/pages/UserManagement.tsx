import { useState, useEffect } from 'react';
import { Table, Card, Button, Form, Input, Select, MessagePlugin, Space, Pagination, Loading, Dialog, DialogPlugin, Textarea } from 'tdesign-react';
import { PlusIcon, DeleteIcon, EditIcon } from 'tdesign-icons-react';
import { useLogto } from '@logto/react';
import type { UserRole } from '../services/identityApi';
import { IdentityApiService } from '../services/identityApi';
import { getApiResource } from '../config/logto';
import './UserManagement.css';

const { FormItem } = Form;

const ROLE_OPTIONS = [
  { label: '默认用户', value: 'default' },
  { label: '预览用户', value: 'preview' },
  { label: 'VIP用户', value: 'vip' },
  { label: '管理员', value: 'admin' },
];

const ROLE_COLORS: Record<string, string> = {
  default: '#999999',
  preview: '#ff9800',
  vip: '#9c27b0',
  admin: '#f44336',
};

export const UserManagement = () => {
  const { getAccessToken } = useLogto();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRole | null>(null);
  const [users, setUsers] = useState<UserRole[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [service, setService] = useState<IdentityApiService | null>(null);

  // 初始化服务
  useEffect(() => {
    const initService = async () => {
      try {
        const accessToken = await getAccessToken(getApiResource());
        if (!accessToken) {
          throw new Error('未获取到访问令牌');
        }
        setService(new IdentityApiService(accessToken));
      } catch (error) {
        console.error('初始化服务失败:', error);
        MessagePlugin.error('初始化失败');
      }
    };

    initService();
  }, [getAccessToken]);

  // 加载数据
  const loadUsers = async (page: number = 1, size: number = 10) => {
    if (!service) return;

    try {
      setLoading(true);
      const response = await service.listUsers({
        limit: size,
        offset: (page - 1) * size,
      });

      setUsers(response.items);
      setTotal(response.total);
      setCurrent(page);
      setPageSize(size);
    } catch (error) {
      console.error('加载用户列表失败:', error);
      MessagePlugin.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (service) {
      loadUsers(1, 10);
    }
  }, [service]);

  const handleOpenDialog = (user?: UserRole) => {
    setEditingUser(user || null);
    if (user) {
      form.setFieldsValue({
        logto_user_id: user.logto_user_id,
        role: user.role,
        nickname: user.nickname || '',
        remark: user.remark || '',
      });
    } else {
      form.reset();
    }
    setDialogVisible(true);
  };


  const handleSubmit = async () => {
    if (!service) return;

    try {
      const validateResult = await form.validate();
      if (validateResult !== true) {
        return;
      }
      
      const formData = form.getFieldsValue(true) as {
        logto_user_id: string;
        role: string;
        nickname: string;
        remark: string;
      };
      
      if (editingUser) {
        // 更新用户
        await service.updateUserRole(editingUser.logto_user_id, {
          role: formData.role,
          nickname: formData.nickname,
          remark: formData.remark,
        });
        MessagePlugin.success('用户信息已更新');
      } else {
        // 创建新用户
        await service.setUserRole({
          logto_user_id: formData.logto_user_id,
          role: formData.role,
          nickname: formData.nickname,
          remark: formData.remark,
        });
        MessagePlugin.success('用户已创建');
      }

      setDialogVisible(false);
      loadUsers(current, pageSize);
    } catch (error) {
      console.error('提交失败:', error);
      MessagePlugin.error('操作失败');
    }
  };

  // 删除用户
  const handleDelete = (user: UserRole) => {
    if (!service) return;

    const confirmDialog = DialogPlugin.confirm({
      header: '确认删除',
      body: `确定要删除用户 ${user.nickname || user.logto_user_id} 吗？`,
      confirmBtn: { content: '删除', theme: 'danger' },
      onConfirm: async () => {
        try {
          await service.deleteUserRole(user.logto_user_id);
          MessagePlugin.success('用户已删除');
          confirmDialog.hide();
          loadUsers(current, pageSize);
        } catch (error) {
          console.error('删除失败:', error);
          MessagePlugin.error('删除失败');
        }
      },
    });
  };

  const columns = [
    {
      colKey: 'logto_user_id',
      title: '用户ID',
      width: '200px',
    },
    {
      colKey: 'nickname',
      title: '昵称',
      width: '120px',
      cell: (params: any) => params.row.nickname || '-',
    },
    {
      colKey: 'role',
      title: '角色',
      width: '100px',
      cell: (params: any) => {
        const roleOption = ROLE_OPTIONS.find(r => r.value === params.row.role);
        return (
          <span
            style={{
              color: ROLE_COLORS[params.row.role],
              fontWeight: 500,
            }}
          >
            {roleOption?.label || params.row.role}
          </span>
        );
      },
    },
    {
      colKey: 'remark',
      title: '备注',
      width: '200px',
      cell: (params: any) => params.row.remark || '-',
    },
    {
      colKey: 'created_at',
      title: '创建时间',
      width: '180px',
      cell: (params: any) => new Date(params.row.created_at).toLocaleString('zh-CN'),
    },
    {
      colKey: 'op',
      title: '操作',
      width: '120px',
      fixed: 'right' as const,
      cell: (params: any) => (
        <Space size="small">
          <Button
            size="small"
            variant="text"
            icon={<EditIcon />}
            onClick={() => handleOpenDialog(params.row)}
          />
          <Button
            size="small"
            variant="text"
            theme="danger"
            icon={<DeleteIcon />}
            onClick={() => handleDelete(params.row)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="user-management">
      <Card title="用户管理" bordered>
        <div className="toolbar">
          <Button
            theme="primary"
            icon={<PlusIcon />}
            onClick={() => handleOpenDialog()}
          >
            新增用户
          </Button>
        </div>

        {loading ? (
          <div className="loading-container">
            <Loading />
          </div>
        ) : (
          <>
            <Table
              data={users}
              columns={columns}
              rowKey="id"
              hover
              bordered
              stripe
              verticalAlign="middle"
            />
            <div className="pagination-container">
              <Pagination
                current={current}
                pageSize={pageSize}
                total={total}
                pageSizeOptions={[10, 20, 50]}
                onChange={(pageInfo) => {
                  loadUsers(pageInfo.current, pageInfo.pageSize);
                }}
                onPageSizeChange={(size, pageInfo) => {
                  loadUsers(pageInfo.current, size);
                }}
              />
            </div>
          </>
        )}
      </Card>

      <Dialog
        visible={dialogVisible}
        header={editingUser ? '编辑用户' : '新增用户'}
        confirmBtn="保存"
        cancelBtn="取消"
        onConfirm={handleSubmit}
        onCancel={() => setDialogVisible(false)}
        onClose={() => setDialogVisible(false)}
      >
        <Form form={form} labelWidth={100}>
          <FormItem
            label="用户ID"
            name="logto_user_id"
            rules={[{ required: true, message: '用户ID必填' }]}
          >
            <Input disabled={!!editingUser} placeholder="输入Logto用户ID" />
          </FormItem>
          <FormItem
            label="角色"
            name="role"
            rules={[{ required: true, message: '角色必填' }]}
          >
            <Select options={ROLE_OPTIONS} placeholder="选择角色" />
          </FormItem>
          <FormItem label="昵称" name="nickname">
            <Input placeholder="输入用户昵称" />
          </FormItem>
          <FormItem label="备注" name="remark">
            <Textarea placeholder="输入备注信息" rows={3} />
          </FormItem>
        </Form>
      </Dialog>
    </div>
  );
};
