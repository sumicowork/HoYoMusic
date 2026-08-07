import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Select, Spin, Typography, Space, Badge, Button, message, Modal, Divider
} from 'antd';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  Legend, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  UserOutlined, ApiOutlined, WarningOutlined,
  DesktopOutlined, MobileOutlined, ClockCircleOutlined, FireOutlined,
  ThunderboltOutlined, EyeOutlined, ReloadOutlined,
} from '@ant-design/icons';
import AdminLayout from '../components/AdminLayout';
import AdminPageHeader from '../components/admin/AdminPageHeader';
import AdminActionBar from '../components/admin/AdminActionBar';
import api from '../services/api';
import type { ColumnsType } from 'antd/es/table';
import './Analytics.css';

const { Title, Text } = Typography;
const { Option } = Select;

// ── helpers ──────────────────────────────────────────────────────
const flag = (cc: string) => {
  if (!cc || cc === 'Unknown' || cc === '?') return '🌐';
  try {
    return cc.toUpperCase().replace(/./g, c =>
      String.fromCodePoint(127397 + c.charCodeAt(0))
    );
  } catch { return '🌐'; }
};

const fmtTime = (ts: string) =>
  new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

const fmtBytesCompact = (v?: number) => {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${Math.round(n)} B`;
};

const STATUS_COLOR = (s: number) => {
  if (s < 300) return '#52c41a';
  if (s < 400) return '#faad14';
  if (s < 500) return '#ff7a45';
  return '#cf1322';
};

const PIE_COLORS = ['#667eea','#764ba2','#f093fb','#4facfe','#43e97b','#fa709a','#ffd700','#ff6b6b','#00f2fe'];

const DEVICE_ICON: Record<string, React.ReactNode> = {
  mobile:  <MobileOutlined />,
  tablet:  <MobileOutlined />,
  desktop: <DesktopOutlined />,
};

interface HotTrackRow {
  track_id: number;
  track_title: string;
  album_id: number | null;
  album_title: string | null;
  effective_plays: number;
  unique_ips: number;
  avg_played_seconds: number | null;
  last_played_at: string;
}

interface HotTrackIpSourceRow {
  ip: string;
  effective_plays: number;
  avg_played_seconds: number | null;
  last_played_at: string;
}

interface VisitorRow {
  visitor_key: string;
  visitor_id: string | null;
  latest_ip: string | null;
  requests: number;
  first_seen: string;
  last_seen: string;
  unique_paths: number;
}

interface VisitorBehaviorLog {
  ts: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  ip: string | null;
  visitor_id: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  referer: string | null;
  action_key: string;
  action_label: string;
  module: string;
  resource_type: string | null;
  resource_id: number | null;
  summary: string;
}

interface VisitorBehaviorSummary {
  totalRequests: number;
  errorRequests: number;
  errorRate: number;
  topActions: Array<{ action_key: string; action_label: string; count: number }>;
}

interface CountryDebugRow {
  country: string;
  region: string;
  city: string;
  requests: number;
  visitors: number;
  bucket: string;
}

interface BehaviorCoverageData {
  inventory: {
    total_routes: number;
    uncovered_count: number;
    uncovered_routes: Array<{ method: string; path: string; source: string }>;
  };
  behavior: {
    action_distribution: Array<{ action_key: string; action_label: string; module: string; count: number }>;
    unmapped_top: Array<{ method: string; path: string; count: number }>;
  };
}

type DataSourceType = 'esa' | 'sql' | 'unknown';

// ── Storage analytics sub-component ──────────────────────────────
const StorageAnalytics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [source, setSource] = useState<'esa' | 'sql' | 'unknown'>('unknown');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/storage')
      .then(r => {
        setData(r.data.data);
        const raw = String(r.data?.source || '').toLowerCase();
        setSource(raw === 'esa' ? 'esa' : 'sql');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  const fmtBytes = (b: number) => {
    if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`;
    if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
    return `${(b / 1024).toFixed(0)} KB`;
  };

  return (
    <Card
      title={<span>💾 存储分析<Tag style={{ marginInlineStart: 8, fontSize: 10 }} color={source === 'esa' ? 'blue' : 'default'}>{source.toUpperCase()}</Tag></span>}
      className="analytics-card"
      style={{ marginTop: 16 }}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Statistic title="总曲目" value={data.summary?.total_tracks || 0} /></Col>
        <Col span={6}><Statistic title="总存储" value={fmtBytes(Number(data.summary?.total_bytes || 0))} /></Col>
        <Col span={6}><Statistic title="平均大小" value={fmtBytes(Number(data.summary?.avg_file_size || 0))} /></Col>
        <Col span={6}><Statistic title="总时长(小时)" value={((data.summary?.total_duration || 0) / 3600).toFixed(1)} /></Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Title level={5}>按游戏分布</Title>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={(data.byGame || []).map((g: any) => ({ name: g.game_name, value: Number(g.total_bytes) }))}
                dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.name}>
                {(data.byGame || []).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <RechartTooltip formatter={(v: any) => fmtBytes(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Col>
        <Col span={12}>
          <Title level={5}>按专辑 Top 10</Title>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={(data.byAlbum || []).slice(0, 10).map((a: any) => ({ name: a.album_title?.substring(0, 15) || '?', bytes: Number(a.total_bytes) }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} fontSize={11} />
              <YAxis tickFormatter={(v: number) => fmtBytes(v)} fontSize={11} />
              <RechartTooltip formatter={(v: any) => fmtBytes(Number(v))} />
              <Bar dataKey="bytes" fill="#667eea" />
            </BarChart>
          </ResponsiveContainer>
        </Col>
      </Row>
      {data.qualityDistribution?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Title level={5}>音频质量分布</Title>
          <Table
            dataSource={data.qualityDistribution}
            rowKey={(r: any) => `${r.sample_rate}-${r.bit_depth}`}
            size="small"
            pagination={false}
            columns={[
              { title: '采样率', dataIndex: 'sample_rate', render: (v: number) => v ? `${(v/1000).toFixed(1)} kHz` : '未知' },
              { title: '位深', dataIndex: 'bit_depth', render: (v: number) => v ? `${v} bit` : '未知' },
              { title: '曲目数', dataIndex: 'count' },
            ]}
          />
        </div>
      )}
    </Card>
  );
};

// ── component ────────────────────────────────────────────────────
const Analytics: React.FC = () => {
  const [days, setDays] = useState(7);
  const [overview, setOverview]     = useState<any>(null);
  const [trend, setTrend]           = useState<any[]>([]);
  const [hourly, setHourly]         = useState<any[]>([]);
  const [countries, setCountries]   = useState<any[]>([]);
  const [pages, setPages]           = useState<any[]>([]);
  const [devices, setDevices]       = useState<any>({ browsers:[], oses:[], devices:[] });
  const [statusCodes, setStatus]    = useState<any[]>([]);
  const [cacheStatus, setCacheStatus] = useState<any[]>([]);
  const [cacheHitRate, setCacheHitRate] = useState<number | null>(null);
  const [perf, setPerf]             = useState<any[]>([]);
  const [recent, setRecent]         = useState<any[]>([]);
  const [referers, setReferers]     = useState<any[]>([]);
  const [cacheInfo, setCacheInfo]   = useState<any>(null);
  const [hotTracks, setHotTracks]   = useState<HotTrackRow[]>([]);
  const [selectedHotTrack, setSelectedHotTrack] = useState<HotTrackRow | null>(null);
  const [hotTrackIps, setHotTrackIps] = useState<HotTrackIpSourceRow[]>([]);
  const [hotTrackIpsLoading, setHotTrackIpsLoading] = useState(false);
  const [visitors, setVisitors]       = useState<VisitorRow[]>([]);
  const [visitorBehaviorLoading, setVisitorBehaviorLoading] = useState(false);
  const [visitorBehaviorLogs, setVisitorBehaviorLogs] = useState<VisitorBehaviorLog[]>([]);
  const [visitorBehaviorSummary, setVisitorBehaviorSummary] = useState<VisitorBehaviorSummary | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRow | null>(null);
  const [visitorBehaviorVisible, setVisitorBehaviorVisible] = useState(false);
  const [countryDebugVisible, setCountryDebugVisible] = useState(false);
  const [countryDebugLoading, setCountryDebugLoading] = useState(false);
  const [countryDebugRows, setCountryDebugRows] = useState<CountryDebugRow[]>([]);
  const [countryDebugSummary, setCountryDebugSummary] = useState<Array<{ bucket: string; requests: number; visitors: number }>>([]);
  const [behaviorCoverage, setBehaviorCoverage] = useState<BehaviorCoverageData | null>(null);
  const [dataSources, setDataSources] = useState<Record<string, DataSourceType>>({});
  const [loading, setLoading]       = useState(true);
  const [warming, setWarming]       = useState(false);
  const [lastRefresh, setLast]      = useState(new Date());
  const ANALYTICS_TIMEOUT_MS = 12000;
  const sourceTag = (key: string) => {
    const source = dataSources[key] || 'unknown';
    if (source === 'unknown') return <Tag style={{ marginInlineStart: 8, fontSize: 10 }}>UNKNOWN</Tag>;
    return (
      <Tag color={source === 'esa' ? 'blue' : 'default'} style={{ marginInlineStart: 8, fontSize: 10 }}>
        {source.toUpperCase()}
      </Tag>
    );
  };

  const withHardTimeout = <T,>(promise: Promise<T>, timeoutMs: number) =>
    Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), timeoutMs);
      }),
    ]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const requests = {
        overview: withHardTimeout(api.get('/analytics/overview', { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        trend: withHardTimeout(api.get(`/analytics/trend?days=${days}`, { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        hourly: withHardTimeout(api.get('/analytics/hourly', { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        countries: withHardTimeout(api.get(`/analytics/esa-logs/countries?days=${days}`, { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        pages: withHardTimeout(api.get(`/analytics/esa-logs/pages?days=${days}`, { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        devices: withHardTimeout(api.get(`/analytics/esa-logs/devices?days=${days}`, { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        statusCodes: withHardTimeout(api.get(`/analytics/esa-logs/status-codes?days=${days}`, { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        performance: withHardTimeout(api.get(`/analytics/performance?days=${days}`, { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        recent: withHardTimeout(api.get('/analytics/recent?limit=100', { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        referers: withHardTimeout(api.get(`/analytics/esa-logs/referers?days=${days}`, { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        esaCache: withHardTimeout(api.get(`/analytics/esa-logs/cache?days=${days}`, { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        esaOverview: withHardTimeout(api.get(`/analytics/esa-logs/overview?days=${days}`, { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        cache: withHardTimeout(api.get('/analytics/cache', { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        hotTracks: withHardTimeout(api.get(`/analytics/tracks/hot?days=${days}&limit=50`, { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        visitors: withHardTimeout(api.get(`/analytics/visitors?days=${days}&page=1&limit=50`, { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
        behaviorCoverage: withHardTimeout(api.get('/analytics/behavior/coverage', { timeout: ANALYTICS_TIMEOUT_MS }), ANALYTICS_TIMEOUT_MS),
      } as const;

      const keys = Object.keys(requests) as Array<keyof typeof requests>;
      const settled = await Promise.allSettled(keys.map((k) => requests[k]));
      const failedKeys: string[] = [];
      const nextSources: Record<string, DataSourceType> = {};

      const getData = (key: keyof typeof requests): any | null => {
        const idx = keys.indexOf(key);
        const result = settled[idx];
        if (result.status !== 'fulfilled') {
          failedKeys.push(String(key));
          nextSources[String(key)] = 'unknown';
          return null;
        }
        const rawSource = String((result.value as any)?.data?.source || '').toLowerCase();
        nextSources[String(key)] = rawSource.startsWith('esa') ? 'esa' : 'sql';
        return result.value.data?.data ?? null;
      };

      const overviewData = getData('overview');
      if (overviewData) setOverview(overviewData);

      const trendData = getData('trend');
      if (trendData) setTrend(trendData);

      const hourlyDataResp = getData('hourly');
      if (hourlyDataResp) setHourly(hourlyDataResp);

      const countriesData = getData('countries');
      if (countriesData) setCountries(countriesData);

      const pagesData = getData('pages');
      if (pagesData) setPages(pagesData);

      const devicesData = getData('devices');
      if (devicesData) setDevices(devicesData);

      const statusCodesData = getData('statusCodes');
      if (statusCodesData) setStatus(statusCodesData);

      const perfData = getData('performance');
      if (perfData) {
        setPerf(perfData.map((r: any) => ({
          ...r,
          label: new Date(r.hour).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }),
        })));
      }

      const recentData = getData('recent');
      if (recentData) setRecent(recentData);

      const referersData = getData('referers');
      if (referersData) setReferers(referersData);

      const esaCacheData = getData('esaCache');
      if (esaCacheData) setCacheStatus(esaCacheData);

      const esaOvData = getData('esaOverview');
      if (esaOvData) setCacheHitRate(esaOvData?.hit_rate ?? null);

      const cacheData = getData('cache');
      if (cacheData) setCacheInfo(cacheData);

      const hotTracksData = getData('hotTracks');
      if (hotTracksData) setHotTracks(hotTracksData || []);

      const visitorsData = getData('visitors');
      if (visitorsData) setVisitors(visitorsData?.visitors || []);

      const behaviorCoverageData = getData('behaviorCoverage');
      if (behaviorCoverageData) setBehaviorCoverage(behaviorCoverageData);

      if (failedKeys.length > 0) {
        message.warning(`部分统计加载失败：${failedKeys.join(', ')}`);
      }

      setDataSources((prev) => ({ ...prev, ...nextSources }));

      setLast(new Date());
    } catch (e) {
      console.error('[Analytics]', e);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    setSelectedHotTrack(null);
    setHotTrackIps([]);
  }, [days]);

  const fetchHotTrackIps = async (track: HotTrackRow) => {
    setSelectedHotTrack(track);
    setHotTrackIpsLoading(true);
    try {
      const response = await api.get(`/analytics/tracks/${track.track_id}/ip-sources?days=${days}`);
      setHotTrackIps(response.data?.data?.ipSources || []);
    } catch (e) {
      console.error('[Analytics hot track ips]', e);
      message.error('加载来源 IP 失败');
      setHotTrackIps([]);
    } finally {
      setHotTrackIpsLoading(false);
    }
  };

  const fetchVisitorBehavior = async (visitor: VisitorRow) => {
    setSelectedVisitor(visitor);
    setVisitorBehaviorVisible(true);
    setVisitorBehaviorLoading(true);
    try {
      const response = await api.get(`/analytics/visitors/${encodeURIComponent(visitor.visitor_key)}/behavior?days=${days}&limit=200`);
      setVisitorBehaviorLogs(response.data?.data?.logs || []);
      setVisitorBehaviorSummary(response.data?.data?.summary || null);
    } catch (e) {
      console.error('[Analytics visitor behavior]', e);
      message.error('加载访客行为失败');
      setVisitorBehaviorLogs([]);
      setVisitorBehaviorSummary(null);
    } finally {
      setVisitorBehaviorLoading(false);
    }
  };

  const fetchCountryDebug = async () => {
    setCountryDebugVisible(true);
    setCountryDebugLoading(true);
    try {
      const resp = await api.get(`/analytics/countries/debug?days=${days}&limit=1500`);
      const data = resp.data?.data;
      setCountryDebugRows(data?.unmappedChina || []);
      setCountryDebugSummary(data?.bucketSummary || []);
    } catch (e) {
      console.error('[Analytics countries debug]', e);
      message.error('地区映射诊断加载失败');
      setCountryDebugRows([]);
      setCountryDebugSummary([]);
    } finally {
      setCountryDebugLoading(false);
    }
  };

  const handleWarmup = async () => {
    setWarming(true);
    try {
      const result = await api.post('/analytics/cache/warmup');
      setCacheInfo(result.data.data);
      const remoteWarmup = result?.data?.data?.remoteWarmup;
      if (remoteWarmup) {
        message.success(
          `预热完成：封面拉取 ${remoteWarmup.covers?.fetched || 0}/${remoteWarmup.covers?.checked || 0}，歌词拉取 ${remoteWarmup.lyrics?.fetched || 0}/${remoteWarmup.lyrics?.checked || 0}`
        );
      } else {
        message.success('缓存已刷新并完成预热');
      }
      await fetchAll();
    } catch (e) {
      console.error('[Analytics warmup]', e);
      message.error('缓存预热失败，请稍后重试');
    } finally {
      setWarming(false);
    }
  };

  // ── columns ──────────────────────────────────────────────────
  const recentCols: ColumnsType<any> = [
    { title: '时间', dataIndex: 'ts', width: 155, fixed: 'left',
      render: v => <Text style={{ fontSize: 12 }}>{fmtTime(v)}</Text> },
    { title: 'IP', dataIndex: 'ip', width: 130,
      render: v => <Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>{v}</Text> },
    { title: 'Visitor ID', dataIndex: 'visitor_id', width: 220,
      render: v => v
        ? <Text copyable style={{ fontSize: 11, fontFamily: 'monospace' }}>{v}</Text>
        : <Text type="secondary" style={{ fontSize: 11 }}>未上报（回退IP）</Text> },
    { title: '位置', key: 'loc', width: 120,
      render: (_, r) => <span style={{ fontSize: 12 }}>{flag(r.country)} {r.city || r.country || '-'}</span> },
    { title: '方法', dataIndex: 'method', width: 68,
      render: v => <Tag color={v==='GET'?'blue':v==='POST'?'green':v==='DELETE'?'red':'orange'} style={{ fontSize:11 }}>{v}</Tag> },
    { title: '路径', dataIndex: 'path', ellipsis: true,
      render: v => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{v}</Text> },
    { title: '状态', dataIndex: 'status', width: 68, align: 'center',
      render: v => <Tag color={v<300?'success':v<400?'warning':v<500?'orange':'error'} style={{ fontSize:11 }}>{v}</Tag> },
    { title: '耗时', dataIndex: 'duration_ms', width: 80, align: 'right',
      render: v => <span style={{ fontSize:12, color: v>1000?'#ff4d4f':v>300?'#faad14':undefined }}>{v}ms</span> },
    { title: '设备', key: 'dev', width: 120,
      render: (_, r) => <span style={{ fontSize: 12 }}>{DEVICE_ICON[r.ua_device] || <DesktopOutlined />} {r.ua_browser}</span> },
    { title: '来源', dataIndex: 'referer', ellipsis: true, width: 150,
      render: v => <Text style={{ fontSize: 11 }} type="secondary">{v || 'Direct'}</Text> },
  ];

  const pageCols: ColumnsType<any> = [
    { title: '路径', dataIndex: 'path', ellipsis: true,
      render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
    { title: '请求数', dataIndex: 'hits', width: 90, align: 'right',
      sorter: (a,b) => a.hits - b.hits, defaultSortOrder: 'descend' },
    { title: '独立访客', dataIndex: 'visitors', width: 90, align: 'right' },
    { title: '平均响应', dataIndex: 'avg_ms', width: 100, align: 'right',
      render: v => <span style={{ color: v>500?'#ff4d4f':v>200?'#faad14':undefined }}>{v}ms</span> },
    { title: 'P95', dataIndex: 'p95_ms', width: 90, align: 'right',
      render: v => `${v}ms` },
    { title: '错误数', dataIndex: 'errors', width: 80, align: 'right',
      render: v => v > 0
        ? <Badge count={v} style={{ backgroundColor: '#ff4d4f' }} />
        : <Text type="success" style={{ fontSize:12 }}>0</Text> },
  ];

  // build full 24-hour bar data
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2,'0')}时`,
    requests: hourly.find(r => r.hour === h)?.requests || 0,
    visitors: hourly.find(r => r.hour === h)?.visitors || 0,
  }));

  return (
    <AdminLayout>
      <div className="analytics-page">

        <AdminPageHeader
          title="访问统计"
          description="集中查看访问趋势、热点内容、终端分布与请求质量。"
          actions={(
            <AdminActionBar>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined /> 最后更新 {lastRefresh.toLocaleTimeString('zh-CN')}
            </Text>
            <Select value={days} onChange={v => setDays(v)} style={{ width: 120 }}>
              <Option value={7}>近 7 天</Option>
            </Select>
            <Tag
              icon={<ReloadOutlined />}
              color="blue"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={fetchAll}
            >刷新</Tag>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={warming}
              onClick={handleWarmup}
            >
              一键刷新预热
            </Button>
            <Button onClick={fetchCountryDebug}>地区映射诊断</Button>
            </AdminActionBar>
          )}
        />

        <Spin spinning={loading}>

          {/* ── Overview Cards ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {[
              { title: '总请求数',   value: overview?.total,    suffix: '次', icon: <ApiOutlined />,         color: '#667eea' },
              { title: '今日请求',   value: overview?.today,    suffix: '次', icon: <FireOutlined />,         color: '#f093fb' },
              { title: '7日独立访客', value: overview?.unique7d, suffix: '个', icon: <UserOutlined />,         color: '#4facfe' },
              { title: '今日页面浏览', value: overview?.pageView, suffix: '次', icon: <EyeOutlined />,          color: '#13c2c2' },
              { title: '响应流量',   value: overview?.traffic,  suffix: '',   icon: <ThunderboltOutlined />,  color: '#722ed1', formatter: (v: number) => fmtBytesCompact(v) },
              { title: '请求流量',   value: overview?.requestTraffic, suffix: '', icon: <ThunderboltOutlined />, color: '#2f54eb', formatter: (v: number) => fmtBytesCompact(v) },
              { title: '今日错误',   value: overview?.errors,   suffix: '次', icon: <WarningOutlined />,      color: '#ff4d4f' },
              { title: '24h均响应', value: overview?.avgMs,    suffix: 'ms', icon: <ThunderboltOutlined />,  color: '#43e97b' },
            ].map((item, i) => (
              <Col xs={12} sm={12} md={8} lg={8} xl={6} key={i}>
                <Card className="analytics-stat-card" size="small">
                  <Statistic
                    title={<span style={{ fontSize: 13 }}>{item.icon} {item.title}{sourceTag('overview')}</span>}
                    value={item.value ?? '—'}
                    suffix={<span style={{ fontSize: 13 }}>{item.suffix}</span>}
                    formatter={item.formatter as any}
                    valueStyle={{ color: item.color, fontSize: 24 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* ── Trend ── */}
          <Card title={<span>📈 访客趋势{sourceTag('trend')}</span>} className="analytics-card">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ right: 20 }}>
                <defs>
                  <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#667eea" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradVis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f093fb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f093fb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v?.slice(5) ?? ''} />
                <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                <RechartTooltip />
                <Legend />
                <Area yAxisId="l" type="monotone" dataKey="requests" name="请求数"
                  stroke="#667eea" fill="url(#gradReq)" strokeWidth={2} dot={false} />
                <Area yAxisId="r" type="monotone" dataKey="visitors" name="独立访客"
                  stroke="#f093fb" fill="url(#gradVis)" strokeWidth={2} dot={false} />
                <Line yAxisId="r" type="monotone" dataKey="pageView" name="页面浏览"
                  stroke="#13c2c2" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>

            <Divider style={{ margin: '12px 0' }} />

            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend} margin={{ right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v?.slice(5) ?? ''} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtBytesCompact(v)} />
                <RechartTooltip formatter={(v: any) => fmtBytesCompact(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="traffic" name="响应流量" stroke="#722ed1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="requestTraffic" name="请求流量" stroke="#2f54eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Row gutter={[16, 16]} style={{ margin: '16px 0' }}>
            {/* ── Hourly ── */}
            <Col xs={24} lg={14}>
              <Card title={<span>🕐 今日小时分布{sourceTag('hourly')}</span>} className="analytics-card" style={{ height: '100%' }}>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={hourlyData} margin={{ right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartTooltip />
                    <Legend />
                    <Bar dataKey="requests" name="请求数" fill="#667eea" radius={[3,3,0,0]} />
                    <Bar dataKey="visitors" name="独立访客" fill="#f093fb" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            {/* ── Status Codes ── */}
            <Col xs={24} lg={10}>
              <Card title={<span>✅ HTTP 状态码分布{sourceTag('statusCodes')}</span>} className="analytics-card" style={{ height: '100%' }}>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie
                      data={statusCodes}
                      dataKey="value" nameKey="name"
                      cx="45%" cy="50%"
                      outerRadius={85}
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {statusCodes.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLOR(parseInt(entry.name))} />
                      ))}
                    </Pie>
                    <RechartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {/* ── Edge Cache Status ── */}
            <Col xs={24} lg={10}>
              <Card title={<span>🗂️ 边缘缓存命中（music 子域）{sourceTag('esaCache')}</span>} className="analytics-card" style={{ height: '100%' }}>
                {cacheHitRate !== null && (
                  <div style={{ textAlign: 'center', marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 30 }}>{cacheHitRate}%</Text>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>可缓存对象命中率</Text>
                  </div>
                )}
                <ResponsiveContainer width="100%" height={cacheHitRate !== null ? 170 : 230}>
                  <BarChart data={cacheStatus} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} width={95} />
                    <RechartTooltip />
                    <Bar dataKey="requests" name="请求数" fill="#5ee7df" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            {/* ── Countries ── */}
            <Col xs={24} lg={14}>
              <Card title={<span>🌍 中国省级行政区 / 其他{sourceTag('countries')}</span>} className="analytics-card">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={countries.slice(0, 20)}
                    layout="vertical"
                    margin={{ left: 20, right: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category" dataKey="country"
                      tick={{ fontSize: 12 }} width={55}
                      tickFormatter={(v: string) => v}
                    />
                    <RechartTooltip />
                    <Legend />
                    <Bar dataKey="visitors" name="独立访客" fill="#4facfe" radius={[0,3,3,0]} />
                    <Bar dataKey="requests" name="请求数"  fill="#667eea" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            {/* ── Devices ── */}
            <Col xs={24} lg={10}>
              <Card title={<span>💻 设备 & 浏览器{sourceTag('devices')}</span>} className="analytics-card">
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>设备类型</Text>
                </div>
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie
                      data={devices.devices}
                      dataKey="value" nameKey="name"
                      cx="50%" cy="50%"
                      outerRadius={45}
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name} ${((percent ?? 0)*100).toFixed(0)}%`}
                    >
                      {devices.devices.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartTooltip />
                  </PieChart>
                </ResponsiveContainer>

                <Row gutter={8} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>浏览器</Text>
                    {devices.browsers.slice(0, 5).map((b: any, i: number) => (
                      <div key={i} className="analytics-ua-row">
                        <span className="analytics-ua-name">{b.name}</span>
                        <Tag style={{ fontSize: 11 }}>{b.value}</Tag>
                      </div>
                    ))}
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>操作系统</Text>
                    {devices.oses.slice(0, 5).map((o: any, i: number) => (
                      <div key={i} className="analytics-ua-row">
                        <span className="analytics-ua-name">{o.name}</span>
                        <Tag style={{ fontSize: 11 }}>{o.value}</Tag>
                      </div>
                    ))}
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={15}>
              <Card title={<span>🔥 歌曲热度（有效播放）{sourceTag('hotTracks')}</span>} className="analytics-card">
                <Table
                  size="small"
                  rowKey="track_id"
                  dataSource={hotTracks}
                  pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }}
                  columns={[
                    {
                      title: '歌曲',
                      dataIndex: 'track_title',
                      ellipsis: true,
                      render: (v: string, r: HotTrackRow) => (
                        <div>
                          <div style={{ fontWeight: 500 }}>{v}</div>
                          <Text type="secondary" style={{ fontSize: 12 }}>{r.album_title || '-'}</Text>
                        </div>
                      ),
                    },
                    {
                      title: '有效播放',
                      dataIndex: 'effective_plays',
                      width: 92,
                      align: 'right',
                      sorter: (a: HotTrackRow, b: HotTrackRow) => a.effective_plays - b.effective_plays,
                      defaultSortOrder: 'descend',
                    },
                    { title: '独立IP', dataIndex: 'unique_ips', width: 82, align: 'right' },
                    {
                      title: '均播放秒数',
                      dataIndex: 'avg_played_seconds',
                      width: 100,
                      align: 'right',
                      render: (v: number | null) => (v == null ? '-' : `${Number(v).toFixed(1)}s`),
                    },
                    {
                      title: '来源IP',
                      width: 96,
                      render: (_: any, r: HotTrackRow) => (
                        <Button size="small" onClick={() => fetchHotTrackIps(r)}>查看</Button>
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>

            <Col xs={24} lg={9}>
              <Card
                title={selectedHotTrack ? `来源 IP - ${selectedHotTrack.track_title}` : '来源 IP 明细'}
                className="analytics-card"
              >
                <Table
                  size="small"
                  loading={hotTrackIpsLoading}
                  rowKey={(r: HotTrackIpSourceRow, i?: number) => `${r.ip}-${i}`}
                  dataSource={hotTrackIps}
                  pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
                  locale={{ emptyText: selectedHotTrack ? '暂无有效播放来源 IP' : '请先选择左侧歌曲' }}
                  columns={[
                    {
                      title: 'IP',
                      dataIndex: 'ip',
                      render: (v: string) => <Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>{v || '-'}</Text>,
                    },
                    { title: '有效播放', dataIndex: 'effective_plays', width: 80, align: 'right' },
                    {
                      title: '均秒数',
                      dataIndex: 'avg_played_seconds',
                      width: 80,
                      align: 'right',
                      render: (v: number | null) => (v == null ? '-' : `${Number(v).toFixed(1)}s`),
                    },
                    {
                      title: '最后时间',
                      dataIndex: 'last_played_at',
                      width: 140,
                      render: (v: string) => <Text style={{ fontSize: 12 }}>{fmtTime(v)}</Text>,
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>

          {/* ── Performance ── */}
          <Card title={<span>⚡ 响应性能趋势{sourceTag('performance')}</span>} className="analytics-card" style={{ marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={perf} margin={{ right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(perf.length / 14))} />
                <YAxis tick={{ fontSize: 11 }} unit="ms" />
                <RechartTooltip formatter={(v: any) => `${v}ms`} />
                <Legend />
                <Line type="monotone" dataKey="avg_ms" name="均值" stroke="#43e97b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p95_ms" name="P95"  stroke="#fa709a" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                <Line type="monotone" dataKey="max_ms" name="最大" stroke="#ff4d4f" strokeWidth={1} dot={false} strokeDasharray="2 4" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {/* ── Top Pages ── */}
            <Col xs={24} lg={16}>
              <Card title={<><FireOutlined /> 热门路径 TOP 50{sourceTag('pages')}</>} className="analytics-card">
                <Table
                  columns={pageCols}
                  dataSource={pages}
                  rowKey="path"
                  size="small"
                  pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }}
                />
              </Card>
            </Col>

            {/* ── Referers ── */}
            <Col xs={24} lg={8}>
              <Card title={<><EyeOutlined /> 访问来源{sourceTag('referers')}</>} className="analytics-card">
                {referers.map((r: any, i: number) => (
                  <div key={i} className="analytics-referer-row">
                    <Text ellipsis style={{ fontSize: 12, flex: 1 }}
                      title={r.referer}>{r.referer}</Text>
                    <Tag style={{ fontSize: 11, flexShrink: 0 }}>{r.hits}</Tag>
                  </div>
                ))}
              </Card>
            </Col>
          </Row>

          {/* ── Cache Analytics ── */}
          <Card title={<span>🧠 缓存详情分析{sourceTag('cache')}</span>} className="analytics-card" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
              <Col xs={12} sm={8} lg={6}>
                <Statistic title="应用缓存条目" value={cacheInfo?.appCache?.entries ?? 0} />
              </Col>
              <Col xs={12} sm={8} lg={6}>
                <Statistic title="应用缓存命中率" value={cacheInfo?.appCache?.hitRate ?? 'N/A'} />
              </Col>
              <Col xs={12} sm={8} lg={6}>
                <Statistic title="远程缓存文件" value={cacheInfo?.remoteCache?.totalFiles ?? 0} />
              </Col>
              <Col xs={12} sm={8} lg={6}>
                <Statistic title="远程缓存命中率" value={cacheInfo?.remoteCache?.hitRate ?? 'N/A'} />
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="key"
                  dataSource={cacheInfo?.appCache?.entriesDetail || []}
                  title={() => '应用缓存热点 Key（按体积）'}
                  columns={[
                    { title: 'Key', dataIndex: 'key', ellipsis: true, render: (v: string) => <Text code>{v}</Text> },
                    { title: '剩余TTL', dataIndex: 'expiresInMs', width: 100, align: 'right', render: (v: number) => `${Math.round(v / 1000)}s` },
                    { title: '估算大小', dataIndex: 'approxBytes', width: 110, align: 'right', render: (v: number) => `${Math.round(v / 1024)} KB` },
                  ]}
                />
              </Col>
              <Col xs={24} lg={12}>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="category"
                  dataSource={[
                    {
                      category: 'covers',
                      files: cacheInfo?.remoteCache?.covers?.files || 0,
                      totalBytes: cacheInfo?.remoteCache?.covers?.totalBytes || 0,
                    },
                    {
                      category: 'lyrics',
                      files: cacheInfo?.remoteCache?.lyrics?.files || 0,
                      totalBytes: cacheInfo?.remoteCache?.lyrics?.totalBytes || 0,
                    },
                  ]}
                  title={() => '远程代理本地缓存占用'}
                  columns={[
                    { title: '分类', dataIndex: 'category', width: 100 },
                    { title: '文件数', dataIndex: 'files', width: 90, align: 'right' },
                    { title: '体积', dataIndex: 'totalBytes', align: 'right', render: (v: number) => `${(v / 1024 / 1024).toFixed(2)} MB` },
                  ]}
                />
              </Col>
            </Row>
          </Card>

          <Card title={<span>🧭 Visitor 列表{sourceTag('visitors')}</span>} className="analytics-card" style={{ marginBottom: 16 }}>
            <Table
              size="small"
              rowKey="visitor_key"
              dataSource={visitors}
              pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }}
              columns={[
                {
                  title: 'Visitor Key',
                  dataIndex: 'visitor_key',
                  width: 220,
                  render: (v: string) => <Text copyable style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Text>,
                },
                {
                  title: '最新IP',
                  dataIndex: 'latest_ip',
                  width: 130,
                  render: (v: string | null) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '-'}</Text>,
                },
                { title: '请求数', dataIndex: 'requests', width: 90, align: 'right' },
                { title: '独立路径', dataIndex: 'unique_paths', width: 90, align: 'right' },
                {
                  title: '首次访问',
                  dataIndex: 'first_seen',
                  width: 155,
                  render: (v: string) => <Text style={{ fontSize: 12 }}>{fmtTime(v)}</Text>,
                },
                {
                  title: '最近访问',
                  dataIndex: 'last_seen',
                  width: 155,
                  render: (v: string) => <Text style={{ fontSize: 12 }}>{fmtTime(v)}</Text>,
                },
                {
                  title: '行为',
                  width: 100,
                  render: (_: unknown, r: VisitorRow) => (
                    <Button size="small" onClick={() => fetchVisitorBehavior(r)}>查看行为</Button>
                  ),
                },
              ]}
            />
          </Card>

          <Card title={<span>🧪 行为分类覆盖诊断{sourceTag('behaviorCoverage')}</span>} className="analytics-card" style={{ marginBottom: 16 }}>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={8}><Statistic title="接口总数" value={behaviorCoverage?.inventory?.total_routes || 0} /></Col>
              <Col span={8}><Statistic title="未命中接口" value={behaviorCoverage?.inventory?.uncovered_count || 0} /></Col>
              <Col span={8}><Statistic title="未映射行为样本" value={(behaviorCoverage?.behavior?.unmapped_top || []).length} /></Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Table
                  size="small"
                  rowKey={(r: any, i?: number) => `${r.method}-${r.path}-${i}`}
                  pagination={{ pageSize: 6, size: 'small' }}
                  dataSource={behaviorCoverage?.behavior?.unmapped_top || []}
                  columns={[
                    { title: 'Method', dataIndex: 'method', width: 90 },
                    { title: 'Path', dataIndex: 'path', ellipsis: true },
                    { title: '次数', dataIndex: 'count', width: 80, align: 'right' },
                  ]}
                />
              </Col>
              <Col span={12}>
                <Table
                  size="small"
                  rowKey={(r: any, i?: number) => `${r.method}-${r.path}-${r.source}-${i}`}
                  pagination={{ pageSize: 6, size: 'small' }}
                  dataSource={behaviorCoverage?.inventory?.uncovered_routes || []}
                  columns={[
                    { title: 'Method', dataIndex: 'method', width: 90 },
                    { title: 'Path', dataIndex: 'path', ellipsis: true },
                    { title: '来源', dataIndex: 'source', width: 130, ellipsis: true },
                  ]}
                />
              </Col>
            </Row>
          </Card>

          {/* ── Recent Logs ── */}
          <Card title={<span>📋 最近请求记录{sourceTag('recent')}</span>} className="analytics-card">
            <Table
              columns={recentCols}
              dataSource={recent}
              rowKey="id"
              size="small"
              scroll={{ x: 1100 }}
              pagination={{ pageSize: 20, size: 'small', showSizeChanger: true }}
              rowClassName={r => r.status >= 500 ? 'analytics-row-error' : r.status >= 400 ? 'analytics-row-warn' : ''}
            />
          </Card>

          {/* ── Storage Analytics ── */}
          <StorageAnalytics />

          <Modal
            title={selectedVisitor ? `Visitor 行为 - ${selectedVisitor.visitor_key}` : 'Visitor 行为'}
            open={visitorBehaviorVisible}
            onCancel={() => {
              setVisitorBehaviorVisible(false);
              setVisitorBehaviorSummary(null);
            }}
            footer={<Button onClick={() => setVisitorBehaviorVisible(false)}>关闭</Button>}
            width={980}
          >
            {visitorBehaviorSummary && (
              <Row gutter={12} style={{ marginBottom: 12 }}>
                <Col span={8}><Statistic title="总请求" value={visitorBehaviorSummary.totalRequests} /></Col>
                <Col span={8}><Statistic title="异常请求" value={visitorBehaviorSummary.errorRequests} /></Col>
                <Col span={8}><Statistic title="异常率" value={`${visitorBehaviorSummary.errorRate}%`} /></Col>
                <Col span={24}>
                  <Space wrap>
                    {(visitorBehaviorSummary.topActions || []).map((item) => (
                      <Tag key={item.action_key} color="blue">{item.action_label} x {item.count}</Tag>
                    ))}
                  </Space>
                </Col>
              </Row>
            )}
            <Table
              size="small"
              loading={visitorBehaviorLoading}
              rowKey={(r: VisitorBehaviorLog, i?: number) => `${r.ts}-${r.path}-${i}`}
              dataSource={visitorBehaviorLogs}
              pagination={{ pageSize: 12, size: 'small', showSizeChanger: false }}
              columns={[
                { title: '时间', dataIndex: 'ts', width: 160, render: (v: string) => fmtTime(v) },
                { title: '行为', dataIndex: 'summary', width: 220, ellipsis: true },
                { title: '模块', dataIndex: 'module', width: 100 },
                { title: '路径', dataIndex: 'path', width: 260, ellipsis: true },
                { title: '方法', dataIndex: 'method', width: 70 },
                { title: '状态', dataIndex: 'status', width: 70, align: 'center' },
                { title: '耗时', dataIndex: 'duration_ms', width: 80, align: 'right', render: (v: number) => `${v}ms` },
                { title: 'IP', dataIndex: 'ip', width: 140, render: (v: string | null) => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v || '-'}</Text> },
              ]}
            />
          </Modal>

          <Modal
            title="中国省份映射诊断（无需手动查库）"
            open={countryDebugVisible}
            onCancel={() => setCountryDebugVisible(false)}
            footer={<Button onClick={() => setCountryDebugVisible(false)}>关闭</Button>}
            width={1100}
          >
            <Spin spinning={countryDebugLoading}>
              <Card size="small" title="当前桶汇总（按请求数）" style={{ marginBottom: 12 }}>
                <Table
                  size="small"
                  rowKey="bucket"
                  pagination={{ pageSize: 6, size: 'small' }}
                  dataSource={countryDebugSummary}
                  columns={[
                    { title: '桶', dataIndex: 'bucket' },
                    { title: '请求数', dataIndex: 'requests', width: 100, align: 'right' },
                    { title: '访客数', dataIndex: 'visitors', width: 100, align: 'right' },
                  ]}
                />
              </Card>

              <Card size="small" title="中国其他（未命中映射）样本 Top 200">
                <Table
                  size="small"
                  rowKey={(r: CountryDebugRow, i?: number) => `${r.country}-${r.region}-${r.city}-${i}`}
                  pagination={{ pageSize: 10, size: 'small' }}
                  dataSource={countryDebugRows}
                  columns={[
                    { title: 'country', dataIndex: 'country', width: 90 },
                    { title: 'region(原始)', dataIndex: 'region', width: 180, render: (v: string) => <Text code>{v || '(空)'}</Text> },
                    { title: 'city(原始)', dataIndex: 'city', width: 180, render: (v: string) => <Text code>{v || '(空)'}</Text> },
                    { title: '映射结果', dataIndex: 'bucket', width: 120 },
                    { title: '请求数', dataIndex: 'requests', width: 90, align: 'right' },
                    { title: '访客数', dataIndex: 'visitors', width: 90, align: 'right' },
                  ]}
                />
              </Card>
            </Spin>
          </Modal>

        </Spin>
      </div>
    </AdminLayout>
  );
};

export default Analytics;






