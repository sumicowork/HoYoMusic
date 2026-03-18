import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Select, Spin, Typography, Space, Badge, Button, message
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

// ── Storage analytics sub-component ──────────────────────────────
const StorageAnalytics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/storage')
      .then(r => setData(r.data.data))
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
    <Card title="💾 存储分析" className="analytics-card" style={{ marginTop: 16 }}>
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
  const [days, setDays] = useState(30);
  const [overview, setOverview]     = useState<any>(null);
  const [trend, setTrend]           = useState<any[]>([]);
  const [hourly, setHourly]         = useState<any[]>([]);
  const [countries, setCountries]   = useState<any[]>([]);
  const [pages, setPages]           = useState<any[]>([]);
  const [devices, setDevices]       = useState<any>({ browsers:[], oses:[], devices:[] });
  const [statusCodes, setStatus]    = useState<any[]>([]);
  const [perf, setPerf]             = useState<any[]>([]);
  const [recent, setRecent]         = useState<any[]>([]);
  const [referers, setReferers]     = useState<any[]>([]);
  const [cacheInfo, setCacheInfo]   = useState<any>(null);
  const [hotTracks, setHotTracks]   = useState<HotTrackRow[]>([]);
  const [selectedHotTrack, setSelectedHotTrack] = useState<HotTrackRow | null>(null);
  const [hotTrackIps, setHotTrackIps] = useState<HotTrackIpSourceRow[]>([]);
  const [hotTrackIpsLoading, setHotTrackIpsLoading] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [warming, setWarming]       = useState(false);
  const [lastRefresh, setLast]      = useState(new Date());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, tr, hr, cn, pg, dv, sc, pf, rc, rf, ch, ht] = await Promise.all([
        api.get('/analytics/overview'),
        api.get(`/analytics/trend?days=${days}`),
        api.get('/analytics/hourly'),
        api.get(`/analytics/countries?days=${days}`),
        api.get(`/analytics/pages?days=${days}`),
        api.get(`/analytics/devices?days=${days}`),
        api.get(`/analytics/status-codes?days=${days}`),
        api.get(`/analytics/performance?days=${days}`),
        api.get('/analytics/recent?limit=100'),
        api.get(`/analytics/referers?days=${days}`),
        api.get('/analytics/cache'),
        api.get(`/analytics/tracks/hot?days=${days}&limit=50`),
      ]);
      setOverview(ov.data.data);
      setTrend(tr.data.data);
      setHourly(hr.data.data);
      setCountries(cn.data.data);
      setPages(pg.data.data);
      setDevices(dv.data.data);
      setStatus(sc.data.data);
      setPerf(pf.data.data.map((r: any) => ({
        ...r,
        label: new Date(r.hour).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }),
      })));
      setRecent(rc.data.data);
      setReferers(rf.data.data);
      setCacheInfo(ch.data.data);
      setHotTracks(ht.data.data || []);
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

        {/* ── Header ── */}
        <div className="analytics-header">
          <Title level={3} style={{ margin: 0 }}>📊 访问统计</Title>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined /> 最后更新 {lastRefresh.toLocaleTimeString('zh-CN')}
            </Text>
            <Select value={days} onChange={v => setDays(v)} style={{ width: 120 }}>
              <Option value={1}>今日</Option>
              <Option value={7}>近 7 天</Option>
              <Option value={30}>近 30 天</Option>
              <Option value={90}>近 90 天</Option>
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
          </Space>
        </div>

        <Spin spinning={loading}>

          {/* ── Overview Cards ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {[
              { title: '总请求数',   value: overview?.total,    suffix: '次', icon: <ApiOutlined />,         color: '#667eea' },
              { title: '今日请求',   value: overview?.today,    suffix: '次', icon: <FireOutlined />,         color: '#f093fb' },
              { title: '7日独立IP', value: overview?.unique7d, suffix: '个', icon: <UserOutlined />,         color: '#4facfe' },
              { title: '今日错误',   value: overview?.errors,   suffix: '次', icon: <WarningOutlined />,      color: '#ff4d4f' },
              { title: '24h均响应', value: overview?.avgMs,    suffix: 'ms', icon: <ThunderboltOutlined />,  color: '#43e97b' },
            ].map((item, i) => (
              <Col xs={12} sm={12} md={8} lg={8} xl={24/5 as any} key={i}>
                <Card className="analytics-stat-card" size="small">
                  <Statistic
                    title={<span style={{ fontSize: 13 }}>{item.icon} {item.title}</span>}
                    value={item.value ?? '—'}
                    suffix={<span style={{ fontSize: 13 }}>{item.suffix}</span>}
                    valueStyle={{ color: item.color, fontSize: 24 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* ── Trend ── */}
          <Card title="📈 访客趋势" className="analytics-card">
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
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Row gutter={[16, 16]} style={{ margin: '16px 0' }}>
            {/* ── Hourly ── */}
            <Col xs={24} lg={14}>
              <Card title="🕐 今日小时分布" className="analytics-card" style={{ height: '100%' }}>
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
              <Card title="✅ HTTP 状态码分布" className="analytics-card" style={{ height: '100%' }}>
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
            {/* ── Countries ── */}
            <Col xs={24} lg={14}>
              <Card title="🌍 访客国家/地区 TOP 20" className="analytics-card">
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
                      tickFormatter={(v: string) => `${flag(v)} ${v}`}
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
              <Card title="💻 设备 & 浏览器" className="analytics-card">
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
              <Card title="🔥 歌曲热度（有效播放）" className="analytics-card">
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
          <Card title="⚡ 响应性能趋势" className="analytics-card" style={{ marginBottom: 16 }}>
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
              <Card title={<><FireOutlined /> 热门路径 TOP 50</>} className="analytics-card">
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
              <Card title={<><EyeOutlined /> 访问来源</>} className="analytics-card">
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
          <Card title="🧠 缓存详情分析" className="analytics-card" style={{ marginBottom: 16 }}>
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

          {/* ── Recent Logs ── */}
          <Card title="📋 最近请求记录" className="analytics-card">
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

        </Spin>
      </div>
    </AdminLayout>
  );
};

export default Analytics;






