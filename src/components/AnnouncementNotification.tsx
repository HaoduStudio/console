import { useState, useEffect, useCallback } from 'react';
import {
  Popup,
  Button,
  Dialog,
  Badge,
  Tag,
  Empty,
  Loading,
  MessagePlugin,
} from 'tdesign-react';
import { NotificationIcon, CheckCircleIcon } from 'tdesign-icons-react';
import { useLogto } from '@logto/react';
import type { UserAnnouncement, UnreadAnnouncementsResponse } from '../services/announcementApi';
import { AnnouncementApiService, ANNOUNCEMENT_TYPE_OPTIONS, ANNOUNCEMENT_TYPE_THEME } from '../services/announcementApi';
import { getApiResource } from '../config/logto';
import './AnnouncementNotification.css';

// 简单的 Markdown 转 HTML 函数
const formatMarkdown = (text: string): string => {
  return text
    // 转义 HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 标题
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 粗体和斜体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 代码块
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // 无序列表
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // 换行
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    // 包装段落
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<h') || match.startsWith('<li') || match.startsWith('<p') || match.startsWith('</p')) {
        return match;
      }
      return match;
    });
};

interface AnnouncementNotificationProps {
  onAnnouncementCheck?: (hasUnread: boolean) => void;
}

export const AnnouncementNotification = ({ onAnnouncementCheck }: AnnouncementNotificationProps) => {
  const { getAccessToken, isAuthenticated } = useLogto();
  const [popupVisible, setPopupVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<UserAnnouncement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [service, setService] = useState<AnnouncementApiService | null>(null);
  
  // 弹窗公告相关
  const [popupAnnouncements, setPopupAnnouncements] = useState<UserAnnouncement[]>([]);
  const [currentPopupIndex, setCurrentPopupIndex] = useState(0);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  
  // 详情弹窗
  const [detailDialogVisible, setDetailDialogVisible] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<UserAnnouncement | null>(null);

  // 初始化服务
  useEffect(() => {
    const initService = async () => {
      if (!isAuthenticated) return;
      
      try {
        const accessToken = await getAccessToken(getApiResource());
        if (accessToken) {
          setService(new AnnouncementApiService(accessToken));
        }
      } catch (error) {
        console.error('初始化公告服务失败:', error);
      }
    };

    initService();
  }, [getAccessToken, isAuthenticated]);

  // 加载所有公告（首次加载）
  const loadAnnouncements = useCallback(async (triggerPopup: boolean = true) => {
    if (!service) return;

    try {
      setLoading(true);
      const response: UnreadAnnouncementsResponse = await service.getActiveAnnouncements();
      
      setAnnouncements(response.items);
      // 计算未读数量
      const unread = response.items.filter(item => !item.is_read).length;
      setUnreadCount(unread);
      onAnnouncementCheck?.(unread > 0);

      // 只在首次加载时处理弹窗公告，避免循环弹窗
      if (triggerPopup) {
        const unreadPopups = response.items.filter(item => !item.is_read && item.is_popup);
        if (unreadPopups.length > 0) {
          setPopupAnnouncements(unreadPopups);
          setCurrentPopupIndex(0);
          setShowAnnouncementDialog(true);
        }
      }
    } catch (error) {
      console.error('加载公告失败:', error);
    } finally {
      setLoading(false);
    }
  }, [service, onAnnouncementCheck]);

  // 服务初始化后加载公告
  useEffect(() => {
    if (service) {
      loadAnnouncements(true);
    }
  }, [service, loadAnnouncements]);

  // 标记公告已读
  const markAsRead = async (announcement: UserAnnouncement, confirmed: boolean = false) => {
    if (!service) return;

    try {
      await service.markAsRead(announcement.id, confirmed);
      // 直接更新本地状态，将该公告标记为已读
      setAnnouncements(prev => 
        prev.map(item => 
          item.id === announcement.id ? { ...item, is_read: true } : item
        )
      );
      // 重新计算未读数量
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('标记已读失败:', error);
      MessagePlugin.error('操作失败');
    }
  };

  // 处理弹窗公告的确认/关闭
  const handlePopupAnnouncementAction = async (confirmed: boolean) => {
    const currentAnnouncement = popupAnnouncements[currentPopupIndex];
    if (!currentAnnouncement) return;

    // 如果需要确认但用户没有确认，不允许关闭
    if (currentAnnouncement.require_confirm && !confirmed) {
      MessagePlugin.warning('此公告需要您确认已读后才能关闭');
      return;
    }

    await markAsRead(currentAnnouncement, confirmed);

    // 显示下一个弹窗公告
    if (currentPopupIndex < popupAnnouncements.length - 1) {
      setCurrentPopupIndex(prev => prev + 1);
    } else {
      setShowAnnouncementDialog(false);
      setPopupAnnouncements([]);
      setCurrentPopupIndex(0);
    }
  };

  // 查看公告详情
  const handleViewDetail = (announcement: UserAnnouncement) => {
    setSelectedAnnouncement(announcement);
    setDetailDialogVisible(true);
    setPopupVisible(false);
  };

  // 在详情中标记已读
  const handleMarkReadInDetail = async () => {
    if (!selectedAnnouncement) return;
    
    await markAsRead(selectedAnnouncement, selectedAnnouncement.require_confirm);
    setDetailDialogVisible(false);
    setSelectedAnnouncement(null);
  };

  // 获取公告类型标签
  const getTypeTag = (type: string) => {
    const option = ANNOUNCEMENT_TYPE_OPTIONS.find(o => o.value === type);
    const theme = ANNOUNCEMENT_TYPE_THEME[type as keyof typeof ANNOUNCEMENT_TYPE_THEME] || 'default';
    return (
      <Tag size="small" theme={theme as 'primary' | 'warning' | 'danger' | 'default'} variant="light">
        {option?.label || type}
      </Tag>
    );
  };

  // 当前弹窗公告
  const currentPopupAnnouncement = popupAnnouncements[currentPopupIndex];

  return (
    <>
      {/* 通知铃铛按钮 */}
      <Popup
        visible={popupVisible}
        onVisibleChange={setPopupVisible}
        trigger="click"
        placement="bottom-right"
        showArrow
        content={
          <div className="announcement-popup">
            <div className="announcement-popup-header">
              <span className="popup-title">公告通知</span>
              <span className="unread-count">
                {announcements.length > 0 && `共 ${announcements.length} 条`}
                {unreadCount > 0 && ` / ${unreadCount} 条未读`}
              </span>
            </div>
            <div className="announcement-popup-content">
              {loading ? (
                <div className="popup-loading">
                  <Loading />
                </div>
              ) : announcements.length === 0 ? (
                <Empty description="暂无公告" />
              ) : (
                <div className="announcement-list">
                  {announcements.map((item) => (
                    <div
                      key={item.id}
                      className="announcement-item"
                      data-read={item.is_read}
                      onClick={() => handleViewDetail(item)}
                    >
                      <div className="announcement-item-content">
                        <div className="announcement-item-header">
                          {getTypeTag(item.announcement_type)}
                          {item.require_confirm && (
                            <Tag size="small" theme="warning" variant="outline">
                              需确认
                            </Tag>
                          )}
                          {item.is_read ? (
                            <Tag size="small" theme="default" variant="outline">
                              已读
                            </Tag>
                          ) : (
                            <Tag size="small" theme="primary" variant="light-outline">
                              未读
                            </Tag>
                          )}
                        </div>
                        <div className="announcement-item-title">{item.title}</div>
                        <div className="announcement-item-time">
                          {new Date(item.created_at).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {announcements.length > 0 && (
              <div className="announcement-popup-footer">
                <Button
                  variant="text"
                  theme="primary"
                  size="small"
                  onClick={() => {
                    setPopupVisible(false);
                    // 可以导航到公告列表页面
                  }}
                >
                  查看全部
                </Button>
              </div>
            )}
          </div>
        }
      >
        <Badge count={unreadCount} showZero={false} offset={[-5, 5]}>
          <Button shape="square" variant="text" icon={<NotificationIcon />} />
        </Badge>
      </Popup>

      {/* 弹窗公告对话框 */}
      {currentPopupAnnouncement && (
        <Dialog
          visible={showAnnouncementDialog}
          header={
            <div className="announcement-dialog-header">
              {getTypeTag(currentPopupAnnouncement.announcement_type)}
              <span className="dialog-title">{currentPopupAnnouncement.title}</span>
            </div>
          }
          footer={
            <div className="announcement-dialog-footer">
              {popupAnnouncements.length > 1 && (
                <span className="dialog-progress">
                  {currentPopupIndex + 1} / {popupAnnouncements.length}
                </span>
              )}
              <div className="dialog-actions">
                {!currentPopupAnnouncement.require_confirm && (
                  <Button
                    variant="outline"
                    onClick={() => handlePopupAnnouncementAction(false)}
                  >
                    稍后再看
                  </Button>
                )}
                <Button
                  theme="primary"
                  icon={<CheckCircleIcon />}
                  onClick={() => handlePopupAnnouncementAction(true)}
                >
                  {currentPopupAnnouncement.require_confirm ? '我已阅读并确认' : '已读'}
                </Button>
              </div>
            </div>
          }
          onClose={() => {
            if (!currentPopupAnnouncement.require_confirm) {
              setShowAnnouncementDialog(false);
            } else {
              MessagePlugin.warning('此公告需要您确认已读后才能关闭');
            }
          }}
          closeOnOverlayClick={!currentPopupAnnouncement.require_confirm}
          closeOnEscKeydown={!currentPopupAnnouncement.require_confirm}
          width={600}
        >
          <div className="announcement-dialog-content">
            <div className="markdown-content" dangerouslySetInnerHTML={{ __html: formatMarkdown(currentPopupAnnouncement.content) }} />
          </div>
        </Dialog>
      )}

      {/* 公告详情对话框 */}
      <Dialog
        visible={detailDialogVisible}
        header={
          selectedAnnouncement && (
            <div className="announcement-dialog-header">
              {getTypeTag(selectedAnnouncement.announcement_type)}
              <span className="dialog-title">{selectedAnnouncement.title}</span>
            </div>
          )
        }
        footer={
          <div className="announcement-dialog-footer">
            <Button variant="outline" onClick={() => setDetailDialogVisible(false)}>
              关闭
            </Button>
            <Button
              theme="primary"
              icon={<CheckCircleIcon />}
              onClick={handleMarkReadInDetail}
            >
              {selectedAnnouncement?.require_confirm ? '确认已读' : '标记已读'}
            </Button>
          </div>
        }
        onClose={() => setDetailDialogVisible(false)}
        width={600}
      >
        {selectedAnnouncement && (
          <div className="announcement-dialog-content">
            <div className="announcement-meta">
              <span className="meta-time">
                发布时间：{new Date(selectedAnnouncement.created_at).toLocaleString('zh-CN')}
              </span>
            </div>
            <div className="markdown-content" dangerouslySetInnerHTML={{ __html: formatMarkdown(selectedAnnouncement.content) }} />
          </div>
        )}
      </Dialog>
    </>
  );
};
