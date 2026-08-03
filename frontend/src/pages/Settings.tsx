import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, message, Space, Typography, Divider, Switch, InputNumber, Table, Tag, Modal, Upload, Alert, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ExportOutlined, DatabaseOutlined, MailOutlined, UploadOutlined, UndoOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import AdminLayout from '../components/AdminLayout';
import AdminPageHeader from '../components/admin/AdminPageHeader';
import PasswordSection from '../components/admin/PasswordSection';
import MaintenanceSection from '../components/admin/MaintenanceSection';
import {
  trackService,
  type CatalogMetadataImportPayload,
  type CatalogMetadataImportResult,
  type CatalogMetadataImportItem,
} from '../services/trackService';
import {
  siteConfigService,
  type FirstVisitModalConfig,
  type SiteComplianceConfig,
} from '../services/siteConfigService';
import { feedbackService, type FeedbackItem } from '../services/feedbackService';

const { Text } = Typography;

const Settings: React.FC = () => {
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceSaving, setComplianceSaving] = useState(false);
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
  const [form] = Form.useForm();
  const [modalForm] = Form.useForm();
  const [complianceForm] = Form.useForm();
  const [maintenanceForm] = Form.useForm();
  const [testEmailForm] = Form.useForm();

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


  return (
    <AdminLayout>
      <div className="settings-page" style={{ padding: 24, maxWidth: 980 }}>
        <AdminPageHeader
          title="系统设置"
          description="按功能分区管理账户安全、数据工具与站点配置。"
        />

        <Tabs
          defaultActiveKey="security"
          items={[
            {
              key: 'security',
              label: '安全与账户',
              children: (
                <PasswordSection form={form} />
              ),
            },
            {
              key: 'data-tools',
              label: '数据与导入工具',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
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

                  <Card title={<><DatabaseOutlined /> 专辑/曲目双语元数据导入导出</>}>
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

                  <Card title={<><DatabaseOutlined /> Music Source 管理入口</>}>
                    <Space direction="vertical" style={{ width: '100%' }} size={10}>
                      <Text type="secondary">Music Source 导入已迁移至专用管理页，避免大 JSON 文本渲染卡顿，并支持候选项人工选择。</Text>
                      <Button type="primary" href="/admin/music-sources/library">打开 Music Source 库管理</Button>
                    </Space>
                  </Card>
                </Space>
              ),
            },
            {
              key: 'site-display',
              label: '站点展示配置',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <Card title="首访弹窗" loading={modalLoading}>
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

                  <Card title="备案信息" loading={complianceLoading}>
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
                </Space>
              ),
            },
            {
              key: 'maintenance-feedback',
              label: '维护与反馈',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <MaintenanceSection form={maintenanceForm} />

                  <Card
          title="用户反馈"
          extra={<Button onClick={() => loadFeedback(1, feedbackPagination.pageSize)} loading={feedbackLoading}>刷新</Button>}
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
                </Space>
              ),
            },
          ]}
        />

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

