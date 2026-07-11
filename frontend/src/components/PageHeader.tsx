import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge, Button, Drawer, List, Space, Typography, message } from 'antd';
import {
  HomeOutlined,
  SearchOutlined,
  AppstoreOutlined,
  UserOutlined,
  TagsOutlined,
  LoginOutlined,
  MessageOutlined,
  SettingOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { useAuthModalStore } from '../store/authModalStore';
import { messageService, type InboxMessageItem } from '../services/messageService';
import ThemeToggle from './ThemeToggle';
import MarkdownContent from './MarkdownContent';
import './PageHeader.css';

const { Text } = Typography;

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path?: string;
  key: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  /** Optional extra content (e.g. search bar) rendered at the right side */
  extra?: React.ReactNode;
  onFeedbackClick?: () => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({ extra, onFeedbackClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const { openLogin } = useAuthModalStore();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxItems, setInboxItems] = useState<InboxMessageItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const unread = await messageService.getUnreadCount();
      setUnreadCount(unread);
    } catch {
      // keep quiet to avoid interrupting page usage
    }
  }, [isAuthenticated]);

  const loadInbox = useCallback(async () => {
    if (!isAuthenticated) {
      setInboxItems([]);
      return;
    }
    setInboxLoading(true);
    try {
      const data = await messageService.getInbox(1, 20);
      setInboxItems(data.items || []);
      setUnreadCount((data.items || []).filter((item) => !item.is_read).length);
    } catch (error: any) {
      message.error(error?.message || '加载站内信失败');
    } finally {
      setInboxLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadUnreadCount();
  }, [loadUnreadCount]);

  const navItems: NavItem[] = [
    { key: 'home', icon: <HomeOutlined />, label: '主页', path: '/' },
    { key: 'search', icon: <SearchOutlined />, label: '搜索', path: '/search' },
    { key: 'albums', icon: <AppstoreOutlined />, label: '专辑', path: '/albums' },
    { key: 'artists', icon: <UserOutlined />, label: '创作者', path: '/artists' },
    { key: 'tags', icon: <TagsOutlined />, label: '标签', path: '/tags' },
    { key: 'feedback', icon: <MessageOutlined />, label: '反馈', onClick: onFeedbackClick },
  ];

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="page-header">
      <div className="page-header-inner">
        {/* Logo */}
        <div className="page-header-logo" onClick={() => navigate('/')}>
          🎵 HoYoMusic
        </div>

        {/* Navigation */}
        <nav className="page-header-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`page-header-nav-item${isActive(item.path) ? ' active' : ''}`}
              onClick={() => {
                if (item.onClick) {
                  item.onClick();
                  return;
                }
                if (item.path) {
                  navigate(item.path);
                }
              }}
            >
              <span className="page-header-nav-icon">{item.icon}</span>
              <span className="page-header-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Right side: extra + theme toggle */}
        <div className="page-header-right">
          {extra}
          <>
            <button
              className="page-header-auth-button"
              onClick={() => {
                setInboxOpen(true);
                void loadInbox();
              }}
            >
              <span className="page-header-nav-icon">
                <Badge count={unreadCount} size="small" overflowCount={99}>
                  <BellOutlined />
                </Badge>
              </span>
              <span>消息</span>
            </button>
            <button
              className="page-header-auth-button"
              onClick={() => {
                if (isAuthenticated) {
                  navigate('/me');
                  return;
                }
                openLogin(`${location.pathname}${location.search}${location.hash}`);
              }}
            >
              <span className="page-header-nav-icon">
                {isAuthenticated ? <UserOutlined /> : <LoginOutlined />}
              </span>
              <span>{isAuthenticated ? (user?.username || '我的') : '登录'}</span>
            </button>
            {isAuthenticated && user?.is_admin && (
              <button
                className="page-header-auth-button"
                onClick={() => navigate('/admin')}
              >
                <span className="page-header-nav-icon"><SettingOutlined /></span>
                <span>管理</span>
              </button>
            )}
          </>
          <ThemeToggle />
        </div>
      </div>

      <Drawer
        title="站内信"
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        width={460}
        extra={(
          <Space>
            <Button size="small" onClick={() => void loadInbox()} loading={inboxLoading}>刷新</Button>
            <Button
              size="small"
              onClick={async () => {
                try {
                  const updated = await messageService.markAllRead();
                  if (updated > 0) {
                    message.success(`已标记 ${updated} 条站内信为已读`);
                  }
                  await loadInbox();
                } catch (error: any) {
                  message.error(error?.message || '操作失败');
                }
              }}
            >
              全部已读
            </Button>
          </Space>
        )}
      >
        <List
          loading={inboxLoading}
          dataSource={inboxItems}
          locale={{ emptyText: '暂无站内信' }}
          renderItem={(item) => (
            <List.Item
              className={item.is_read ? 'site-message-item-read' : 'site-message-item-unread'}
              actions={[
                !item.is_read ? (
                  <Button
                    key="read"
                    size="small"
                    type="link"
                    onClick={async () => {
                      try {
                        await messageService.markRead(item.id);
                        await loadInbox();
                      } catch (error: any) {
                        message.error(error?.message || '标记已读失败');
                      }
                    }}
                  >
                    标记已读
                  </Button>
                ) : null,
              ]}
            >
              <List.Item.Meta
                title={(
                  <Space>
                    <Text strong>{item.title}</Text>
                    {!item.is_read && <Badge status="processing" text="未读" />}
                  </Space>
                )}
                description={(
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <MarkdownContent content={item.content} className="site-message-markdown" />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(item.delivered_at).toLocaleString('zh-CN')} · 发送者 {item.sender_username || '系统管理员'}
                    </Text>
                  </Space>
                )}
              />
            </List.Item>
          )}
        />
      </Drawer>
    </header>
  );
};

export default PageHeader;

