import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, message, Space, Typography, Divider, Switch, InputNumber, Table, Tag, Modal, Upload, Alert, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LockOutlined, ExportOutlined, DatabaseOutlined, MailOutlined, ToolOutlined, UploadOutlined, UndoOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import AdminLayout from '../components/AdminLayout';
import api from '../services/api';
import {
  trackService,
  type CatalogMetadataImportPayload,
  type CatalogMetadataImportResult,
  type CatalogMetadataImportItem,
} from '../services/trackService';
import {
  musicSourceService,
  type MusicSourceConflictMode,
  type MusicSourceExportScope,
  type MusicSourceImportCommitResult,
  type MusicSourceImportEntry,
  type MusicSourceImportItem,
  type MusicSourceImportPreviewResult,
} from '../services/musicSourceService';
import {
  siteConfigService,
  type FirstVisitModalConfig,
  type SiteComplianceConfig,
  type MaintenanceModeConfig,
} from '../services/siteConfigService';
import { feedbackService, type FeedbackItem } from '../services/feedbackService';

const { Title, Text } = Typography;

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceSaving, setComplianceSaving] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [testEmailVisible, setTestEmailVisible] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackPagination, setFeedbackPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [catalogJsonText, setCatalogJsonText] = useState('');
  const [catalogParseError, setCatalogParseError] = useState<string | null>(null);
  const [catalogPayload, setCatalogPayload] = useState<CatalogMetadataImportPayload | null>(null);
  const [catalogSourceName, setCatalogSourceName] = useState<string | null>(null);
  const [catalogSyncLegacyTitle, setCatalogSyncLegacyTitle] = useState(false);
  const [catalogExporting, setCatalogExporting] = useState(false);
  const [catalogPreviewLoading, setCatalogPreviewLoading] = useState(false);
  const [catalogCommitLoading, setCatalogCommitLoading] = useState(false);
  const [catalogRollbackLoading, setCatalogRollbackLoading] = useState(false);
  const [catalogPreviewResult, setCatalogPreviewResult] = useState<CatalogMetadataImportResult | null>(null);
  const [catalogCommittedBatchUuid, setCatalogCommittedBatchUuid] = useState<string | null>(null);
  const [catalogRollbackBatchUuid, setCatalogRollbackBatchUuid] = useState('');
  const [musicSourceJsonText, setMusicSourceJsonText] = useState('');
  const [musicSourceParseError, setMusicSourceParseError] = useState<string | null>(null);
  const [musicSourceSourceName, setMusicSourceSourceName] = useState<string | null>(null);
  const [musicSourceEntries, setMusicSourceEntries] = useState<MusicSourceImportEntry[]>([]);
  const [musicSourceConflictMode, setMusicSourceConflictMode] = useState<MusicSourceConflictMode>('overwrite');
  const [musicSourcePreviewLoading, setMusicSourcePreviewLoading] = useState(false);
  const [musicSourceCommitLoading, setMusicSourceCommitLoading] = useState(false);
  const [musicSourceExportLoading, setMusicSourceExportLoading] = useState(false);
  const [musicSourcePreviewResult, setMusicSourcePreviewResult] = useState<MusicSourceImportPreviewResult | null>(null);
  const [musicSourceCommitResult, setMusicSourceCommitResult] = useState<MusicSourceImportCommitResult | null>(null);
  const [musicSourceExportScope, setMusicSourceExportScope] = useState<MusicSourceExportScope>('all');
  const [musicSourceExportGameIdsText, setMusicSourceExportGameIdsText] = useState('');
  const [musicSourceExportAlbumIdsText, setMusicSourceExportAlbumIdsText] = useState('');
  const [form] = Form.useForm();
  const [modalForm] = Form.useForm();
  const [complianceForm] = Form.useForm();
  const [maintenanceForm] = Form.useForm();
  const [testEmailForm] = Form.useForm();

  const toLocalDatetime = (isoValue: string | null | undefined): string | null => {
    if (!isoValue) return null;
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return null;
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const toIsoDatetime = (localValue: string | null | undefined): string | null => {
    if (!localValue) return null;
    const date = new Date(localValue);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const feedbackColumns: ColumnsType<FeedbackItem> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '反馈内容',
      dataIndex: 'content',
      key: 'content',
      render: (value: string) => <div style={{ whiteSpace: 'pre-wrap' }}>{value}</div>,
    },
    {
      title: '联系方式',
      dataIndex: 'contact',
      key: 'contact',
      width: 180,
      render: (value: string | null) => value || <Tag>未填写</Tag>,
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (value: string | null) => value || '—',
    },
  ];

  const catalogPreviewColumns: ColumnsType<CatalogMetadataImportItem> = [
    {
      title: '类型',
      dataIndex: 'entity_type',
      key: 'entity_type',
      width: 90,
      render: (value: string) => value === 'album' ? '专辑' : '曲目',
    },
    {
      title: 'UUID',
      dataIndex: 'uuid',
      key: 'uuid',
      width: 260,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        if (status === 'updated') return <Tag color="green">updated</Tag>;
        if (status === 'not_found') return <Tag color="red">not_found</Tag>;
        return <Tag>skipped</Tag>;
      },
    },
    {
      title: '说明',
      dataIndex: 'reason',
      key: 'reason',
      render: (value?: string) => value || '—',
    },
  ];

  const musicSourceColumns: ColumnsType<MusicSourceImportItem> = [
    { title: 'Row', dataIndex: 'row_key', key: 'row_key', width: 90 },
    { title: 'Song', dataIndex: 'song_name', key: 'song_name', width: 220, ellipsis: true },
    { title: 'No.', dataIndex: 'song_number_raw', key: 'song_number_raw', width: 90 },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: MusicSourceImportItem['status']) => {
        if (status === 'matched' || status === 'imported') return <Tag color="green">{status}</Tag>;
        if (status === 'needs_manual') return <Tag color="orange">needs_manual</Tag>;
        if (status === 'not_found' || status === 'invalid') return <Tag color="warning">{status}</Tag>;
        if (status === 'skipped') return <Tag>{status}</Tag>;
        return <Tag color="red">error</Tag>;
      },
    },
    { title: 'Track ID', dataIndex: 'matched_track_id', key: 'matched_track_id', width: 100, render: (v?: number) => v ?? '—' },
    { title: 'Sources', dataIndex: 'source_count', key: 'source_count', width: 90 },
    { title: 'Message', dataIndex: 'message', key: 'message', render: (value?: string) => value || '—' },
  ];

  const downloadBlob = (blob: Blob, fileName: string) => {
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
  };

  const normalizeCatalogPayload = (raw: any): CatalogMetadataImportPayload => {
    const rawAlbums = Array.isArray(raw?.albums) ? raw.albums : [];
    const rawTracks = Array.isArray(raw?.tracks) ? raw.tracks : [];

    const albums = rawAlbums
      .filter((item: any) => item && typeof item.uuid === 'string' && item.uuid.trim())
      .map((item: any) => ({
        uuid: String(item.uuid).trim(),
        title: item.title != null ? String(item.title) : undefined,
        title_cn: item.title_cn ?? null,
        title_en: item.title_en ?? null,
      }));

    const tracks = rawTracks
      .filter((item: any) => item && typeof item.uuid === 'string' && item.uuid.trim())
      .map((item: any) => ({
        uuid: String(item.uuid).trim(),
        title: item.title != null ? String(item.title) : undefined,
        title_cn: item.title_cn ?? null,
        title_en: item.title_en ?? null,
      }));

    if (albums.length === 0 && tracks.length === 0) {
      throw new Error('JSON 内未找到可导入的数据（albums/tracks 为空或缺少 uuid）');
    }

    return { albums, tracks };
  };

  const parseCatalogJson = (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      const payload = normalizeCatalogPayload(parsed);
      setCatalogPayload(payload);
      setCatalogParseError(null);
      setCatalogPreviewResult(null);
    } catch (err: any) {
      setCatalogPayload(null);
      setCatalogPreviewResult(null);
      setCatalogParseError(err?.message || 'JSON 解析失败');
    }
  };

  const buildCatalogImportPayload = (): CatalogMetadataImportPayload | null => {
    if (!catalogPayload) return null;
    return {
      ...catalogPayload,
      sync_legacy_title: catalogSyncLegacyTitle,
    };
  };

  const parseIdText = (raw: string): number[] => {
    return Array.from(
      new Set(
        raw
          .split(',')
          .map((item) => Number.parseInt(item.trim(), 10))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );
  };

  const normalizeMusicSourceEntries = (raw: any): MusicSourceImportEntry[] => {
    const entries = Array.isArray(raw?.entries) ? raw.entries : [];
    if (entries.length === 0) {
      throw new Error('JSON 内未找到 entries');
    }

    return entries.map((entry: any, index: number) => {
      const rowKey = String(entry?.row_key ?? index + 1).trim();
      const songName = String(entry?.song_name ?? '').trim();
      const albumName = entry?.album_name == null ? null : String(entry.album_name).trim();
      const gameId = Number(entry?.game_id);
      const sources: MusicSourceImportEntry['sources'] = Array.isArray(entry?.sources)
        ? entry.sources.map((source: any) => ({
            category: String(source?.category ?? '').trim(),
            path: Array.isArray(source?.path)
              ? source.path.map((segment: unknown) => String(segment ?? '').trim()).filter(Boolean)
              : [],
          }))
        : [];

      if (!songName) throw new Error(`第 ${index + 1} 行缺少 song_name`);
      if (!Number.isInteger(gameId) || gameId <= 0) throw new Error(`第 ${index + 1} 行 game_id 无效`);
      if (sources.length === 0) throw new Error(`第 ${index + 1} 行缺少 sources`);
      if (sources.some((source) => !source.category || source.path.length === 0)) {
        throw new Error(`第 ${index + 1} 行 sources 中存在空 category/path`);
      }

      return {
        row_key: rowKey,
        song_name: songName,
        song_number: entry?.song_number ?? null,
        album_name: albumName,
        game_id: gameId,
        sources,
      };
    });
  };

  const parseMusicSourceJson = (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      const entries = normalizeMusicSourceEntries(parsed);
      setMusicSourceEntries(entries);
      setMusicSourceParseError(null);
      setMusicSourcePreviewResult(null);
      setMusicSourceCommitResult(null);
    } catch (err: any) {
      setMusicSourceEntries([]);
      setMusicSourcePreviewResult(null);
      setMusicSourceCommitResult(null);
      setMusicSourceParseError(err?.message || 'JSON 解析失败');
    }
  };

  const loadFirstVisitModalConfig = async () => {
    setModalLoading(true);
    try {
      const config = await siteConfigService.getAdminFirstVisitModal();
      modalForm.setFieldsValue(config);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '加载首访弹窗配置失败';
      message.error(msg);
    } finally {
      setModalLoading(false);
    }
  };

  useEffect(() => {
    loadFirstVisitModalConfig();
  }, []);

  const loadComplianceConfig = async () => {
    setComplianceLoading(true);
    try {
      const config = await siteConfigService.getAdminComplianceConfig();
      complianceForm.setFieldsValue(config);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '加载备案配置失败';
      message.error(msg);
    } finally {
      setComplianceLoading(false);
    }
  };

  useEffect(() => {
    loadComplianceConfig();
  }, []);

  const loadMaintenanceConfig = async () => {
    setMaintenanceLoading(true);
    try {
      const config = await siteConfigService.getAdminMaintenanceMode();
      maintenanceForm.setFieldsValue({
        enabled: config.enabled,
        expected_end_time: toLocalDatetime(config.expected_end_time),
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '加载维护配置失败';
      message.error(msg);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  useEffect(() => {
    loadMaintenanceConfig();
  }, []);

  const loadFeedback = async (page = feedbackPagination.page, pageSize = feedbackPagination.pageSize) => {
    setFeedbackLoading(true);
    try {
      const data = await feedbackService.getAdminList(page, pageSize);
      setFeedbackItems(data.items);
      setFeedbackPagination({ page: data.pagination.page, pageSize: data.pagination.pageSize, total: data.pagination.total });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '加载反馈列表失败';
      message.error(msg);
    } finally {
      setFeedbackLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  const handleChangePassword = async (values: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      return message.error('两次输入的新密码不一致');
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success('密码修改成功');
      form.resetFields();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || '修改失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const url = `/api/analytics/export?format=${format}`;
      window.open(url, '_blank');
    } catch {
      message.error('导出失败');
    }
  };

  const handleSaveFirstVisitModal = async (values: FirstVisitModalConfig) => {
    setModalSaving(true);
    try {
      const saved = await siteConfigService.updateAdminFirstVisitModal({
        enabled: values.enabled,
        title: values.title,
        content: values.content,
        min_stay_seconds: values.min_stay_seconds,
      });
      modalForm.setFieldsValue(saved);
      message.success('首访弹窗配置已保存');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '保存失败';
      message.error(msg);
    } finally {
      setModalSaving(false);
    }
  };

  const handleSaveCompliance = async (values: SiteComplianceConfig) => {
    setComplianceSaving(true);
    try {
      const saved = await siteConfigService.updateAdminComplianceConfig({
        enabled: values.enabled,
        icp_number: values.icp_number || '',
        public_security_number: values.public_security_number || '',
      });
      complianceForm.setFieldsValue(saved);
      message.success('备案配置已保存');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '保存失败';
      message.error(msg);
    } finally {
      setComplianceSaving(false);
    }
  };

  const handleSaveMaintenance = async (values: { enabled: boolean; expected_end_time?: string | null }) => {
    setMaintenanceSaving(true);
    try {
      const payload: Pick<MaintenanceModeConfig, 'enabled' | 'expected_end_time'> = {
        enabled: values.enabled,
        expected_end_time: toIsoDatetime(values.expected_end_time),
      };
      const saved = await siteConfigService.updateAdminMaintenanceMode(payload);
      maintenanceForm.setFieldsValue({
        enabled: saved.enabled,
        expected_end_time: toLocalDatetime(saved.expected_end_time),
      });
      message.success('维护配置已保存');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '保存失败';
      message.error(msg);
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    try {
      const values = await testEmailForm.validateFields();
      setTestEmailSending(true);
      const result = await siteConfigService.sendAdminTestEmail({ email: values.email });
      message.success(result.message || '测试邮件发送成功');
      setTestEmailVisible(false);
      testEmailForm.resetFields();
    } catch (err: any) {
      if (err?.errorFields) {
        return;
      }
      const msg = err?.response?.data?.error?.message || err?.message || '测试邮件发送失败';
      message.error(msg);
    } finally {
      setTestEmailSending(false);
    }
  };

  const handleExportCatalogMetadata = async () => {
    setCatalogExporting(true);
    try {
      const exported = await trackService.exportCatalogMetadata();
      downloadBlob(exported.blob, exported.fileName);
      message.success('元数据导出成功');
    } catch (err: any) {
      message.error(err?.message || '导出元数据失败');
    } finally {
      setCatalogExporting(false);
    }
  };

  const uploadCatalogProps: UploadProps = {
    accept: '.json,application/json',
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file) => {
      try {
        const text = await file.text();
        setCatalogJsonText(text);
        setCatalogSourceName(file.name);
        parseCatalogJson(text);
      } catch (err: any) {
        setCatalogParseError(err?.message || '读取文件失败');
      }
      return Upload.LIST_IGNORE;
    },
  };

  const handlePreviewCatalogImport = async () => {
    const payload = buildCatalogImportPayload();
    if (!payload) {
      message.warning('请先上传或粘贴有效的 JSON');
      return;
    }
    setCatalogPreviewLoading(true);
    try {
      const result = await trackService.previewCatalogMetadataImportByUuid(payload);
      setCatalogPreviewResult(result);
      message.success('预览完成');
    } catch (err: any) {
      message.error(err?.message || '导入预览失败');
    } finally {
      setCatalogPreviewLoading(false);
    }
  };

  const handleCommitCatalogImport = async () => {
    const payload = buildCatalogImportPayload();
    if (!payload) {
      message.warning('请先上传或粘贴有效的 JSON');
      return;
    }
    setCatalogCommitLoading(true);
    try {
      const result = await trackService.commitCatalogMetadataImportByUuid(payload);
      setCatalogPreviewResult(result);
      setCatalogCommittedBatchUuid(result.batch_uuid || null);
      if (result.batch_uuid) {
        setCatalogRollbackBatchUuid(result.batch_uuid);
      }
      message.success(result.batch_uuid ? `导入提交成功，批次 ${result.batch_uuid}` : '导入提交成功');
    } catch (err: any) {
      message.error(err?.message || '导入提交失败');
    } finally {
      setCatalogCommitLoading(false);
    }
  };

  const handleRollbackCatalogImport = async () => {
    const batchUuid = catalogRollbackBatchUuid.trim();
    if (!batchUuid) {
      message.warning('请输入 batch_uuid');
      return;
    }
    setCatalogRollbackLoading(true);
    try {
      const result = await trackService.rollbackCatalogMetadataBatch(batchUuid);
      message.success(`回滚成功：专辑 ${result.albums_reverted}，曲目 ${result.tracks_reverted}`);
    } catch (err: any) {
      message.error(err?.message || '回滚失败');
    } finally {
      setCatalogRollbackLoading(false);
    }
  };

  const uploadMusicSourceProps: UploadProps = {
    accept: '.json,application/json',
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file) => {
      try {
        const text = await file.text();
        setMusicSourceJsonText(text);
        setMusicSourceSourceName(file.name);
        parseMusicSourceJson(text);
      } catch (err: any) {
        setMusicSourceParseError(err?.message || '读取文件失败');
      }
      return Upload.LIST_IGNORE;
    },
  };

  const handlePreviewMusicSourceImport = async () => {
    if (musicSourceEntries.length === 0) {
      message.warning('请先上传或粘贴有效的 music source JSON');
      return;
    }

    setMusicSourcePreviewLoading(true);
    try {
      const preview = await musicSourceService.previewImport(musicSourceEntries);
      setMusicSourcePreviewResult(preview);
      setMusicSourceCommitResult(null);
      message.success('music source 预览完成');
    } catch (err: any) {
      message.error(err?.message || 'music source 预览失败');
    } finally {
      setMusicSourcePreviewLoading(false);
    }
  };

  const handleCommitMusicSourceImport = async () => {
    if (musicSourceEntries.length === 0) {
      message.warning('请先上传或粘贴有效的 music source JSON');
      return;
    }

    setMusicSourceCommitLoading(true);
    try {
      const result = await musicSourceService.commitImport(musicSourceEntries, {}, musicSourceConflictMode);
      setMusicSourceCommitResult(result);
      message.success(`music source 导入完成：成功 ${result.summary.imported} 条`);
    } catch (err: any) {
      message.error(err?.message || 'music source 导入失败');
    } finally {
      setMusicSourceCommitLoading(false);
    }
  };

  const handleExportMusicSources = async () => {
    const gameIds = parseIdText(musicSourceExportGameIdsText);
    const albumIds = parseIdText(musicSourceExportAlbumIdsText);

    if (musicSourceExportScope === 'by_game' && gameIds.length === 0) {
      message.warning('by_game 导出需要至少一个 game_id');
      return;
    }
    if (musicSourceExportScope === 'by_album' && albumIds.length === 0) {
      message.warning('by_album 导出需要至少一个 album_id');
      return;
    }

    setMusicSourceExportLoading(true);
    try {
      const exported = await musicSourceService.exportMusicSources({
        scope: musicSourceExportScope,
        game_ids: gameIds,
        album_ids: albumIds,
      });
      downloadBlob(exported.blob, exported.fileName);
      message.success('music source 导出成功');
    } catch (err: any) {
      message.error(err?.message || 'music source 导出失败');
    } finally {
      setMusicSourceExportLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="settings-page" style={{ padding: 24, maxWidth: 980 }}>
        <Title level={3}>设置</Title>

        <Card title={<><LockOutlined /> 修改密码</>} style={{ marginBottom: 24 }}>
          <Form form={form} layout="vertical" onFinish={handleChangePassword}>
            <Form.Item
              name="currentPassword"
              label="当前密码"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password placeholder="输入当前密码" />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码至少6个字符' },
              ]}
            >
              <Input.Password placeholder="输入新密码" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="确认新密码"
              rules={[{ required: true, message: '请确认新密码' }]}
            >
              <Input.Password placeholder="再次输入新密码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              修改密码
            </Button>
          </Form>
        </Card>

        <Card title={<><DatabaseOutlined /> 数据管理</>}>
          <Space direction="vertical">
            <Text type="secondary">导出全部曲目元数据</Text>
            <Space>
              <Button icon={<ExportOutlined />} onClick={() => handleExport('json')}>
                导出 JSON
              </Button>
              <Button icon={<ExportOutlined />} onClick={() => handleExport('csv')}>
                导出 CSV
              </Button>
              <Button icon={<MailOutlined />} onClick={() => setTestEmailVisible(true)}>
                测试邮件
              </Button>
            </Space>
          </Space>
          <Divider />
          <Text type="secondary">
            API 文档：<a href="/api/docs" target="_blank" rel="noopener noreferrer">打开 Swagger UI</a>
          </Text>
        </Card>

        <Card title={<><DatabaseOutlined /> 专辑/曲目双语元数据导入导出</>} style={{ marginTop: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Text type="secondary">先导出 JSON，再在本地处理 title_cn/title_en，最后走 预览 → 提交。</Text>
            <Space wrap>
              <Button icon={<ExportOutlined />} onClick={handleExportCatalogMetadata} loading={catalogExporting}>
                导出 catalog metadata
              </Button>
              <Upload {...uploadCatalogProps}>
                <Button icon={<UploadOutlined />}>上传导入 JSON</Button>
              </Upload>
              <Switch checked={catalogSyncLegacyTitle} onChange={setCatalogSyncLegacyTitle} checkedChildren="同步 title" unCheckedChildren="仅双语字段" />
            </Space>

            {catalogSourceName ? <Text type="secondary">当前文件：{catalogSourceName}</Text> : null}

            <Input.TextArea
              rows={8}
              value={catalogJsonText}
              onChange={(event) => {
                const next = event.target.value;
                setCatalogJsonText(next);
                setCatalogSourceName('手动粘贴');
                parseCatalogJson(next);
              }}
              placeholder="可直接粘贴导出的 JSON（包含 albums/tracks）"
            />

            {catalogParseError ? <Alert type="error" showIcon message={catalogParseError} /> : null}

            {catalogPayload ? (
              <Alert
                type="info"
                showIcon
                message={`待导入：专辑 ${catalogPayload.albums?.length || 0}，曲目 ${catalogPayload.tracks?.length || 0}`}
              />
            ) : null}

            <Space wrap>
              <Button type="default" onClick={handlePreviewCatalogImport} loading={catalogPreviewLoading}>
                预览（dry-run）
              </Button>
              <Button type="primary" onClick={handleCommitCatalogImport} loading={catalogCommitLoading}>
                提交导入
              </Button>
            </Space>

            {catalogPreviewResult ? (
              <Alert
                type={catalogPreviewResult.dry_run ? 'warning' : 'success'}
                showIcon
                message={
                  catalogPreviewResult.dry_run
                    ? `预览结果：更新专辑 ${catalogPreviewResult.summary.albums_updated}，更新曲目 ${catalogPreviewResult.summary.tracks_updated}`
                    : `提交结果：更新专辑 ${catalogPreviewResult.summary.albums_updated}，更新曲目 ${catalogPreviewResult.summary.tracks_updated}`
                }
                description={`未命中专辑 ${catalogPreviewResult.summary.albums_not_found}，未命中曲目 ${catalogPreviewResult.summary.tracks_not_found}，跳过 ${catalogPreviewResult.summary.skipped}`}
              />
            ) : null}

            {catalogCommittedBatchUuid ? (
              <Text type="secondary">最近提交批次：{catalogCommittedBatchUuid}</Text>
            ) : null}

            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={catalogRollbackBatchUuid}
                onChange={(event) => setCatalogRollbackBatchUuid(event.target.value)}
                placeholder="输入 batch_uuid 执行回滚"
              />
              <Button icon={<UndoOutlined />} danger loading={catalogRollbackLoading} onClick={handleRollbackCatalogImport}>
                回滚批次
              </Button>
            </Space.Compact>

            {catalogPreviewResult ? (
              <Table<CatalogMetadataImportItem>
                rowKey={(row) => `${row.entity_type}-${row.uuid}`}
                size="small"
                dataSource={catalogPreviewResult.items.slice(0, 50)}
                columns={catalogPreviewColumns}
                pagination={false}
                scroll={{ x: 760 }}
              />
            ) : null}
          </Space>
        </Card>

        <Card title={<><DatabaseOutlined /> Music Source 导入导出</>} style={{ marginTop: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Text type="secondary">支持 `import/preview`、`import/commit` 以及按 scope 导出。</Text>

            <Space wrap>
              <Select<MusicSourceConflictMode>
                value={musicSourceConflictMode}
                onChange={setMusicSourceConflictMode}
                style={{ width: 210 }}
                options={[
                  { value: 'overwrite', label: '冲突策略：覆盖 overwrite' },
                  { value: 'append', label: '冲突策略：追加 append' },
                  { value: 'skip', label: '冲突策略：跳过 skip' },
                ]}
              />
              <Upload {...uploadMusicSourceProps}>
                <Button icon={<UploadOutlined />}>上传 Music Source JSON</Button>
              </Upload>
            </Space>

            {musicSourceSourceName ? <Text type="secondary">当前文件：{musicSourceSourceName}</Text> : null}

            <Input.TextArea
              rows={8}
              value={musicSourceJsonText}
              onChange={(event) => {
                const next = event.target.value;
                setMusicSourceJsonText(next);
                setMusicSourceSourceName('手动粘贴');
                parseMusicSourceJson(next);
              }}
              placeholder="粘贴 music source 导入 JSON（顶层为 { entries: [...] }）"
            />

            {musicSourceParseError ? <Alert type="error" showIcon message={musicSourceParseError} /> : null}
            {musicSourceEntries.length > 0 ? (
              <Alert type="info" showIcon message={`待导入 entries：${musicSourceEntries.length}`} />
            ) : null}

            <Space wrap>
              <Button onClick={handlePreviewMusicSourceImport} loading={musicSourcePreviewLoading}>预览（dry-run）</Button>
              <Button type="primary" onClick={handleCommitMusicSourceImport} loading={musicSourceCommitLoading}>提交导入</Button>
            </Space>

            {musicSourcePreviewResult ? (
              <Alert
                type="warning"
                showIcon
                message={`预览：matched ${musicSourcePreviewResult.summary.matched} / needs_manual ${musicSourcePreviewResult.summary.needs_manual} / not_found ${musicSourcePreviewResult.summary.not_found} / invalid ${musicSourcePreviewResult.summary.invalid}`}
              />
            ) : null}

            {musicSourceCommitResult ? (
              <Alert
                type="success"
                showIcon
                message={`提交：imported ${musicSourceCommitResult.summary.imported} / skipped ${musicSourceCommitResult.summary.skipped} / needs_manual ${musicSourceCommitResult.summary.needs_manual} / not_found ${musicSourceCommitResult.summary.not_found} / invalid ${musicSourceCommitResult.summary.invalid} / error ${musicSourceCommitResult.summary.error}`}
              />
            ) : null}

            <Table<MusicSourceImportItem>
              rowKey={(row) => row.row_key}
              size="small"
              dataSource={(musicSourceCommitResult?.items || musicSourcePreviewResult?.items || []).slice(0, 80)}
              columns={musicSourceColumns}
              pagination={false}
              scroll={{ x: 980 }}
            />

            <Divider style={{ margin: '8px 0' }} />
            <Text strong>导出 Music Source</Text>
            <Space wrap>
              <Select<MusicSourceExportScope>
                value={musicSourceExportScope}
                onChange={setMusicSourceExportScope}
                style={{ width: 200 }}
                options={[
                  { value: 'all', label: 'scope: all' },
                  { value: 'by_game', label: 'scope: by_game' },
                  { value: 'by_album', label: 'scope: by_album' },
                ]}
              />
              <Button icon={<ExportOutlined />} onClick={handleExportMusicSources} loading={musicSourceExportLoading}>
                导出 Music Source JSON
              </Button>
            </Space>

            {musicSourceExportScope === 'by_game' ? (
              <Input
                value={musicSourceExportGameIdsText}
                onChange={(event) => setMusicSourceExportGameIdsText(event.target.value)}
                placeholder="game_ids，逗号分隔，例如：1,2,3"
              />
            ) : null}

            {musicSourceExportScope === 'by_album' ? (
              <Input
                value={musicSourceExportAlbumIdsText}
                onChange={(event) => setMusicSourceExportAlbumIdsText(event.target.value)}
                placeholder="album_ids，逗号分隔，例如：10,11,12"
              />
            ) : null}
          </Space>
        </Card>

        <Card title="首访弹窗" loading={modalLoading} style={{ marginTop: 24 }}>
          <Form
            form={modalForm}
            layout="vertical"
            initialValues={{ enabled: false, min_stay_seconds: 5 }}
            onFinish={handleSaveFirstVisitModal}
          >
            <Form.Item name="enabled" label="启用弹窗" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>

            <Form.Item
              name="title"
              label="弹窗标题"
              rules={[{ required: true, message: '请输入弹窗标题' }, { max: 120, message: '标题最多 120 字' }]}
            >
              <Input placeholder="例如：访问须知" maxLength={120} />
            </Form.Item>

            <Form.Item
              name="content"
              label="弹窗内容"
              rules={[{ required: true, message: '请输入弹窗内容' }, { max: 5000, message: '内容最多 5000 字' }]}
              extra="支持 Markdown（例如标题、列表、链接、加粗）。"
            >
              <Input.TextArea rows={5} placeholder="支持 Markdown 语法与换行" maxLength={5000} showCount />
            </Form.Item>

            <Form.Item
              name="min_stay_seconds"
              label="最短停留时长（秒）"
              rules={[{ required: true, message: '请输入最短停留时长' }]}
            >
              <InputNumber min={5} max={120} precision={0} style={{ width: 180 }} />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={modalSaving}>
              保存弹窗配置
            </Button>
          </Form>
        </Card>

        <Card title="备案信息" loading={complianceLoading} style={{ marginTop: 24 }}>
          <Form
            form={complianceForm}
            layout="vertical"
            initialValues={{ enabled: false, icp_number: '', public_security_number: '' }}
            onFinish={handleSaveCompliance}
          >
            <Form.Item name="enabled" label="启用备案展示" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>

            <Form.Item
              name="icp_number"
              label="ICP备案号"
              rules={[{ max: 100, message: '备案号最多 100 字' }]}
              extra="将自动跳转到工信部备案系统。"
            >
              <Input placeholder="例如：沪ICP备2026000000号" maxLength={100} />
            </Form.Item>

            <Form.Item
              name="public_security_number"
              label="公网安备号"
              rules={[{ max: 100, message: '备案号最多 100 字' }]}
              extra="将自动提取编号并跳转到全国互联网安全管理服务平台。"
            >
              <Input placeholder="例如：沪公网安备31010102001234号" maxLength={100} />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={complianceSaving}>
              保存备案配置
            </Button>
          </Form>
        </Card>

        <Card title={<><ToolOutlined /> 站点维护</>} loading={maintenanceLoading} style={{ marginTop: 24 }}>
          <Form
            form={maintenanceForm}
            layout="vertical"
            initialValues={{ enabled: false, expected_end_time: null }}
            onFinish={handleSaveMaintenance}
          >
            <Form.Item name="enabled" label="启用维护模式" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>

            <Form.Item
              name="expected_end_time"
              label="预计结束时间"
              extra="用于维护页展示，可留空。"
            >
              <Input type="datetime-local" />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={maintenanceSaving}>
              保存维护配置
            </Button>
          </Form>
        </Card>

        <Card
          title="用户反馈"
          extra={<Button onClick={() => loadFeedback(1, feedbackPagination.pageSize)} loading={feedbackLoading}>刷新</Button>}
          style={{ marginTop: 24 }}
        >
          <Table
            rowKey="id"
            loading={feedbackLoading}
            dataSource={feedbackItems}
            columns={feedbackColumns}
            pagination={{
              current: feedbackPagination.page,
              pageSize: feedbackPagination.pageSize,
              total: feedbackPagination.total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `共 ${total} 条反馈`,
            }}
            onChange={(pagination) => {
              loadFeedback(pagination.current || 1, pagination.pageSize || feedbackPagination.pageSize);
            }}
          />
        </Card>

        <Modal
          title="发送测试邮件"
          open={testEmailVisible}
          onCancel={() => {
            setTestEmailVisible(false);
            testEmailForm.resetFields();
          }}
          onOk={handleSendTestEmail}
          confirmLoading={testEmailSending}
          okText="发送"
          cancelText="取消"
          destroyOnHidden
        >
          <Form form={testEmailForm} layout="vertical">
            <Form.Item
              name="email"
              label="收件邮箱"
              rules={[
                { required: true, message: '请输入收件邮箱' },
                { type: 'email', message: '请输入有效邮箱地址' },
              ]}
            >
              <Input placeholder="example@domain.com" autoComplete="email" />
            </Form.Item>
            <Text type="secondary">使用后台配置的 SMTP 参数发送一封测试邮件。</Text>
          </Form>
        </Modal>
      </div>
    </AdminLayout>
  );
};

export default Settings;

