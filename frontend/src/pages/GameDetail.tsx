import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Layout, Card, Row, Col, Spin, Empty, message, Button, Tabs, Tree, Table,
  Breadcrumb, Space, Tag, Typography, Grid, Tooltip,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined,
  ApartmentOutlined, AppstoreOutlined, SoundOutlined,
} from '@ant-design/icons';
import { gameService } from '../services/gameService';
import {
  musicSourceService,
  type PublicGameMusicTree,
  type PublicMusicTreeNode,
} from '../services/musicSourceService';
import { trackService, DOWNLOAD_ENABLED } from '../services/trackService';
import { usePlayerStore } from '../store/playerStore';
import type { Track } from '../types';
import { getCoverUrl, handleImageError } from '../utils/imageUtils';
import { formatDuration as formatTrackDuration } from '../utils/format';
import { handleApiError } from '../utils/errorHandler';
import CommentSection from '../components/CommentSection';
import './GameDetail.css';

const { Content } = Layout;
const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

interface Game {
  id: number;
  name: string;
  name_en: string;
  description: string;
  album_count: number;
}

interface Album {
  id: number;
  title: string;
  cover_path: string;
  release_date: string;
  track_count: number;
  total_duration: number;
}

// 扁平化场景树，产出 AntD treeData + 便于深链定位的索引
interface FlattenResult {
  treeData: DataNode[];
  parentMap: Map<number, number | null>;
  categoryOfNode: Map<number, number>;
}

const buildTreeData = (tree: PublicGameMusicTree | null): FlattenResult => {
  const parentMap = new Map<number, number | null>();
  const categoryOfNode = new Map<number, number>();
  if (!tree) return { treeData: [], parentMap, categoryOfNode };

  const walk = (node: PublicMusicTreeNode, categoryId: number): DataNode => {
    parentMap.set(node.id, node.parent_id);
    categoryOfNode.set(node.id, categoryId);
    const count = node.total_track_count;
    return {
      key: `n-${node.id}`,
      title: (
        <span style={{ opacity: count > 0 ? 1 : 0.55 }}>
          {node.name}
          {count > 0 && (
            <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
              {count}
            </Text>
          )}
        </span>
      ),
      children: node.children.length > 0 ? node.children.map((c) => walk(c, categoryId)) : undefined,
    };
  };

  const treeData: DataNode[] = tree.categories
    .filter((cat) => cat.children.length > 0)
    .map((cat) => ({
      key: `cat-${cat.id}`,
      selectable: false,
      title: (
        <span style={{ fontWeight: 600 }}>
          {cat.name}
          <Text type="secondary" style={{ marginLeft: 6, fontSize: 12, fontWeight: 400 }}>
            {cat.total_track_count}
          </Text>
        </span>
      ),
      children: cat.children.map((n) => walk(n, cat.id)),
    }));

  return { treeData, parentMap, categoryOfNode };
};

const GameDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { play, setPlaylist, playTrackOnly } = usePlayerStore();

  const [game, setGame] = useState<Game | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  const initialTab = searchParams.get('tab') === 'sources' ? 'sources' : 'albums';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // 场景树状态
  const [tree, setTree] = useState<PublicGameMusicTree | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);

  // 选中节点曲目（服务端分页）
  const PAGE_SIZE = 50;
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [nodeTracks, setNodeTracks] = useState<Track[]>([]);
  const [nodePath, setNodePath] = useState<string[]>([]);
  const [nodeName, setNodeName] = useState<string>('');
  const [nodeTotal, setNodeTotal] = useState(0);
  const [nodePage, setNodePage] = useState(1);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [playAllLoading, setPlayAllLoading] = useState(false);

  const { treeData, parentMap, categoryOfNode } = useMemo(() => buildTreeData(tree), [tree]);

  useEffect(() => {
    if (id) fetchGameDetails();
  }, [id]);

  // 首次进入若已在场景 Tab 或带 node 深链，加载树
  useEffect(() => {
    if (activeTab === 'sources' && !tree && !treeLoading && id) {
      loadTree();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  // 树加载完成后，处理 ?node=<id> 深链
  useEffect(() => {
    const nodeParam = searchParams.get('node');
    if (!tree || !nodeParam) return;
    const nodeId = Number(nodeParam);
    if (!Number.isInteger(nodeId) || nodeId <= 0) return;
    if (!parentMap.has(nodeId)) return;
    focusNode(nodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  const fetchGameDetails = async () => {
    try {
      const data = await gameService.getGameById(parseInt(id!));
      setGame(data.game);
      setAlbums(data.albums);
    } catch (error) {
      handleApiError(error, '加载游戏详情失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTree = async () => {
    if (!id) return;
    setTreeLoading(true);
    try {
      const data = await musicSourceService.getGameMusicTree(parseInt(id));
      setTree(data);
    } catch (e: any) {
      handleApiError(e, '加载场景音乐树失败');
    } finally {
      setTreeLoading(false);
    }
  };

  // 展开并选中某节点，加载其曲目
  const focusNode = (nodeId: number) => {
    // 计算祖先链用于展开
    const ancestors: React.Key[] = [];
    let cur = parentMap.get(nodeId);
    const guard = new Set<number>();
    while (cur != null && !guard.has(cur)) {
      guard.add(cur);
      ancestors.push(`n-${cur}`);
      cur = parentMap.get(cur) ?? null;
    }
    const catId = categoryOfNode.get(nodeId);
    if (catId != null) ancestors.push(`cat-${catId}`);
    setExpandedKeys((prev) => Array.from(new Set([...prev, ...ancestors])));
    setSelectedKeys([`n-${nodeId}`]);
    loadNodeTracks(nodeId);
  };

  const loadNodeTracks = async (nodeId: number, page = 1) => {
    setCurrentNodeId(nodeId);
    setNodePage(page);
    setTracksLoading(true);
    try {
      const result = await musicSourceService.getNodeTracks(nodeId, page, PAGE_SIZE);
      setNodeTracks(result.tracks);
      setNodePath(result.node.path);
      setNodeName(result.node.name);
      setNodeTotal(result.pagination.total);
    } catch (e: any) {
      handleApiError(e, '加载场景曲目失败');
      setNodeTracks([]);
      setNodeTotal(0);
    } finally {
      setTracksLoading(false);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    const next = new URLSearchParams(searchParams);
    if (key === 'sources') next.set('tab', 'sources');
    else {
      next.delete('tab');
      next.delete('node');
    }
    setSearchParams(next, { replace: true });
  };

  const handleTreeSelect = (keys: React.Key[]) => {
    const key = keys[0];
    if (typeof key === 'string' && key.startsWith('n-')) {
      const nodeId = Number(key.slice(2));
      setSelectedKeys(keys);
      loadNodeTracks(nodeId);
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'sources');
      next.set('node', String(nodeId));
      setSearchParams(next, { replace: true });
    }
  };

  const handlePlayAll = async () => {
    if (currentNodeId == null || nodeTotal === 0) return;
    // 若曲目跨多页，拉全后再整队播放
    if (nodeTotal <= nodeTracks.length) {
      setPlaylist(nodeTracks);
      play(nodeTracks[0]);
      message.success(`已添加 ${nodeTracks.length} 首到播放队列`);
      return;
    }
    setPlayAllLoading(true);
    const hide = message.loading('正在加载全部曲目...', 0);
    try {
      const totalPages = Math.ceil(nodeTotal / PAGE_SIZE);
      const all: Track[] = [];
      for (let p = 1; p <= totalPages; p++) {
        const r = await musicSourceService.getNodeTracks(currentNodeId, p, PAGE_SIZE);
        all.push(...r.tracks);
      }
      if (all.length > 0) {
        setPlaylist(all);
        play(all[0]);
        message.success(`已添加 ${all.length} 首到播放队列`);
      }
    } catch (e: any) {
      handleApiError(e, '播放全部失败');
    } finally {
      hide();
      setPlayAllLoading(false);
    }
  };

  const formatAlbumDuration = (seconds: number) => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getGameClass = () => {
    if (!game) return '';
    const name = game.name;
    if (name === '原神') return 'genshin-bg';
    if (name === '崩坏：星穹铁道') return 'starrail-bg';
    if (name === '绝区零') return 'zzz-bg';
    if (name === '崩坏3') return 'honkai3-bg';
    if (name === '未定事件簿') return 'tears-bg';
    if (name === '崩坏因缘精灵') return 'nexus-bg';
    if (name === '星布谷地') return 'petit-bg';
    return '';
  };

  const getGameAccent = (): string => {
    if (!game) return 'var(--aurora-1)';
    const name = game.name;
    if (name === '原神') return '#D4A574';
    if (name === '崩坏：星穹铁道') return '#C8D6E5';
    if (name === '绝区零') return '#FF6B9D';
    if (name === '崩坏3') return '#FF6B9D';
    return 'var(--aurora-1)';
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" />
        </Content>
      </Layout>
    );
  }

  if (!game) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            返回首页
          </Button>
          <div style={{ marginTop: 24, textAlign: 'center' }}>未找到该游戏</div>
        </Content>
      </Layout>
    );
  }

  const trackColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: Track) => (
        <Link to={`/track/${record.id}`} style={{ color: 'var(--accent-primary, #7c5cff)', cursor: 'pointer' }}>
          {title}
        </Link>
      ),
    },
    {
      title: '专辑',
      dataIndex: 'album_title',
      key: 'album',
      render: (album: string | undefined, record: Track) => {
        if (!album) return '-';
        if (!record.album_id) return album;
        return <Link to={`/albums/${record.album_id}`}>{album}</Link>;
      },
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 90,
      render: (d: number | null) => formatTrackDuration(d),
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      render: (_: unknown, record: Track) => (
        <Space size="small">
          <Tooltip title="播放">
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => playTrackOnly(record)}
            />
          </Tooltip>
          {DOWNLOAD_ENABLED && (
            <Tooltip title="下载">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => window.open(trackService.getDownloadUrlPublic(record.id), '_blank')}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const albumsTab = albums.length === 0 ? (
    <Empty
      description={<span style={{ color: 'var(--text-secondary)' }}>该游戏暂无专辑</span>}
    />
  ) : (
    <Row gutter={[28, 36]}>
      {albums.map((album) => (
        <Col key={album.id} xs={12} sm={12} md={8} lg={6} xl={6} xxl={6}>
          <Card
            hoverable
            className="album-card"
            onClick={() => navigate(`/albums/${album.id}`)}
            cover={
              <div className="album-cover-wrapper">
                <img
                  alt={album.title}
                  src={getCoverUrl(album.cover_path, undefined, true)}
                  onError={handleImageError}
                />
              </div>
            }
          >
            <Card.Meta
              title={album.title}
              description={
                <div className="album-info">
                  <div>{album.track_count || 0} 首</div>
                  {album.total_duration && <div>{formatAlbumDuration(album.total_duration)}</div>}
                  {album.release_date && (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {new Date(album.release_date).getFullYear()}
                    </div>
                  )}
                </div>
              }
            />
          </Card>
        </Col>
      ))}
    </Row>
  );

  const sourcesTab = (
    <Row gutter={[20, 20]}>
      <Col xs={24} md={9} lg={8}>
        <Card
          size="small"
          className="scene-tree-card"
          title={<span><ApartmentOutlined /> 场景 / 剧情 / 任务</span>}
          styles={{ body: { padding: 8 } }}
        >
          {treeLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
          ) : treeData.length === 0 ? (
            <Empty description="该游戏暂无场景数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Tree
              treeData={treeData}
              expandedKeys={expandedKeys}
              selectedKeys={selectedKeys}
              onExpand={(keys) => setExpandedKeys(keys)}
              onSelect={handleTreeSelect}
              height={isMobile ? 480 : 560}
              blockNode
            />
          )}
        </Card>
      </Col>
      <Col xs={24} md={15} lg={16}>
        {selectedKeys.length === 0 ? (
          <Card className="scene-tracks-card">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="从左侧选择一个场景 / 剧情 / 任务，查看在此处播放的曲目"
            />
          </Card>
        ) : (
          <Card
            className="scene-tracks-card"
            title={
              <div>
                {nodePath.length > 0 && (
                  <Breadcrumb
                    style={{ marginBottom: 4 }}
                    items={nodePath.map((seg) => ({ title: <span style={{ fontSize: 12 }}>{seg}</span> }))}
                  />
                )}
                <Space>
                  <SoundOutlined />
                  <span style={{ fontWeight: 600 }}>{nodeName}</span>
                  <Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>
                    共 {nodeTotal} 首（含子场景）
                  </Text>
                </Space>
              </div>
            }
            extra={
              nodeTotal > 0 && (
                <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={handlePlayAll} loading={playAllLoading}>
                  播放全部
                </Button>
              )
            }
          >
            <Table
              rowKey="id"
              size="small"
              loading={tracksLoading}
              columns={trackColumns}
              dataSource={nodeTracks}
              pagination={
                nodeTotal > PAGE_SIZE
                  ? {
                      current: nodePage,
                      pageSize: PAGE_SIZE,
                      total: nodeTotal,
                      size: 'small',
                      showSizeChanger: false,
                      onChange: (p) => currentNodeId != null && loadNodeTracks(currentNodeId, p),
                    }
                  : false
              }
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="此场景暂无直接关联的曲目" /> }}
            />
          </Card>
        )}
      </Col>
    </Row>
  );

  return (
    <Layout className={`game-detail-layout ${getGameClass()}`}>
      <Content className="game-detail-content" style={{ background: 'transparent' }}>
        {/* Hero */}
        <div className="game-hero" style={{ '--game-accent': getGameAccent() } as React.CSSProperties}>
          <Breadcrumb
            className="game-hero-breadcrumb"
            style={{ marginBottom: 8 }}
            items={[
              { title: <Link to="/" style={{ color: 'var(--text-secondary)' }}>首页</Link> },
              { title: <span style={{ color: 'var(--text-tertiary)' }}>游戏</span> },
              { title: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{game.name}</span> },
            ]}
          />
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            className="game-hero-back"
          >
            返回首页
          </Button>
          <Title level={2} className="game-hero-title" style={{ marginBottom: 4 }}>
            {game.name}
          </Title>
          {game.name_en && <Text className="game-hero-subtitle">{game.name_en}</Text>}
          {game.description && (
            <p className="game-hero-desc">{game.description}</p>
          )}
          <Space size="middle" style={{ marginTop: 8 }}>
            <Tag color="purple">{albums.length} 张专辑</Tag>
          </Space>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          className="game-detail-tabs"
          items={[
            { key: 'albums', label: <span><AppstoreOutlined /> 专辑</span>, children: albumsTab },
            { key: 'sources', label: <span><ApartmentOutlined /> 场景音乐</span>, children: sourcesTab },
          ]}
        />
        <CommentSection targetType="game" targetId={Number(id)} />
      </Content>
    </Layout>
  );
};

export default GameDetail;
