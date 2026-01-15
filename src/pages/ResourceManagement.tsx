import { useState, useEffect } from 'react';
import { Table, Card, Button, Dialog, Select, MessagePlugin, Space, Pagination, Loading, Tag, Textarea, DialogPlugin, Tooltip, Image } from 'tdesign-react';
import { CheckCircleFilledIcon, CloseCircleFilledIcon, DeleteIcon, InfoCircleIcon } from 'tdesign-icons-react';
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
  const [detailDialogVisible, setDetailDialogVisible] = useState(false);
  const [currentDetailResource, setCurrentDetailResource] = useState<CloudResource | null>(null);
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
      colKey: 'resource_name',
      title: '资源名称',
      width: '180px',
      cell: (params: any) => (
        <div className="resource-name-cell">
          <span className="resource-name-text" title={params.row.resource_name}>
            {params.row.resource_name}
          </span>
          {(params.row.resource_description || params.row.review_note) && (
            <Tooltip
              content={
                <div className="resource-tooltip-content">
                  {params.row.resource_description && (
                    <div>描述: {params.row.resource_description}</div>
                  )}
                  {params.row.review_note && (
                    <div>审核备注: {params.row.review_note}</div>
                  )}
                </div>
              }
            >
              <InfoCircleIcon className="info-icon" />
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      colKey: 'filename',
      title: '文件名',
      width: '150px',
      cell: (params: any) => (
        <span title={params.row.filename} className="filename-cell">
          {params.row.filename}
        </span>
      ),
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
      width: '260px',
      fixed: 'right' as const,
      cell: (params: any) => {
        return (
          <Space size="small">
            <Button
              size="small"
              variant="text"
              icon={<InfoCircleIcon />}
              onClick={() => handleOpenDetailDialog(params.row)}
            >
              详情
            </Button>
            {params.row.status === 'pending' && (
              <>
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
              </>
            )}
            <Button
              size="small"
              theme="danger"
              variant="text"
              icon={<DeleteIcon />}
              onClick={() => handleDelete(params.row)}
            >
              删除
            </Button>
          </Space>
        );
      },
    },
  ];

  // 打开详情弹窗
  const handleOpenDetailDialog = (resource: CloudResource) => {
    setCurrentDetailResource(resource);
    setDetailDialogVisible(true);
  };

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

      <Dialog
        visible={detailDialogVisible}
        header="资源详情"
        cancelBtn="关闭"
        confirmBtn={null}
        onClose={() => setDetailDialogVisible(false)}
        onCancel={() => setDetailDialogVisible(false)}
        width="600px"
      >
        {currentDetailResource && (
          <div className="detail-dialog-content">
            <div className="detail-image-wrapper">
              <Image
                src={currentDetailResource.url}
                fit="contain"
                style={{ maxWidth: '100%', maxHeight: '300px' }}
              />
            </div>
            <div className="detail-info">
              <div className="detail-item">
                <span className="detail-label">资源名称：</span>
                <span className="detail-value">{currentDetailResource.resource_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">文件名：</span>
                <span className="detail-value">{currentDetailResource.filename}</span>
              </div>
              {currentDetailResource.resource_description && (
                <div className="detail-item">
                  <span className="detail-label">资源描述：</span>
                  <span className="detail-value">{currentDetailResource.resource_description}</span>
                </div>
              )}
              {currentDetailResource.review_note && (
                <div className="detail-item highlight">
                  <span className="detail-label">审核备注：</span>
                  <span className="detail-value">{currentDetailResource.review_note}</span>
                </div>
              )}
              <div className="detail-item">
                <span className="detail-label">资源类型：</span>
                <span className="detail-value">
                  {CATEGORY_OPTIONS.find(o => o.value === currentDetailResource.category)?.label}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">审核状态：</span>
                <Tag
                  theme={STATUS_THEME[currentDetailResource.status] as any}
                  variant="light"
                >
                  {STATUS_OPTIONS.find(o => o.value === currentDetailResource.status)?.label}
                </Tag>
              </div>
              <div className="detail-item">
                <span className="detail-label">上传者：</span>
                <span className="detail-value">{currentDetailResource.user_id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">上传时间：</span>
                <span className="detail-value">
                  {new Date(currentDetailResource.created_at).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">文件大小：</span>
                <span className="detail-value">
                  {(() => {
                    const bytes = currentDetailResource.file_size;
                    if (bytes === 0) return '0 B';
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
                  })()}
                </span>
              </div>
              {currentDetailResource.reject_reason && (
                <div className="detail-item error">
                  <span className="detail-label">拒绝原因：</span>
                  <span className="detail-value">{currentDetailResource.reject_reason}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
