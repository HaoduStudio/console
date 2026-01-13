import { useState, useEffect, useCallback, useRef } from 'react';
import { useLogto } from '@logto/react';
import {
  Card,
  Image,
  Pagination,
  Select,
  Tag,
  Loading,
  Empty,
  Button,
  MessagePlugin,
  Upload,
  Dialog,
  Checkbox,
  DialogPlugin,
} from 'tdesign-react';
import type { UploadFile, UploadProps } from 'tdesign-react';
import {
  RefreshIcon,
  AddIcon,
  DeleteIcon,
  BrowseIcon,
  BrowseOffIcon,
} from 'tdesign-icons-react';
import {
  CloudResourceApiService,
  type CloudResource,
  type ResourceCategory,
  type ResourceStatus,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  getCategoryText,
  getStatusText,
  getStatusTheme,
  formatFileSize,
} from '../services/cloudResourceApi';
import './MyResources.css';

const PAGE_SIZE = 20;

// 支持的文件类型
const ACCEPT_FILE_TYPES = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';

// 移动端断点
const MOBILE_BREAKPOINT = 768;

export function MyResourcesPage() {
  const { getAccessToken, isAuthenticated } = useLogto();
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<ResourceStatus | ''>('');
  const [uploadDialogVisible, setUploadDialogVisible] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<ResourceCategory>('emoji');
  const [uploadIsPublic, setUploadIsPublic] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const apiServiceRef = useRef<CloudResourceApiService | null>(null);

  // 初始化 API 服务
  const initApiService = useCallback(async () => {
    if (isAuthenticated) {
      try {
        const token = await getAccessToken(import.meta.env.VITE_LOGTO_RESOURCES?.split(',')[0]);
        if (token) {
          apiServiceRef.current = new CloudResourceApiService(token);
        }
      } catch (error) {
        console.error('获取 access token 失败:', error);
      }
    }
  }, [isAuthenticated, getAccessToken]);

  // 检测屏幕宽度
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    initApiService();
  }, [initApiService]);

  const fetchResources = useCallback(async () => {
    if (!apiServiceRef.current) {
      await initApiService();
    }
    if (!apiServiceRef.current) return;

    setLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const result = await apiServiceRef.current.getMyResources({
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setResources(result.items);
      setTotal(result.total);
    } catch (error) {
      MessagePlugin.error(error instanceof Error ? error.message : '加载资源失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedCategory, selectedStatus, initApiService]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchResources();
    }
  }, [isAuthenticated, fetchResources]);

  const handleCategoryChange = (value: unknown) => {
    setSelectedCategory(value as ResourceCategory | '');
    setCurrentPage(1);
  };

  const handleStatusChange = (value: unknown) => {
    setSelectedStatus(value as ResourceStatus | '');
    setCurrentPage(1);
  };

  const handlePageChange = (pageInfo: { current: number; pageSize: number }) => {
    setCurrentPage(pageInfo.current);
  };

  const handleRefresh = () => {
    fetchResources();
  };

  const handleImageClick = (resource: CloudResource) => {
    window.open(resource.url, '_blank');
  };

  // 打开上传对话框
  const handleOpenUploadDialog = () => {
    setUploadFiles([]);
    setUploadCategory('emoji');
    setUploadIsPublic(false);
    setUploadDialogVisible(true);
  };

  // 处理上传
  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      MessagePlugin.warning('请选择要上传的文件');
      return;
    }

    if (!apiServiceRef.current) {
      await initApiService();
    }
    if (!apiServiceRef.current) {
      MessagePlugin.error('认证失败，请重新登录');
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const uploadFile of uploadFiles) {
        if (uploadFile.raw) {
          try {
            await apiServiceRef.current.uploadResource(
              uploadCategory,
              uploadFile.raw,
              uploadIsPublic
            );
            successCount++;
          } catch (error) {
            failCount++;
            console.error('上传文件失败:', uploadFile.name, error);
          }
        }
      }

      if (successCount > 0) {
        MessagePlugin.success(`成功上传 ${successCount} 个文件${failCount > 0 ? `，${failCount} 个失败` : ''}`);
        setUploadDialogVisible(false);
        fetchResources();
      } else {
        MessagePlugin.error('所有文件上传失败');
      }
    } catch (error) {
      MessagePlugin.error(error instanceof Error ? error.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  // 处理文件选择变化
  const handleUploadChange: UploadProps['onChange'] = (files) => {
    setUploadFiles(files);
  };

  // 切换资源公开状态
  const handleToggleVisibility = async (resource: CloudResource) => {
    if (resource.status !== 'approved') {
      MessagePlugin.warning('只有审核通过的资源才能设置公开状态');
      return;
    }

    if (!apiServiceRef.current) {
      await initApiService();
    }
    if (!apiServiceRef.current) {
      MessagePlugin.error('认证失败，请重新登录');
      return;
    }

    try {
      const newIsPublic = !resource.is_public;
      await apiServiceRef.current.setResourceVisibility(resource.id, newIsPublic);
      MessagePlugin.success(newIsPublic ? '资源已公开到资源广场' : '资源已设为私密');
      fetchResources();
    } catch (error) {
      MessagePlugin.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  // 删除资源
  const handleDelete = (resource: CloudResource) => {
    const confirmDialog = DialogPlugin.confirm({
      header: '确认删除',
      body: `确定要删除资源 "${resource.filename}" 吗？此操作不可恢复。`,
      confirmBtn: { theme: 'danger', content: '删除' },
      onConfirm: async () => {
        if (!apiServiceRef.current) {
          await initApiService();
        }
        if (!apiServiceRef.current) {
          MessagePlugin.error('认证失败，请重新登录');
          confirmDialog.hide();
          return;
        }

        try {
          await apiServiceRef.current.deleteMyResource(resource.id);
          MessagePlugin.success('删除成功');
          fetchResources();
        } catch (error) {
          MessagePlugin.error(error instanceof Error ? error.message : '删除失败');
        }
        confirmDialog.hide();
      },
      onClose: () => {
        confirmDialog.hide();
      },
    });
  };

  return (
    <div className="my-resources-container">
      <div className="page-header">
        <h1>我的资源</h1>
      </div>

      <Card className="filter-card">
        <div className="filter-bar">
          <div className="filter-group">
            <div className="filter-item">
              <span className="filter-label">资源类型：</span>
              <Select
                value={selectedCategory}
                onChange={handleCategoryChange}
                placeholder="全部类型"
                clearable
                style={{ width: 120 }}
                options={[
                  { value: '', label: '全部类型' },
                  ...CATEGORY_OPTIONS,
                ]}
              />
            </div>
            <div className="filter-item">
              <span className="filter-label">审核状态：</span>
              <Select
                value={selectedStatus}
                onChange={handleStatusChange}
                placeholder="全部状态"
                clearable
                style={{ width: 120 }}
                options={[
                  { value: '', label: '全部状态' },
                  ...STATUS_OPTIONS,
                ]}
              />
            </div>
          </div>
          <div className="filter-actions">
            <Button
              theme="primary"
              icon={<AddIcon />}
              onClick={handleOpenUploadDialog}
            >
              上传资源
            </Button>
            <Button
              variant="outline"
              icon={<RefreshIcon />}
              onClick={handleRefresh}
            >
              刷新
            </Button>
          </div>
        </div>
      </Card>

      <Loading loading={loading} showOverlay>
        {resources.length === 0 && !loading ? (
          <Empty
            description="暂无资源"
            action={
              <Button theme="primary" onClick={handleOpenUploadDialog}>
                上传第一个资源
              </Button>
            }
          />
        ) : (
          <>
            <div className="resource-grid">
              {resources.map((resource) => (
                <Card
                  key={resource.id}
                  className="resource-card"
                  hoverShadow
                >
                  <div className="resource-image-wrapper" onClick={() => handleImageClick(resource)}>
                    {resource.url ? (
                      <Image
                        src={resource.url}
                        fit="cover"
                        position="center"
                        lazy
                        style={{ width: '100%', height: '100%' }}
                        loading={<Loading size="small" />}
                        error={
                          <div className="image-error">
                            加载失败
                          </div>
                        }
                      />
                    ) : (
                      <div className="image-error">
                        暂无图片
                      </div>
                    )}
                    <div className="resource-status-badge">
                      <Tag
                        size="small"
                        theme={getStatusTheme(resource.status)}
                        variant="dark"
                      >
                        {getStatusText(resource.status)}
                      </Tag>
                    </div>
                  </div>
                  <div className="resource-info">
                    <div className="resource-filename" title={resource.filename}>
                      {resource.filename}
                    </div>
                    <div className="resource-meta">
                      <Tag size="small" variant="light">
                        {getCategoryText(resource.category)}
                      </Tag>
                      <span className="resource-size">
                        {formatFileSize(resource.file_size)}
                      </span>
                    </div>
                    {resource.status === 'rejected' && resource.reject_reason && (
                      <div className="reject-reason" title={resource.reject_reason}>
                        拒绝原因: {resource.reject_reason}
                      </div>
                    )}
                    <div className="resource-actions">
                      <Button
                        size="small"
                        variant="text"
                        icon={resource.is_public ? <BrowseIcon /> : <BrowseOffIcon />}
                        onClick={() => handleToggleVisibility(resource)}
                        disabled={resource.status !== 'approved'}
                        title={resource.status !== 'approved' ? '只有审核通过的资源才能公开' : (resource.is_public ? '点击设为私密' : '点击公开到资源广场')}
                      >
                        {resource.is_public ? '公开' : '私密'}
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        theme="danger"
                        icon={<DeleteIcon />}
                        onClick={() => handleDelete(resource)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {total > PAGE_SIZE && (
              <div className="pagination-wrapper">
                <Pagination
                  total={total}
                  current={currentPage}
                  pageSize={PAGE_SIZE}
                  onChange={handlePageChange}
                  showJumper
                  showPageSize={false}
                />
              </div>
            )}
          </>
        )}
      </Loading>

      <Dialog
        header="上传资源"
        visible={uploadDialogVisible}
        confirmBtn={{
          content: '上传',
          loading: uploading,
        }}
        cancelBtn="取消"
        onConfirm={handleUpload}
        onClose={() => setUploadDialogVisible(false)}
        width="min(600px, calc(100vw - 32px))"
      >
        <div className="upload-dialog-content">
          <div className="upload-form-item">
            <label>资源类型</label>
            <Select
              value={uploadCategory}
              onChange={(v) => setUploadCategory(v as ResourceCategory)}
              style={{ width: '100%' }}
              options={CATEGORY_OPTIONS}
            />
          </div>
          
          <div className="upload-form-item">
            <label>选择文件</label>
            <Upload
              files={uploadFiles}
              onChange={handleUploadChange}
              theme={isMobile ? 'file' : 'image-flow'}
              accept={ACCEPT_FILE_TYPES}
              multiple
              autoUpload={false}
              max={10}
              sizeLimit={{ size: 10, unit: 'MB', message: '文件大小不能超过 10MB' }}
              tips="支持 PNG、JPG、GIF、WebP、SVG 格式，单个文件不超过 10MB，最多上传 10 个文件"
              requestMethod={() => Promise.resolve({ status: 'success', response: {} })}
            />
          </div>

          <div className="upload-form-item checkbox-item">
            <Checkbox
              checked={uploadIsPublic}
              onChange={(checked) => setUploadIsPublic(checked as boolean)}
            >
              审核通过后公开到资源广场
            </Checkbox>
            <p className="form-tip">
              勾选后，资源在审核通过后将自动公开到资源广场供所有用户浏览使用
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
