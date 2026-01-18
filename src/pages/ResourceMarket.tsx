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
  Dialog,
  Input,
  Textarea,
} from 'tdesign-react';
import { RefreshIcon, AddIcon, CheckIcon } from 'tdesign-icons-react';
import {
  CloudResourceApiService,
  type PublicResource,
  type ResourceCategory,
  CATEGORY_OPTIONS,
  getCategoryText,
  formatFileSize,
} from '../services/cloudResourceApi';
import './ResourceMarket.css';

const PAGE_SIZE = 20;

export function ResourceMarketPage() {
  const { getAccessToken, isAuthenticated } = useLogto();
  const [resources, setResources] = useState<PublicResource[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | ''>('');
  const [addDialogVisible, setAddDialogVisible] = useState(false);
  const [addTarget, setAddTarget] = useState<PublicResource | null>(null);
  const [addResourceName, setAddResourceName] = useState('');
  const [addResourceDescription, setAddResourceDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [addedResourceIds, setAddedResourceIds] = useState<Set<number>>(() => new Set());
  const apiServiceRef = useRef<CloudResourceApiService | null>(null);

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

  useEffect(() => {
    void initApiService();
  }, [initApiService]);

  const ensureApiService = useCallback(async () => {
    if (!apiServiceRef.current) {
      await initApiService();
    }
    return apiServiceRef.current;
  }, [initApiService]);

  const fetchAddedResourceIds = useCallback(async () => {
    if (!isAuthenticated) {
      setAddedResourceIds(new Set());
      return;
    }

    const service = await ensureApiService();
    if (!service) return;

    try {
      const result = await service.getAddedPublicResourceIds();
      setAddedResourceIds(new Set(result.resource_ids));
    } catch (error) {
      MessagePlugin.error(error instanceof Error ? error.message : '获取收藏状态失败');
    }
  }, [ensureApiService, isAuthenticated]);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const result = await CloudResourceApiService.getPublicResources({
        category: selectedCategory || undefined,
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
  }, [currentPage, selectedCategory]);

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

  useEffect(() => {
    void fetchAddedResourceIds();
  }, [fetchAddedResourceIds]);

  const handleCategoryChange = (value: unknown) => {
    setSelectedCategory(value as ResourceCategory | '');
    setCurrentPage(1);
  };

  const handlePageChange = (pageInfo: { current: number; pageSize: number }) => {
    setCurrentPage(pageInfo.current);
  };

  const handleRefresh = () => {
    fetchResources();
  };

  const handleImageClick = (resource: PublicResource) => {
    window.open(resource.url, '_blank');
  };

  const handleOpenAddDialog = (resource: PublicResource) => {
    if (!isAuthenticated) {
      MessagePlugin.warning('请先登录后再收藏');
      return;
    }
    if (addedResourceIds.has(resource.id)) {
      MessagePlugin.info('已收藏该资源');
      return;
    }
    setAddTarget(resource);
    setAddResourceName(resource.resource_name || '');
    setAddResourceDescription(resource.resource_description || '');
    setAddDialogVisible(true);
  };

  const handleAddToMyResources = async () => {
    if (!addTarget) return;
    if (!isAuthenticated) {
      MessagePlugin.warning('请先登录后再收藏');
      return;
    }

    if (addResourceName.length > 200) {
      MessagePlugin.warning('资源名称不能超过 200 个字符');
      return;
    }

    if (addResourceDescription && addResourceDescription.length > 2000) {
      MessagePlugin.warning('资源描述不能超过 2000 个字符');
      return;
    }

    const service = await ensureApiService();
    if (!service) {
      MessagePlugin.error('认证失败，请重新登录');
      return;
    }

    setAdding(true);
    try {
      await service.addPublicResourceToMyResources(addTarget.id, {
        resourceName: addResourceName.trim() || undefined,
        resourceDescription: addResourceDescription.trim() || undefined,
      });
      setAddedResourceIds((prev) => {
        const next = new Set(prev);
        next.add(addTarget.id);
        return next;
      });
      MessagePlugin.success('收藏成功');
      setAddDialogVisible(false);
    } catch (error) {
      MessagePlugin.error(error instanceof Error ? error.message : '收藏失败');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="resource-market-container">
      <div className="page-header">
        <h1>资源广场</h1>
        <p className="page-description">
          浏览社区公开分享的优质资源，表情、贴纸、模板、背景应有尽有!
        </p>
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
                style={{ width: 150 }}
                options={[
                  { value: '', label: '全部类型' },
                  ...CATEGORY_OPTIONS,
                ]}
              />
            </div>
          </div>
          <div className="filter-actions">
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
            description="暂无公开资源"
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
                  <div className="resource-image-wrapper" onClick={() => { handleImageClick(resource); }}>
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
                  </div>
                  <div className="resource-info">
                    <div className="resource-name" title={resource.resource_name}>
                      {resource.resource_name}
                    </div>
                    {resource.resource_description && (
                      <div className="resource-description" title={resource.resource_description}>
                        {resource.resource_description}
                      </div>
                    )}
                    <div className="resource-meta">
                      <Tag size="small" variant="light">
                        {getCategoryText(resource.category)}
                      </Tag>
                      <span className="resource-size">
                        {formatFileSize(resource.file_size)}
                      </span>
                    </div>
                    <div className="resource-actions">
                      {addedResourceIds.has(resource.id) ? (
                        <Button
                          size="small"
                          variant="base"
                          theme="success"
                          icon={<CheckIcon />}
                          disabled
                        >
                          已收藏
                        </Button>
                      ) : (
                      <Button
                        size="small"
                        variant="text"
                        theme="primary"
                        icon={<AddIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddDialog(resource);
                        }}
                      >
                        收藏
                      </Button>
                      )}
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
        header="收藏资源"
        visible={addDialogVisible}
        confirmBtn={{
          content: '收藏',
          loading: adding,
        }}
        cancelBtn="取消"
        onConfirm={handleAddToMyResources}
        onClose={() => { setAddDialogVisible(false); }}
        width="min(560px, calc(100vw - 32px))"
      >
        <div className="add-resource-dialog-content">
          <div className="add-resource-form-item">
            <label>资源名称</label>
            <Input
              value={addResourceName}
              onChange={(v) => { setAddResourceName(v as string); }}
              placeholder="留空则沿用原名称（1-200字符）"
              maxlength={200}
              style={{ width: '100%' }}
            />
          </div>

          <div className="add-resource-form-item">
            <label>资源描述</label>
            <Textarea
              value={addResourceDescription}
              onChange={(v) => { setAddResourceDescription(v as string); }}
              placeholder="留空则沿用原描述（最多 2000 字符）"
              maxlength={2000}
              autosize={{ minRows: 2, maxRows: 4 }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
