import { useState, useEffect, useCallback } from 'react';
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
} from 'tdesign-react';
import { RefreshIcon } from 'tdesign-icons-react';
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
  const [resources, setResources] = useState<PublicResource[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | ''>('');

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
    fetchResources();
  }, [fetchResources]);

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
    </div>
  );
}
