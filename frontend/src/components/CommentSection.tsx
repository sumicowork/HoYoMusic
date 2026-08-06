import React, { useCallback, useEffect, useState } from 'react';
import { Button, Input, List, Modal, Pagination, Rate, Select, Typography, message } from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined, FlagOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { commentService, ratingService, CommentTargetType, CommentItem } from '../services/commentService';
import { useAuthModalStore } from '../store/authModalStore';
import './CommentSection.css';

const { Text, Paragraph } = Typography;

interface Props {
  targetType: CommentTargetType;
  targetId: number;
}

const REPORT_REASONS = [
  '辱骂攻击',
  '广告垃圾',
  '违法违规',
  '色情低俗',
  '不实信息',
  '其他',
];

const CommentSection: React.FC<Props> = ({ targetType, targetId }) => {
  const { user, isAuthenticated } = useAuthStore();
  const openAuthModal = useAuthModalStore((s) => s.openLogin);
  const handleOpenAuth = () => openAuthModal();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  // 评分
  const [rating, setRating] = useState<{ count: number; average: number; distribution: Record<string, number>; my_score: number | null } | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);

  // 举报
  const [reportTarget, setReportTarget] = useState<CommentItem | null>(null);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const r = await commentService.list(targetType, targetId, p);
      setComments(r.comments);
      setTotal(r.total);
      setPage(r.page);
    } catch {
      message.error('加载评论失败');
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  const loadRating = useCallback(async () => {
    setRatingLoading(true);
    try {
      setRating(await ratingService.get(targetType, targetId));
    } catch {
      // 评分加载失败不阻塞
    } finally {
      setRatingLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    load(1);
    loadRating();
  }, [load, loadRating]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text) return;
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    setSubmitting(true);
    try {
      const r = await commentService.create(targetType, targetId, text);
      setInput('');
      message.success(r.status === 'pending' ? '评论已提交，等待审核' : '评论已发布');
      load(1);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRate = async (score: number) => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    try {
      await ratingService.submit(targetType, targetId, score);
      message.success('评分成功');
      loadRating();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '删除评论',
      icon: <ExclamationCircleOutlined />,
      content: '确定删除这条评论吗？',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await commentService.remove(id);
          message.success('已删除');
          load(page);
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });
  };

  const handleReport = async () => {
    if (!reportTarget) return;
    try {
      await commentService.report(reportTarget.id, reportReason);
      message.success('举报已受理');
      setReportTarget(null);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const distribution = rating?.distribution || {};
  const distTotal = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="comment-section">
      <div className="comment-section-header">
        <Typography.Title level={4} style={{ margin: 0 }}>评论</Typography.Title>
        <div className="comment-rating">
          <Rate
            value={rating?.my_score || 0}
            onChange={handleRate}
            disabled={ratingLoading}
            allowHalf={false}
            style={{ fontSize: 16 }}
          />
          <Text type="secondary" style={{ marginLeft: 8 }}>
            {rating && rating.count > 0 ? `${rating.average.toFixed(1)} 分（${rating.count} 人）` : '暂无评分'}
          </Text>
          {rating && rating.count > 0 && (
            <div className="rating-dist">
              {[5, 4, 3, 2, 1].map((s) => (
                <div key={s} className="rating-bar-row">
                  <Text type="secondary" style={{ fontSize: 12, width: 14 }}>{s}★</Text>
                  <div className="rating-bar">
                    <div
                      className="rating-bar-fill"
                      style={{ width: `${distTotal ? ((distribution[s] || 0) / distTotal) * 100 : 0}%` }}
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, width: 24 }}>{distribution[s] || 0}</Text>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="comment-input-row">
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 2000))}
          placeholder="友善评论，理性发言…（发布即代表同意《用户协议》和《社区规范》）"
          autoSize={{ minRows: 2, maxRows: 6 }}
          disabled={!isAuthenticated}
        />
        <div className="comment-input-actions">
          {!isAuthenticated ? (
            <Button type="primary" onClick={handleOpenAuth}>登录后评论</Button>
          ) : (
            <>
              {!user?.phone_verified && (
                <Text type="warning" style={{ fontSize: 12 }}>
                  提示：评论需要先完成手机号实名认证（个人中心绑定）
                </Text>
              )}
              <Button type="primary" loading={submitting} onClick={handleSubmit} disabled={!user?.phone_verified || !input.trim()}>
                发布评论
              </Button>
            </>
          )}
        </div>
      </div>

      <List
        className="comment-list"
        loading={loading}
        dataSource={comments}
        locale={{ emptyText: '还没有评论，来抢沙发吧' }}
        renderItem={(c) => (
          <List.Item
            key={c.id}
            actions={[
              <Button key="report" type="text" size="small" icon={<FlagOutlined />} onClick={() => setReportTarget(c)}>
                举报
              </Button>,
              user && (user.id === c.user.id || user.is_admin) ? (
                <Button key="del" type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(c.id)} />
              ) : null,
            ]}
          >
            <List.Item.Meta
              title={
                <span>
                  <Text strong>{c.user.username}</Text>
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    {new Date(c.created_at).toLocaleString('zh-CN')}
                  </Text>
                  {c.status === 'pending' && <Text type="warning" style={{ marginLeft: 8, fontSize: 12 }}>（审核中）</Text>}
                </span>
              }
              description={<Paragraph style={{ margin: 0 }}>{c.content}</Paragraph>}
            />
          </List.Item>
        )}
      />
      {total > 20 && (
        <Pagination
          current={page}
          total={total}
          pageSize={20}
          onChange={(p) => load(p)}
          showSizeChanger={false}
          style={{ marginTop: 16, textAlign: 'center' }}
        />
      )}

      <Modal
        title="举报评论"
        open={!!reportTarget}
        onCancel={() => setReportTarget(null)}
        onOk={handleReport}
        okText="提交举报"
      >
        <Select value={reportReason} onChange={setReportReason} style={{ width: '100%' }} options={REPORT_REASONS.map((r) => ({ value: r, label: r }))} />
      </Modal>
    </div>
  );
};

export default CommentSection;
