import { useState, useEffect } from 'react';
import { Table, Card, Button, Dialog, Select, MessagePlugin, Space, Pagination, Loading, Tag, Textarea, DialogPlugin } from 'tdesign-react';
import { CheckCircleFilledIcon, CloseCircleFilledIcon, DeleteIcon } from 'tdesign-icons-react';
import { useLogto } from '@logto/react';
import type { CloudResource, ResourceStatus } from '../services/cloudResourceApi';
import { CloudResourceApiService } from '../services/cloudResourceApi';
import { getApiResource } from '../config/logto';
import './ResourceManagement.css';

const CATEGORY_OPTIONS = [
  { label: '表情', value: 'emoji' },
  { label: '贴纸', value: 'sticker' },
  { label: '模板', value: 'template' },
  { label: '背景', value: 'background' },
];

const STATUS_OPTIONS = [
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
];

const STATUS_THEME: Record<string, string> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export const ResourceManagement = () => {
  const { getAccessToken } = useLogto();
  const [loading, setLoading] = useState(true);
  const [rejectDialogVisible, setRejectDialogVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [currentRejectResource, setCurrentRejectResource] = useState<CloudResource | null>(null);
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [service, setService] = useState<CloudResourceApiService | null>(null);

  // 初始化服务
  useEffect(() => {
    const initService = async () => {
      try {
        const accessToken = await getAccessToken(getApiResource());
        if (!accessToken) {
          throw new Error('未获取到访问令牌');
        }
        setService(new CloudResourceApiService(accessToken));
      } catch (error) {
        console.error('初始化服务失败:', error);
        MessagePlugin.error('初始化失败');
      }
    };

    initService();
  }, [getAccessToken]);

  // 加载数据
  const loadResources = async (page: number = 1, size: number = 10, status: string = 'pending') => {
    if (!service) return;

    try {
      setLoading(true);
      let response;
      
      if (status === 'pending') {
        response = await service.getPendingResources({
          limit: size,
          offset: (page - 1) * size,
        });
      } else {
        response = await service.getAllResources({
          status: status === 'all' ? undefined : status as ResourceStatus,
          limit: size,
          offset: (page - 1) * size,
        });
      }

      setResources(response.items);
      setTotal(response.total);
      setCurrent(page);
      setPageSize(size);
    } catch (error) {
      console.error('加载资源列表失败:', error);
      MessagePlugin.error('加载资源列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (service) {
      loadResources(1, 10, statusFilter);
    }
  }, [service]);

  // 审核通过
  const handleApprove = async (resource: CloudResource) => {
    if (!service) return;

    try {
      await service.approveResource(resource.id);
      MessagePlugin.success('资源已审核通过');
      loadResources(current, pageSize, statusFilter);
    } catch (error) {
      console.error('审核失败:', error);
      MessagePlugin.error('审核失败');
    }
  };

  const handleOpenRejectDialog = (resource: CloudResource) => {
    setCurrentRejectResource(resource);
    setRejectReason('');
    setRejectDialogVisible(true);
  };

  // 提交拒绝
  const handleSubmitReject = async () => {
    if (!service || !currentRejectResource) return;

    if (!rejectReason.trim()) {
      MessagePlugin.warning('请输入拒绝原因');
      return;
    }

    try {
      await service.rejectResource(currentRejectResource.id, rejectReason);
      MessagePlugin.success('资源已拒绝');
      setRejectDialogVisible(false);
      loadResources(current, pageSize, statusFilter);
    } catch (error) {
      console.error('拒绝失败:', error);
      MessagePlugin.error('拒绝失败');
    }
  };

  // 删除资源
  const handleDelete = (resource: CloudResource) => {
    if (!service) return;

    const confirmDialog = DialogPlugin.confirm({
      header: '确认删除',
      body: `确定要删除资源 "${resource.filename}" 吗？`,
      confirmBtn: { content: '删除', theme: 'danger' },
      cancelBtn: '取消',
      onConfirm: async () => {
        try {
          await service.adminDeleteResource(resource.id);
          MessagePlugin.success('资源已删除');
          confirmDialog.hide();
          loadResources(current, pageSize, statusFilter);
        } catch (error) {
          console.error('删除失败:', error);
          MessagePlugin.error('删除失败');
        }
      },
      onCancel: () => {
        confirmDialog.hide();
      },
      onClose: () => {
        confirmDialog.hide();
      },
    });
  };

  const columns = [
    {
      colKey: 'filename',
      title: '文件名',
      width: '150px',
    },
    {
      colKey: 'category',
      title: '分类',
      width: '80px',
      cell: (params: any) => {
        const option = CATEGORY_OPTIONS.find(o => o.value === params.row.category);
        return option?.label || params.row.category;
      },
    },
    {
      colKey: 'user_id',
      title: '上传者',
      width: '150px',
    },
    {
      colKey: 'status',
      title: '状态',
      width: '100px',
      cell: (params: any) => (
        <Tag
          theme={STATUS_THEME[params.row.status] as any}
          variant="light"
        >
          {STATUS_OPTIONS.find(o => o.value === params.row.status)?.label}
        </Tag>
      ),
    },
    {
      colKey: 'file_size',
      title: '文件大小',
      width: '100px',
      cell: (params: any) => {
        const bytes = params.row.file_size;
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return ((bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]);
      },
    },
    {
      colKey: 'created_at',
      title: '上传时间',
      width: '160px',
      cell: (params: any) => new Date(params.row.created_at).toLocaleString('zh-CN'),
    },
    {
      colKey: 'op',
      title: '操作',
      width: '200px',
      fixed: 'right' as const,
      cell: (params: any) => {
        if (params.row.status === 'pending') {
          return (
            <Space size="small">
              <Button
                size="small"
                theme="success"
                variant="text"
                icon={<CheckCircleFilledIcon />}
                onClick={() => handleApprove(params.row)}
              >
                通过
              </Button>
              <Button
                size="small"
                theme="danger"
                variant="text"
                icon={<CloseCircleFilledIcon />}
                onClick={() => handleOpenRejectDialog(params.row)}
              >
                拒绝
              </Button>
            </Space>
          );
        }
        return (
          <Button
            size="small"
            theme="danger"
            variant="text"
            icon={<DeleteIcon />}
            onClick={() => handleDelete(params.row)}
          >
            删除
          </Button>
        );
      },
    },
  ];

  return (
    <div className="resource-management">
      <Card title="资源管理" bordered>
        <div className="toolbar">
          <Select
            value={statusFilter}
            options={[
              { label: '待审核', value: 'pending' },
              { label: '已通过', value: 'approved' },
              { label: '已拒绝', value: 'rejected' },
              { label: '全部', value: 'all' },
            ]}
            onChange={(value) => {
              setStatusFilter(value as string);
              loadResources(1, pageSize, value as string);
            }}
            style={{ width: '150px' }}
          />
        </div>

        {loading ? (
          <div className="loading-container">
            <Loading />
          </div>
        ) : resources.length === 0 ? (
          <div className="empty-state">
            <p>暂无资源</p>
          </div>
        ) : (
          <>
            <Table
              data={resources}
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
                  loadResources(pageInfo.current, pageInfo.pageSize, statusFilter);
                }}
                onPageSizeChange={(size, pageInfo) => {
                  loadResources(pageInfo.current, size, statusFilter);
                }}
              />
            </div>
          </>
        )}
      </Card>

      <Dialog
        visible={rejectDialogVisible}
        header="拒绝资源"
        confirmBtn="确定"
        cancelBtn="取消"
        onConfirm={handleSubmitReject}
        onCancel={() => setRejectDialogVisible(false)}
        onClose={() => setRejectDialogVisible(false)}
      >
        <div className="reject-dialog-content">
          <p>请输入拒绝原因：</p>
          <Textarea
            value={rejectReason}
            onChange={(value) => setRejectReason(value as string)}
            placeholder="例如：图片质量不符合要求"
            rows={4}
          />
        </div>
      </Dialog>
    </div>
  );
};
