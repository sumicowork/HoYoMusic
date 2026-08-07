import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Col, Empty, Input, List, Modal, Row, Space, Spin, Statistic, Tag, Typography, message } from 'antd';
import { HeartFilled, LogoutOutlined, PlayCircleOutlined, PlusOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import favoriteService from '../services/favoriteService';
import { authService } from '../services/authService';
import playlistService, { type Playlist } from '../services/playlistService';
import type { Track } from '../types';
import './Profile.css';

const { Title, Text } = Typography;
const FAVORITES_PAGE_SIZE = 8;
const PLAYLISTS_PAGE_SIZE = 8;

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { playTrackOnly } = usePlayerStore();
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [playlistCount, setPlaylistCount] = useState(0);
  const [favoriteTracks, setFavoriteTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favoritePage, setFavoritePage] = useState(1);
  const [playlistPage, setPlaylistPage] = useState(1);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  // 手机号实名
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneBinding, setPhoneBinding] = useState(false);
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const [showChangePhone, setShowChangePhone] = useState(false);

  const handleSendPhoneCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phoneInput)) {
      message.warning('请输入正确的手机号');
      return;
    }
    setPhoneSending(true);
    try {
      await authService.sendPhoneCode(phoneInput);
      message.success('验证码已发送');
      let n = 60;
      setPhoneCountdown(n);
      const timer = setInterval(() => {
        n -= 1;
        setPhoneCountdown(n);
        if (n <= 0) clearInterval(timer);
      }, 1000);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setPhoneSending(false);
    }
  };

  const handleBindPhone = async () => {
    if (!/^1[3-9]\d{9}$/.test(phoneInput) || !phoneCode) {
      message.warning('请输入手机号和验证码');
      return;
    }
    setPhoneBinding(true);
    try {
      await authService.bindPhone(phoneInput, phoneCode);
      message.success('实名认证完成');
      const freshUser = await authService.getCurrentUser();
      useAuthStore.setState({ user: freshUser });
      setPhoneInput('');
      setPhoneCode('');
      setShowChangePhone(false);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setPhoneBinding(false);
    }
  };

  const pagedPlaylists = useMemo(() => {
    const start = (playlistPage - 1) * PLAYLISTS_PAGE_SIZE;
    return playlists.slice(start, start + PLAYLISTS_PAGE_SIZE);
  }, [playlists, playlistPage]);

  const loadFavorites = async (page = 1) => {
    setFavoriteLoading(true);
    try {
      const favoriteData = await favoriteService.getFavorites(page, FAVORITES_PAGE_SIZE);
      setFavoriteTracks(favoriteData.tracks || []);
      setFavoriteCount(favoriteData.pagination?.total || 0);
      setFavoritePage(favoriteData.pagination?.page || page);
    } catch {
      message.error('加载收藏失败');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const loadPlaylists = async () => {
    setPlaylistLoading(true);
    try {
      const data = await playlistService.getPlaylists();
      setPlaylists(data);
      setPlaylistCount(data.length);
      const maxPage = Math.max(1, Math.ceil(data.length / PLAYLISTS_PAGE_SIZE));
      setPlaylistPage((prev) => Math.min(prev, maxPage));
    } catch {
      message.error('加载歌单失败');
    } finally {
      setPlaylistLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadFavorites(1), loadPlaylists()]);
  }, []);

  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) {
      message.warning('请输入歌单名称');
      return;
    }

    setCreateSubmitting(true);
    try {
      const created = await playlistService.createPlaylist(name, newPlaylistDesc.trim() || undefined);
      message.success('歌单创建成功');
      setCreateModalOpen(false);
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      const data = await playlistService.getPlaylists();
      setPlaylists(data);
      setPlaylistCount(data.length);
      setPlaylistPage(Math.max(1, Math.ceil(data.length / PLAYLISTS_PAGE_SIZE)));
      navigate(`/playlists/${created.id}`);
    } catch {
      message.error('创建歌单失败');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  // ── 账号注销（落实用户协议承诺：核实身份后办理注销并删除个人信息）──
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      message.warning('请输入密码确认注销');
      return;
    }
    setDeleting(true);
    try {
      const resp = await authService.deleteAccount(deletePassword);
      if (resp?.success) {
        message.success('账号已注销，感谢使用');
        setDeleteOpen(false);
        logout();
        navigate('/', { replace: true });
      } else {
        message.error(resp?.error?.message || '注销失败，请稍后重试');
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error?.message || '注销失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="profile-page">
      <Card className="profile-hero" bordered={false}>
        <div className="profile-hero-inner">
          <Space align="center" size={12}>
            <Avatar size={56} icon={<UserOutlined />} className="profile-avatar" />
            <Space direction="vertical" size={0}>
              <Title level={3} style={{ margin: 0 }}>
                {user?.username || '未知用户'}
              </Title>
            </Space>
          </Space>
          <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
            退出登录
          </Button>
        </div>
      </Card>

      <Card className="profile-main-card">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>

          <Card title="实名认证" className="profile-module-card">
            {user?.phone_verified && !showChangePhone ? (
              <Space direction="vertical" size={8}>
                <Typography.Text type="success">
                  已实名认证（手机号 {user.phone ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}` : '已绑定'}）——可发表评论与评分
                </Typography.Text>
                <Button size="small" onClick={() => setShowChangePhone(true)}>换绑手机号</Button>
              </Space>
            ) : (
              <Space direction="vertical" size={8}>
                <Typography.Text type="warning">
                  按《互联网跟帖评论服务管理规定》，发表评论、评分需完成手机号实名认证
                </Typography.Text>
                <Space.Compact style={{ width: 280 }}>
                  <Input
                    placeholder="输入手机号"
                    maxLength={11}
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d]/g, ''))}
                  />
                  <Button onClick={handleSendPhoneCode} loading={phoneSending}>
                    {phoneCountdown > 0 ? `${phoneCountdown}s` : '发送验证码'}
                  </Button>
                </Space.Compact>
                <Input
                  placeholder="输入验证码"
                  maxLength={6}
                  style={{ width: 280 }}
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value.replace(/[^\d]/g, ''))}
                />
                <Space>
                  <Button type="primary" onClick={handleBindPhone} loading={phoneBinding}>
                    {user?.phone_verified ? '确认换绑' : '绑定并完成实名'}
                  </Button>
                  {showChangePhone && (
                    <Button onClick={() => { setShowChangePhone(false); setPhoneInput(''); setPhoneCode(''); }}>
                      取消
                    </Button>
                  )}
                </Space>
              </Space>
            )}
          </Card>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Card>
                <Statistic title="收藏曲目" value={favoriteCount} prefix={<HeartFilled style={{ color: '#ff4d6a' }} />} />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card>
                <Statistic title="自建歌单" value={playlistCount} prefix={<UnorderedListOutlined />} />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Card title="我的喜爱" className="profile-module-card" loading={favoriteLoading}>
                {favoriteLoading ? (
                  <div style={{ textAlign: 'center', padding: 12 }}><Spin /></div>
                ) : favoriteTracks.length === 0 ? (
                  <Empty description="还没有收藏任何曲目" />
                ) : (
                  <List
                    dataSource={favoriteTracks}
                    pagination={{
                      current: favoritePage,
                      pageSize: FAVORITES_PAGE_SIZE,
                      total: favoriteCount,
                      size: 'small',
                      showSizeChanger: false,
                      onChange: (page) => void loadFavorites(page),
                    }}
                    renderItem={(track) => (
                      <List.Item className="profile-list-item"
                        actions={[
                          <Button key="play" type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => playTrackOnly(track)}>
                            播放
                          </Button>,
                        ]}
                      >
                        <Space direction="vertical" size={2} style={{ width: '100%' }}>
                          <Link className="profile-primary-link" to={`/track/${track.id}`}>{track.title}</Link>
                          <Space size={6}>
                            <Tag className="profile-soft-tag" color="magenta">喜爱</Tag>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {track.album_title || '未分类专辑'}
                            </Text>
                          </Space>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card
                title="我的歌单"
                className="profile-module-card"
                extra={
                  <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
                    新建歌单
                  </Button>
                }
                loading={playlistLoading}
              >
                {playlistLoading ? (
                  <div style={{ textAlign: 'center', padding: 12 }}><Spin /></div>
                ) : playlists.length === 0 ? (
                  <Empty description="还没有歌单" />
                ) : (
                  <List
                    dataSource={pagedPlaylists}
                    pagination={{
                      current: playlistPage,
                      pageSize: PLAYLISTS_PAGE_SIZE,
                      total: playlistCount,
                      size: 'small',
                      showSizeChanger: false,
                      onChange: (page) => setPlaylistPage(page),
                    }}
                    renderItem={(playlist) => (
                      <List.Item className="profile-list-item">
                        <Space direction="vertical" size={2} style={{ width: '100%' }}>
                          <Link className="profile-primary-link" to={`/playlists/${playlist.id}`}>{playlist.name}</Link>
                          <Space size={6}>
                            <Tag className="profile-soft-tag" color="blue">歌单</Tag>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {playlist.track_count} 首 · {Math.floor(playlist.total_duration / 60)} 分钟
                            </Text>
                          </Space>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>
          </Row>
        </Space>
      </Card>

      <Modal
        title="新建歌单"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => void handleCreatePlaylist()}
        okText="创建"
        cancelText="取消"
        confirmLoading={createSubmitting}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="歌单名称"
            value={newPlaylistName}
            onChange={(event) => setNewPlaylistName(event.target.value)}
            maxLength={100}
          />
          <Input.TextArea
            placeholder="歌单描述（可选）"
            value={newPlaylistDesc}
            onChange={(event) => setNewPlaylistDesc(event.target.value)}
            rows={3}
            maxLength={500}
          />
        </Space>
      </Modal>

      {/* 危险区：账号注销 */}
      <Card
        title={<span style={{ color: '#ff4d4f' }}>危险操作</span>}
        className="profile-module-card"
        style={{ marginTop: 16, borderColor: '#ffccc7' }}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            注销后：账号将无法登录，收藏、歌单、站内信将被删除；已发表的评论与评分将保留但显示为「已注销用户」。
            注销流程需验证密码，核实后立即办理。
          </Typography.Text>
          <Button danger onClick={() => setDeleteOpen(true)}>
            注销账号
          </Button>
        </Space>
      </Card>

      <Modal
        title="确认注销账号"
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onOk={() => void handleDeleteAccount()}
        okText="确认注销"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={deleting}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="danger">
            此操作不可撤销。注销后账号将永久停用，个人数据将被删除或匿名化处理。
          </Typography.Text>
          <Input.Password
            placeholder="请输入登录密码以确认"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            maxLength={128}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default Profile;

