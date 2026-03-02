import React, { useState, useCallback, useEffect } from 'react';
import {
  Layout, Input, Button, Form, Select, Slider,
  Table, Tag, Image, Space, Typography, Divider,
  Badge, Empty, Spin, Tooltip, Drawer, Checkbox, Collapse,
} from 'antd';
import {
  SearchOutlined, FilterOutlined, PlayCircleOutlined,
  DownloadOutlined, SoundOutlined, CloseOutlined,
  SortAscendingOutlined, ReloadOutlined, InfoCircleOutlined,
  TagOutlined, FolderOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { Track } from '../types';
import { trackService, TrackSearchParams, DOWNLOAD_ENABLED } from '../services/trackService';
import { getTags, getTagGroups, Tag as TagType, TagGroup } from '../services/tagService';
import { usePlayerStore } from '../store/playerStore';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import { toast } from '../utils/toast';
import ThemeToggle from '../components/ThemeToggle';
import './Search.css';

const { Header, Content } = Layout;
const { Text } = Typography;
const { Panel } = Collapse;

const SAMPLE_RATE_OPTIONS = [
  { label: '不限', value: '' },
  { label: '≥ 44.1 kHz (CD)', value: '44100' },
  { label: '≥ 48 kHz', value: '48000' },
  { label: '≥ 88.2 kHz (Hi-Res)', value: '88200' },
  { label: '≥ 96 kHz', value: '96000' },
  { label: '≥ 176.4 kHz', value: '176400' },
  { label: '≥ 192 kHz', value: '192000' },
];

const BIT_DEPTH_OPTIONS = [
  { label: '不限', value: '' },
  { label: '16 bit', value: '16' },
  { label: '24 bit', value: '24' },
  { label: '32 bit', value: '32' },
];

const SORT_OPTIONS = [
  { label: '最新添加', value: 'created_at' },
  { label: '标题 A-Z', value: 'title' },
  { label: '时长', value: 'duration' },
  { label: '采样率', value: 'sample_rate' },
  { label: '发行年份', value: 'release_date' },
];

const currentYear = new Date().getFullYear();

// 将平铺的 tag 列表按 group + parent/child 层级组织
function organizeTagsByGroup(tags: TagType[], groups: TagGroup[]) {
  const grouped: { group: TagGroup | null; tags: TagType[] }[] = [];
  const ungrouped: TagType[] = [];

  const rootTags = tags.filter(t => !t.parent_id);
  const childMap: Record<number, TagType[]> = {};
  tags.filter(t => t.parent_id).forEach(t => {
    if (!childMap[t.parent_id!]) childMap[t.parent_id!] = [];
    childMap[t.parent_id!].push(t);
  });

  // 按分组
  for (const group of groups) {
    const groupRootTags = rootTags.filter(t => t.group_id === group.id);
    if (groupRootTags.length > 0) {
      grouped.push({ group, tags: groupRootTags });
    }
  }
  // 无分组
  rootTags.filter(t => !t.group_id).forEach(t => ungrouped.push(t));
  if (ungrouped.length > 0) {
    grouped.push({ group: null, tags: ungrouped });
  }

  return { grouped, childMap };
}

const Search: React.FC = () => {
  const navigate = useNavigate();
  const { playTrackOnly, addToPlaylist } = usePlayerStore();
  const [form] = Form.useForm();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(0);
  const [lastParams, setLastParams] = useState<TrackSearchParams>({});

  // Tag 数据
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagLogic, setTagLogic] = useState<'AND' | 'OR'>('AND');

  useEffect(() => {
    getTags().then(setAllTags).catch(() => {});
    getTagGroups().then(setTagGroups).catch(() => {});
  }, []);

  const { grouped, childMap } = organizeTagsByGroup(allTags, tagGroups);

  const doSearch = useCallback(async (params: TrackSearchParams) => {
    setLoading(true);
    setSearched(true);
    setLastParams(params);
    try {
      const data = await trackService.searchTracksPublic(params);
      setTracks(data.tracks);
      setPagination({
        current: data.pagination.page,
        pageSize: data.pagination.limit,
        total: data.pagination.total,
      });
    } catch (e: any) {
      toast.error('搜索失败，请重试');
    } finally {
      setLoading(false);
    }
  }, []);

  // 从 form 值 + selectedTagIds 构建参数
  // 注意：Slider 不用 Form 存储，直接用独立 state 避免 defaultValue bug
  const [yearRange, setYearRange] = useState<[number, number]>([2000, currentYear]);
  const [durationRange, setDurationRange] = useState<[number, number]>([0, 60]);
  const [yearFilterEnabled, setYearFilterEnabled] = useState(false);
  const [durationFilterEnabled, setDurationFilterEnabled] = useState(false);

  const buildParams = (page = 1): TrackSearchParams => {
    const values = form.getFieldsValue();
    const params: TrackSearchParams = {
      page,
      limit: pagination.pageSize,
      sort_by: values.sort_by || 'created_at',
      sort_dir: values.sort_dir || 'DESC',
    };

    const keyword = (values.keyword || '').trim();
    if (keyword) params.search = keyword;

    // 音质筛选（空字符串 = 不限）
    if (values.sample_rate_min) params.sample_rate_min = parseInt(values.sample_rate_min);
    if (values.bit_depth)       params.bit_depth       = parseInt(values.bit_depth);

    // 年份（只有启用时才传）
    if (yearFilterEnabled) {
      params.year_from = yearRange[0];
      params.year_to   = yearRange[1];
    }

    // 时长（只有启用时才传，单位：秒）
    if (durationFilterEnabled) {
      params.duration_min = durationRange[0] * 60;
      params.duration_max = durationRange[1] * 60;
    }

    // Tag 筛选
    if (selectedTagIds.length > 0) {
      params.tag_ids = selectedTagIds;
      params.tag_logic = tagLogic;
    }

    return params;
  };

  const countActive = () => {
    const values = form.getFieldsValue();
    let c = 0;
    if (values.sample_rate_min) c++;
    if (values.bit_depth) c++;
    if (yearFilterEnabled) c++;
    if (durationFilterEnabled) c++;
    if (selectedTagIds.length > 0) c++;
    setActiveFilters(c);
  };

  const handleSearch = () => {
    countActive();
    doSearch(buildParams(1));
  };

  const handleReset = () => {
    form.resetFields();
    setSelectedTagIds([]);
    setYearFilterEnabled(false);
    setDurationFilterEnabled(false);
    setYearRange([2000, currentYear]);
    setDurationRange([0, 60]);
    setActiveFilters(0);
    setTracks([]);
    setSearched(false);
  };

  const handlePaginationChange = (page: number) => {
    doSearch({ ...lastParams, page });
  };

  const toggleTag = (id: number) => {
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const columns: ColumnsType<Track> = [
    {
      title: '',
      dataIndex: 'cover_path',
      key: 'cover',
      width: 56,
      render: (coverPath, record) => {
        const src = coverPath
          ? trackService.getCoverUrl(coverPath)
          : (record as any).album_cover
            ? trackService.getCoverUrl((record as any).album_cover)
            : undefined;
        return (
          <Image
            width={44} height={44}
            src={src}
            fallback={MUSIC_ICON_PLACEHOLDER}
            style={{ borderRadius: 6, objectFit: 'cover' }}
            preview={false}
          />
        );
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title, record) => (
        <a className="search-track-title" onClick={() => navigate(`/track/${record.id}`)}>
          {title}
        </a>
      ),
    },
    {
      title: '专辑',
      dataIndex: 'album_title',
      key: 'album',
      ellipsis: true,
      responsive: ['sm'],
      render: (t: string) => t ? <Text type="secondary">{t}</Text> : '—',
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 70,
      responsive: ['sm'],
      render: formatDuration,
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="播放">
            <Button
              type="primary" size="small" shape="circle"
              icon={<PlayCircleOutlined />}
              onClick={() => { playTrackOnly(record); toast.success(`正在播放：${record.title}`); }}
            />
          </Tooltip>
          <Tooltip title="加入队列">
            <Button
              size="small" shape="circle"
              icon={<SoundOutlined />}
              onClick={() => { addToPlaylist(record); toast.success('已加入播放队列'); }}
            />
          </Tooltip>
          <Tooltip title={!DOWNLOAD_ENABLED ? '服务器维护中，暂时关闭下载' : '下载'}>
            <Button
              size="small" shape="circle"
              icon={<DownloadOutlined />}
              disabled={!DOWNLOAD_ENABLED}
              onClick={() => DOWNLOAD_ENABLED && window.open(trackService.getDownloadUrlPublic(record.id), '_blank')}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 快捷搜索标签
  const quickTags = [
    { label: 'Hi-Res 96kHz+', extra: { sample_rate_min: 96000 } },
    { label: '24bit 无损', extra: { bit_depth: 24 } },
    { label: '近 5 年', extra: { year_from: currentYear - 5, year_to: currentYear } },
    { label: '短曲 (<2分钟)', extra: { duration_max: 120 } },
    { label: '长曲 (>5分钟)', extra: { duration_min: 300 } },
  ];

  return (
    <Layout className="search-layout">
      <Header className="search-header">
        <div className="search-header-content">
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer', margin: 0 }}>
            🎵 HoYoMusic
          </h1>
          <ThemeToggle />
        </div>
      </Header>

      <Content className="search-content">
        {/* Hero 搜索区 */}
        <div className="search-hero">
          <h2 className="search-hero-title">搜索音乐</h2>
          <p className="search-hero-sub">支持曲名、艺术家、专辑、标签多维度精准搜索</p>

          <Form form={form} className="search-main-form">
            <div className="search-main-bar">
              <Form.Item name="keyword" noStyle>
                <Input
                  size="large"
                  placeholder="搜索曲名、艺术家、专辑..."
                  prefix={<SearchOutlined style={{ color: '#667eea' }} />}
                  allowClear
                  className="search-main-input"
                  onPressEnter={handleSearch}
                />
              </Form.Item>

              <Form.Item name="sort_by" noStyle initialValue="created_at">
                <Select
                  size="large"
                  style={{ width: 140 }}
                  options={SORT_OPTIONS}
                  suffixIcon={<SortAscendingOutlined />}
                />
              </Form.Item>

              <Form.Item name="sort_dir" noStyle initialValue="DESC">
                <Select size="large" style={{ width: 90 }}>
                  <Select.Option value="DESC">↓ 降序</Select.Option>
                  <Select.Option value="ASC">↑ 升序</Select.Option>
                </Select>
              </Form.Item>

              <Badge count={activeFilters} size="small">
                <Button
                  size="large"
                  icon={<FilterOutlined />}
                  onClick={() => setFilterDrawerOpen(true)}
                  type={activeFilters > 0 ? 'primary' : 'default'}
                >
                  高级筛选
                </Button>
              </Badge>

              <Button
                size="large"
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                loading={loading}
                className="search-submit-btn"
              >
                搜索
              </Button>

              <Tooltip title="重置">
                <Button size="large" icon={<ReloadOutlined />} onClick={handleReset} />
              </Tooltip>
            </div>
          </Form>

          {/* 选中的 Tag 展示 */}
          {selectedTagIds.length > 0 && (
            <div className="search-active-tags">
              <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>已选标签：</Text>
              {selectedTagIds.map(id => {
                const tag = allTags.find(t => t.id === id);
                return tag ? (
                  <Tag
                    key={id}
                    color={tag.color}
                    closable
                    onClose={() => setSelectedTagIds(prev => prev.filter(x => x !== id))}
                    style={{ marginBottom: 4 }}
                  >
                    {tag.name}
                  </Tag>
                ) : null;
              })}
              <Tag
                className="search-tag-clear"
                onClick={() => setSelectedTagIds([])}
              >
                清除全部
              </Tag>
            </div>
          )}

          {/* 快捷标签 */}
          <div className="search-quick-tags">
            {quickTags.map(q => (
              <Tag
                key={q.label}
                className="search-quick-tag"
                onClick={() => {
                  const p = buildParams(1);
                  doSearch({ ...p, ...q.extra });
                  setSearched(true);
                }}
              >
                {q.label}
              </Tag>
            ))}
          </div>
        </div>

        <Divider style={{ margin: '0 0 24px' }} />

        {/* 结果区域 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" tip="搜索中..." />
          </div>
        ) : searched && tracks.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                未找到相关音乐
                <br />
                <Text type="secondary">试试调整关键词或筛选条件</Text>
              </span>
            }
          />
        ) : tracks.length > 0 ? (
          <>
            <div className="search-result-header">
              <Text strong>共 {pagination.total} 条结果</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                第 {(pagination.current - 1) * pagination.pageSize + 1}–
                {Math.min(pagination.current * pagination.pageSize, pagination.total)} 条
              </Text>
            </div>
            <Table
              columns={columns}
              dataSource={tracks}
              rowKey="id"
              loading={loading}
              className="search-result-table"
              pagination={{
                ...pagination,
                showSizeChanger: false,
                showTotal: (t) => `共 ${t} 首`,
                onChange: handlePaginationChange,
              }}
            />
          </>
        ) : (
          <div className="search-empty-hint">
            <InfoCircleOutlined style={{ fontSize: 32, color: '#667eea', marginBottom: 12 }} />
            <p>输入关键词或点击快捷标签开始搜索</p>
          </div>
        )}
      </Content>

      {/* 高级筛选 Drawer */}
      <Drawer
        title={
          <Space>
            <FilterOutlined />
            高级筛选
            {activeFilters > 0 && <Badge count={activeFilters} />}
          </Space>
        }
        placement="right"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        width={380}
        extra={
          <Button
            size="small"
            icon={<CloseOutlined />}
            onClick={() => {
              form.resetFields(['sample_rate_min', 'bit_depth']);
              setYearFilterEnabled(false);
              setDurationFilterEnabled(false);
              setSelectedTagIds([]);
              setActiveFilters(0);
            }}
          >
            清除全部
          </Button>
        }
        footer={
          <Button
            type="primary"
            block
            icon={<SearchOutlined />}
            onClick={() => {
              setFilterDrawerOpen(false);
              countActive();
              doSearch(buildParams(1));
            }}
          >
            应用并搜索
          </Button>
        }
      >
        <Form form={form} layout="vertical">

          {/* ── 音质 ── */}
          <Divider plain style={{ margin: '4px 0 12px' }}>音质</Divider>

          <Form.Item name="sample_rate_min" label="最低采样率" initialValue="">
            <Select options={SAMPLE_RATE_OPTIONS} />
          </Form.Item>

          <Form.Item name="bit_depth" label="位深度" initialValue="">
            <Select options={BIT_DEPTH_OPTIONS} />
          </Form.Item>

          {/* ── 发行年份 ── */}
          <Divider plain style={{ margin: '4px 0 12px' }}>发行年份</Divider>

          <div className="filter-toggle-row">
            <Checkbox
              checked={yearFilterEnabled}
              onChange={e => setYearFilterEnabled(e.target.checked)}
            >
              启用年份筛选
            </Checkbox>
            {yearFilterEnabled && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {yearRange[0]} – {yearRange[1]}
              </Text>
            )}
          </div>
          {yearFilterEnabled && (
            <Slider
              range
              min={2000}
              max={currentYear}
              value={yearRange}
              onChange={(v) => setYearRange(v as [number, number])}
              marks={{ 2000: '2000', [currentYear]: String(currentYear) }}
              style={{ marginTop: 12 }}
            />
          )}

          {/* ── 时长 ── */}
          <Divider plain style={{ margin: '16px 0 12px' }}>时长（分钟）</Divider>

          <div className="filter-toggle-row">
            <Checkbox
              checked={durationFilterEnabled}
              onChange={e => setDurationFilterEnabled(e.target.checked)}
            >
              启用时长筛选
            </Checkbox>
            {durationFilterEnabled && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {durationRange[0]} – {durationRange[1] >= 60 ? '60+' : durationRange[1]} 分钟
              </Text>
            )}
          </div>
          {durationFilterEnabled && (
            <Slider
              range
              min={0}
              max={60}
              value={durationRange}
              onChange={(v) => setDurationRange(v as [number, number])}
              marks={{ 0: '0', 5: '5', 15: '15', 30: '30', 60: '60+' }}
              style={{ marginTop: 12 }}
            />
          )}

          {/* ── 标签筛选 ── */}
          <Divider plain style={{ margin: '16px 0 12px' }}>
            <Space size={6}>
              <TagOutlined />
              标签筛选
              {selectedTagIds.length > 0 && (
                <Badge count={selectedTagIds.length} size="small" />
              )}
            </Space>
          </Divider>

          {selectedTagIds.length > 1 && (
            <div className="tag-logic-row">
              <Text type="secondary" style={{ fontSize: 12 }}>多标签关系：</Text>
              <Select
                size="small"
                value={tagLogic}
                onChange={setTagLogic}
                style={{ width: 80 }}
                options={[
                  { label: 'AND（全含）', value: 'AND' },
                  { label: 'OR（任含）', value: 'OR' },
                ]}
              />
            </div>
          )}

          <div className="tag-filter-area">
            {grouped.map(({ group, tags: groupTags }, gIdx) => (
              <Collapse
                key={gIdx}
                ghost
                size="small"
                defaultActiveKey={['0']}
                className="tag-group-collapse"
              >
                <Panel
                  key="0"
                  header={
                    <Space size={6}>
                      {group ? (
                        <>
                          <span>{group.icon || <FolderOutlined />}</span>
                          <Text strong style={{ fontSize: 13 }}>{group.name}</Text>
                        </>
                      ) : (
                        <Text strong style={{ fontSize: 13 }}>其他标签</Text>
                      )}
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        ({groupTags.length})
                      </Text>
                    </Space>
                  }
                >
                  <div className="tag-chip-list">
                    {groupTags.map(tag => {
                      const children = childMap[tag.id] || [];
                      const isSelected = selectedTagIds.includes(tag.id);
                      return (
                        <div key={tag.id} className="tag-chip-group">
                          {/* 父 Tag */}
                          <Tag
                            color={isSelected ? tag.color : undefined}
                            className={`tag-chip ${isSelected ? 'tag-chip--selected' : ''}`}
                            style={isSelected ? {} : { borderColor: tag.color, color: tag.color }}
                            onClick={() => toggleTag(tag.id)}
                          >
                            {tag.name}
                            {tag.track_count != null && (
                              <span className="tag-chip-count">{tag.track_count}</span>
                            )}
                          </Tag>
                          {/* 子 Tag */}
                          {children.length > 0 && (
                            <div className="tag-children-row">
                              {children.map(child => {
                                const childSelected = selectedTagIds.includes(child.id);
                                return (
                                  <Tag
                                    key={child.id}
                                    color={childSelected ? child.color : undefined}
                                    className={`tag-chip tag-chip--child ${childSelected ? 'tag-chip--selected' : ''}`}
                                    style={childSelected ? {} : { borderColor: child.color, color: child.color }}
                                    onClick={() => toggleTag(child.id)}
                                  >
                                    {child.name}
                                    {child.track_count != null && (
                                      <span className="tag-chip-count">{child.track_count}</span>
                                    )}
                                  </Tag>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              </Collapse>
            ))}
          </div>
        </Form>
      </Drawer>
    </Layout>
  );
};

export default Search;


