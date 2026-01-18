import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Dialog,
  Form,
  Input,
  Select,
  MessagePlugin,
  Space,
  Table,
  Tag,
  Textarea,
  Switch,
  InputNumber,
  Pagination,
  Loading,
  Checkbox,
  DialogPlugin,
  DatePicker,
} from 'tdesign-react';
import { PlusIcon, DeleteIcon, EditIcon, BrowseIcon } from 'tdesign-icons-react';
import { useLogto } from '@logto/react';
import type { Announcement, AnnouncementType, UserRoleType } from '../services/announcementApi';
import {
  AnnouncementApiService,
  ANNOUNCEMENT_TYPE_OPTIONS,
  ANNOUNCEMENT_TYPE_THEME,
  TARGET_ROLE_OPTIONS,
} from '../services/announcementApi';
import { getApiResource } from '../config/logto';
import './AnnouncementManagement.css';

const { FormItem } = Form;

interface AnnouncementFormData {
  title: string;
  content: string;
  announcement_type: AnnouncementType;
  target_roles: UserRoleType[];
  is_popup: boolean;
  require_confirm: boolean;
  is_active: boolean;
  priority: number;
  start_time: string;
  end_time: string;
}

export const AnnouncementManagement = () => {
  const { getAccessToken } = useLogto();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [statsDialogVisible, setStatsDialogVisible] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [currentStats, setCurrentStats] = useState<{ read_count: number; confirmed_count: number } | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [service, setService] = useState<AnnouncementApiService | null>(null);

  // 初始化服务
  useEffect(() => {
    const initService = async () => {
      try {
        const accessToken = await getAccessToken(getApiResource());
        if (!accessToken) {
          throw new Error('未获取到访问令牌');
        }
        setService(new AnnouncementApiService(accessToken));
      } catch (error) {
        console.error('初始化服务失败:', error);
        MessagePlugin.error('初始化失败');
      }
    };

    void initService();
  }, [getAccessToken]);

  // 加载数据
  const loadAnnouncements = useCallback(async (
    page: number = 1,
    size: number = 10,
    type?: string,
    active?: string
  ) => {
    if (!service) return;

    try {
      setLoading(true);
      const response = await service.listAnnouncements({
        limit: size,
        offset: (page - 1) * size,
        announcement_type: type === 'all' ? undefined : type as AnnouncementType,
        is_active: active === 'all' ? undefined : active === 'true',
      });

      setAnnouncements(response.items);
      setTotal(response.total);
      setCurrent(page);
      setPageSize(size);
    } catch (error) {
      console.error('加载公告列表失败:', error);
      MessagePlugin.error('加载公告列表失败');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (service) {
      void loadAnnouncements(1, 10, typeFilter, activeFilter);
    }
  }, [service, loadAnnouncements, typeFilter, activeFilter]);

  const handleOpenDialog = (announcement?: Announcement) => {
    setEditingAnnouncement(announcement || null);
    if (announcement) {
      form.setFieldsValue({
        title: announcement.title,
        content: announcement.content,
        announcement_type: announcement.announcement_type,
        target_roles: announcement.target_roles || [],
        is_popup: announcement.is_popup,
        require_confirm: announcement.require_confirm,
        is_active: announcement.is_active,
        priority: announcement.priority,
        start_time: announcement.start_time || '',
        end_time: announcement.end_time || '',
      });
    } else {
      form.reset();
      form.setFieldsValue({
        announcement_type: 'notice',
        target_roles: [],
        is_popup: false,
        require_confirm: false,
        is_active: true,
        priority: 0,
      });
    }
    setDialogVisible(true);
  };

  // 查看统计
  const handleViewStats = async (announcement: Announcement) => {
    if (!service) return;

    try {
      const stats = await service.getAnnouncementStats(announcement.id);
      setCurrentStats(stats);
      setEditingAnnouncement(announcement);
      setStatsDialogVisible(true);
    } catch (error) {
      console.error('获取统计失败:', error);
      MessagePlugin.error('获取统计失败');
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!service) return;

    try {
      const validateResult = await form.validate();
      if (validateResult !== true) {
        return;
      }
      
      const formData = form.getFieldsValue(true) as AnnouncementFormData;

      if (editingAnnouncement) {
        // 更新公告
        await service.updateAnnouncement(editingAnnouncement.id, {
          title: formData.title,
          content: formData.content,
          announcement_type: formData.announcement_type,
          target_roles: formData.target_roles.length > 0 ? formData.target_roles : null,
          is_popup: formData.is_popup,
          require_confirm: formData.require_confirm,
          is_active: formData.is_active,
          priority: formData.priority,
          start_time: formData.start_time || null,
          end_time: formData.end_time || null,
          clear_target_roles: formData.target_roles.length === 0,
          clear_start_time: !formData.start_time,
          clear_end_time: !formData.end_time,
        });
        MessagePlugin.success('公告已更新');
      } else {
        // 创建新公告
        await service.createAnnouncement({
          title: formData.title,
          content: formData.content,
          announcement_type: formData.announcement_type,
          target_roles: formData.target_roles.length > 0 ? formData.target_roles : undefined,
          is_popup: formData.is_popup,
          require_confirm: formData.require_confirm,
          priority: formData.priority,
          start_time: formData.start_time || undefined,
          end_time: formData.end_time || undefined,
        });
        MessagePlugin.success('公告已创建');
      }

      setDialogVisible(false);
      void loadAnnouncements(current, pageSize, typeFilter, activeFilter);
    } catch (error) {
      console.error('提交失败:', error);
      MessagePlugin.error('操作失败');
    }
  };

  // 切换激活状态
  const handleToggleActive = async (announcement: Announcement) => {
    if (!service) return;

    try {
      await service.updateAnnouncement(announcement.id, {
        is_active: !announcement.is_active,
      });
      MessagePlugin.success(announcement.is_active ? '公告已停用' : '公告已激活');
      loadAnnouncements(current, pageSize, typeFilter, activeFilter);
    } catch (error) {
      console.error('更新状态失败:', error);
      MessagePlugin.error('更新状态失败');
    }
  };

  // 删除公告
  const handleDelete = (announcement: Announcement) => {
    if (!service) return;

    const confirmDialog = DialogPlugin.confirm({
      header: '确认删除',
      body: `确定要删除公告 "${announcement.title}" 吗？此操作不可恢复。`,
      confirmBtn: { content: '删除', theme: 'danger' },
      onConfirm: async () => {
        try {
          await service.deleteAnnouncement(announcement.id);
          MessagePlugin.success('公告已删除');
          confirmDialog.hide();
          loadAnnouncements(current, pageSize, typeFilter, activeFilter);
        } catch (error) {
          console.error('删除失败:', error);
          MessagePlugin.error('删除失败');
        }
      },
    });
  };

  const columns = [
    {
      colKey: 'title',
      title: '标题',
      width: '200px',
      ellipsis: true,
    },
    {
      colKey: 'announcement_type',
      title: '类型',
      width: '100px',
      cell: ({ row }: { row: Announcement }) => (
        <Tag
          theme={ANNOUNCEMENT_TYPE_THEME[row.announcement_type] as 'primary' | 'warning' | 'danger' | 'default'}
          variant="light"
        >
          {ANNOUNCEMENT_TYPE_OPTIONS.find((o) => o.value === row.announcement_type)?.label}
        </Tag>
      ),
    },
    {
      colKey: 'target_roles',
      title: '目标用户组',
      width: '150px',
      cell: ({ row }: { row: Announcement }) => {
        if (!row.target_roles || row.target_roles.length === 0) {
          return <span style={{ color: '#999' }}>全部用户</span>;
        }
        return row.target_roles
          .map((role) => TARGET_ROLE_OPTIONS.find((o) => o.value === role)?.label)
          .join(', ');
      },
    },
    {
      colKey: 'is_popup',
      title: '弹窗',
      width: '60px',
      cell: ({ row }: { row: Announcement }) => (
        <span style={{ color: row.is_popup ? '#52c41a' : '#999' }}>
          {row.is_popup ? '是' : '否'}
        </span>
      ),
    },
    {
      colKey: 'require_confirm',
      title: '需确认',
      width: '70px',
      cell: ({ row }: { row: Announcement }) => (
        <span style={{ color: row.require_confirm ? '#fa8c16' : '#999' }}>
          {row.require_confirm ? '是' : '否'}
        </span>
      ),
    },
    {
      colKey: 'priority',
      title: '优先级',
      width: '70px',
    },
    {
      colKey: 'is_active',
      title: '状态',
      width: '80px',
      cell: ({ row }: { row: Announcement }) => (
        <Tag theme={row.is_active ? 'success' : 'default'} variant="light">
          {row.is_active ? '激活' : '停用'}
        </Tag>
      ),
    },
    {
      colKey: 'created_at',
      title: '创建时间',
      width: '160px',
      cell: ({ row }: { row: Announcement }) => new Date(row.created_at).toLocaleString('zh-CN'),
    },
    {
      colKey: 'op',
      title: '操作',
      width: '180px',
      fixed: 'right' as const,
      cell: ({ row }: { row: Announcement }) => (
        <Space size="small">
          <Button
            size="small"
            variant="text"
            icon={<BrowseIcon />}
            onClick={() => handleViewStats(row)}
          />
          <Button
            size="small"
            variant="text"
            icon={<EditIcon />}
            onClick={() => { handleOpenDialog(row); }}
          />
          <Button
            size="small"
            variant="text"
            theme={row.is_active ? 'warning' : 'success'}
            onClick={() => handleToggleActive(row)}
          >
            {row.is_active ? '停用' : '激活'}
          </Button>
          <Button
            size="small"
            variant="text"
            theme="danger"
            icon={<DeleteIcon />}
            onClick={() => { handleDelete(row); }}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="announcement-management">
      <Card title="公告管理" bordered>
        <div className="toolbar">
          <Space>
            <Select
              value={typeFilter}
              options={[
                { label: '全部类型', value: 'all' },
                ...ANNOUNCEMENT_TYPE_OPTIONS,
              ]}
              onChange={(value) => {
                setTypeFilter(value as string);
                void loadAnnouncements(1, pageSize, value as string, activeFilter);
              }}
              style={{ width: '130px' }}
            />
            <Select
              value={activeFilter}
              options={[
                { label: '全部状态', value: 'all' },
                { label: '已激活', value: 'true' },
                { label: '已停用', value: 'false' },
              ]}
              onChange={(value) => {
                setActiveFilter(value as string);
                void loadAnnouncements(1, pageSize, typeFilter, value as string);
              }}
              style={{ width: '120px' }}
            />
          </Space>
          <Button theme="primary" icon={<PlusIcon />} onClick={() => { handleOpenDialog(); }}>
            新增公告
          </Button>
        </div>

        {loading ? (
          <div className="loading-container">
            <Loading />
          </div>
        ) : announcements.length === 0 ? (
          <div className="empty-state">
            <p>暂无公告</p>
          </div>
        ) : (
          <>
            <Table
              data={announcements}
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
                  void loadAnnouncements(pageInfo.current, pageInfo.pageSize, typeFilter, activeFilter);
                }}
                onPageSizeChange={(size, pageInfo) => {
                  void loadAnnouncements(pageInfo.current, size, typeFilter, activeFilter);
                }}
              />
            </div>
          </>
        )}
      </Card>

      {/* 新增/编辑对话框 */}
      <Dialog
        visible={dialogVisible}
        header={editingAnnouncement ? '编辑公告' : '新增公告'}
        confirmBtn="保存"
        cancelBtn="取消"
        onConfirm={handleSubmit}
        onCancel={() => { setDialogVisible(false); }}
        onClose={() => { setDialogVisible(false); }}
        width={700}
      >
        <Form form={form} labelWidth={100} labelAlign="right">
          <FormItem label="标题" name="title" rules={[{ required: true, message: '标题必填' }]}>
            <Input placeholder="输入公告标题（最长200字符）" maxlength={200} />
          </FormItem>
          <FormItem label="内容" name="content" rules={[{ required: true, message: '内容必填' }]}>
            <Textarea placeholder="支持Markdown格式" rows={8} />
          </FormItem>
          <FormItem
            label="类型"
            name="announcement_type"
            rules={[{ required: true, message: '类型必填' }]}
          >
            <Select options={ANNOUNCEMENT_TYPE_OPTIONS} placeholder="选择公告类型" />
          </FormItem>
          <FormItem label="目标用户组" name="target_roles">
            <Checkbox.Group options={TARGET_ROLE_OPTIONS} />
          </FormItem>
          <FormItem label="优先级" name="priority" help="0-100，数值越大越优先显示">
            <InputNumber min={0} max={100} theme="normal" style={{ width: '150px' }} />
          </FormItem>
          <FormItem label="开始时间" name="start_time">
            <DatePicker
              mode="date"
              enableTimePicker
              format="YYYY-MM-DD HH:mm:ss"
              placeholder="留空则立即生效"
              style={{ width: '100%' }}
            />
          </FormItem>
          <FormItem label="结束时间" name="end_time">
            <DatePicker
              mode="date"
              enableTimePicker
              format="YYYY-MM-DD HH:mm:ss"
              placeholder="留空则永不过期"
              style={{ width: '100%' }}
            />
          </FormItem>
          <Space style={{ marginBottom: '16px' }}>
            <FormItem label="弹窗显示" name="is_popup" style={{ marginBottom: 0 }}>
              <Switch />
            </FormItem>
            <FormItem label="需要确认" name="require_confirm" style={{ marginBottom: 0 }}>
              <Switch />
            </FormItem>
            {editingAnnouncement && (
              <FormItem label="激活状态" name="is_active" style={{ marginBottom: 0 }}>
                <Switch />
              </FormItem>
            )}
          </Space>
        </Form>
      </Dialog>

      <Dialog
        visible={statsDialogVisible}
        header={`统计 - ${editingAnnouncement?.title || ''}`}
        footer={
          <Button theme="primary" onClick={() => { setStatsDialogVisible(false); }}>
            关闭
          </Button>
        }
        onClose={() => { setStatsDialogVisible(false); }}
        width={400}
      >
        {currentStats && (
          <div className="stats-content">
            <div className="stat-item">
              <span className="stat-label">已阅读人数：</span>
              <span className="stat-value">{currentStats.read_count}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">已确认人数：</span>
              <span className="stat-value">{currentStats.confirmed_count}</span>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
