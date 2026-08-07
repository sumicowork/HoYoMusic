import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Empty, List, Pagination, Tabs, Tag, Typography, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { CommentTargetType } from '../services/commentService';

const { Text, Paragraph } = Typography;

interface AdminComment {
  id: number;
  target_type: CommentTargetType;
  target_id: number;
  content: string;
  status: string;
  created_at: string;
  ip: string | null;
  report_count: number;
  username: string;
  user_id: number;
}

interface ReportItem {
  id: number;
  reason: string;
  detail: string;
  status: string;
  created_at: string;
  comment_id: number;
  comment_content: string;
  comment_status: string;
  comment_author: string;
  reporter: string;
}

const TARGET_LABEL: Record<string, string> = { track: '曲目', album: '专辑', game: '游戏', artist: '创作者' };

const targetPath = (type: string, id: number): string => {
  if (type === 'track') return `/track/${id}`;
  if (type === 'album') return `/albums/${id}`;
  if (type === 'game') return `/games/${id}`;
  if (type === 'artist') return `/artists/${id}`;
  return '/';
};

const CommentReview: React.FC = () => {
  const [tab, setTab] = useState<'pending' | 'reports'>('pending');
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const loadPending = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const r = await api.get('/comments/admin/pending', { params: { status: 'pending', page: p, page_size: 20 } });
      setComments(r.data.data.comments);
      setTotal(r.data.data.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReports = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const r = await api.get('/comments/admin/reports', { params: { page: p, page_size: 20 } });
      setReports(r.data.data.reports);
      setReportTotal(r.data.data.total);
      setReportPage(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'pending') loadPending(1);
    else loadReports(1);
  }, [tab, loadPending, loadReports]);

  const review = async (id: number, action: 'approve' | 'reject') => {
    try {
      await api.post(`/comments/admin/${id}/review`, { action });
      message.success(action === 'approve' ? '已通过' : '已拒绝');
      loadPending(page);
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleReport = async (id: number, deleteComment: boolean) => {
    try {
      await api.post(`/comments/admin/reports/${id}/handle`, { action: 'handled', delete_comment: deleteComment });
      message.success('已处理');
      loadReports(reportPage);
    } catch (e) {
      message.error('操作失败');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title="评论管理">
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'pending' | 'reports')}
          items={[
            {
              key: 'pending',
              label: `待审核（${total}）`,
              children: (
                <List
                  loading={loading}
                  dataSource={comments}
                  locale={{ emptyText: <Empty description="没有待审核评论" /> }}
                  renderItem={(c) => (
                    <List.Item
                      actions={[
                        <Button key="ok" type="primary" size="small" icon={<CheckOutlined />} onClick={() => review(c.id, 'approve')}>通过</Button>,
                        <Button key="no" danger size="small" icon={<CloseOutlined />} onClick={() => review(c.id, 'reject')}>拒绝</Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <span>
                            <Text strong>{c.username}</Text>
                            <Link to={targetPath(c.target_type, c.target_id)} target="_blank">
                              <Tag style={{ marginLeft: 8 }} color="blue">{TARGET_LABEL[c.target_type]}#{c.target_id}</Tag>
                            </Link>
                            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{new Date(c.created_at).toLocaleString('zh-CN')}</Text>
                            {c.ip && <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>IP {c.ip}</Text>}
                          </span>
                        }
                        description={<Paragraph style={{ margin: 0 }}>{c.content}</Paragraph>}
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'reports',
              label: `举报（${reportTotal}）`,
              children: (
                <List
                  loading={loading}
                  dataSource={reports}
                  locale={{ emptyText: <Empty description="没有待处理举报" /> }}
                  renderItem={(r) => (
                    <List.Item
                      actions={[
                        <Button key="del" danger size="small" onClick={() => handleReport(r.id, true)}>删除评论并处理</Button>,
                        <Button key="keep" size="small" onClick={() => handleReport(r.id, false)}>保留评论</Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <span>
                            <Tag color="red">{r.reason}</Tag>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              举报人 {r.reporter} · 评论人 {r.comment_author} · {new Date(r.created_at).toLocaleString('zh-CN')}
                            </Text>
                          </span>
                        }
                        description={
                          <>
                            <Paragraph style={{ margin: 0 }}>评论内容：{r.comment_content}</Paragraph>
                            {r.detail && <Text type="secondary" style={{ fontSize: 12 }}>举报说明：{r.detail}</Text>}
                          </>
                        }
                      />
                    </List.Item>
                  )}
                />
              ),
            },
          ]}
        />
        {tab === 'pending' && total > 20 && (
          <Pagination current={page} total={total} pageSize={20} onChange={loadPending} style={{ marginTop: 16, textAlign: 'center' }} />
        )}
        {tab === 'reports' && reportTotal > 20 && (
          <Pagination current={reportPage} total={reportTotal} pageSize={20} onChange={loadReports} style={{ marginTop: 16, textAlign: 'center' }} />
        )}
      </Card>
    </div>
  );
};

export default CommentReview;
