import React, { useState, useCallback, useRef } from 'react';
import {
  Modal, Upload, Button, Progress, List, Tag, Typography, Space,
  Divider, Result, Badge, Steps, Alert, Input, Switch, Tooltip,
  Row, Col, Card, Spin,
} from 'antd';
import {
  InboxOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SoundOutlined, LoadingOutlined, CloudUploadOutlined, FileSearchOutlined,
  UploadOutlined as UploadIcon, InfoCircleOutlined,
  FileTextOutlined, TagOutlined, FolderOpenOutlined,
} from '@ant-design/icons';
import { trackService } from '../services/trackService';
import { parseBlob } from 'music-metadata-browser';
import { toast } from '../utils/toast';
import './UploadModal.css';

const { Dragger } = Upload;
const { Text } = Typography;

interface CreditEntry { key: string; value: string; }

interface FileItem {
  uid: string;
  name: string;
  originFileObj: File;
  size: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  detectedTitle: string;
  detectedArtist: string;
  detectedAlbum: string;
  editTitle: string;
  editArtist: string;
  editAlbum: string;
  // credits parsed from FLAC in browser
  credits?: CreditEntry[];
  creditsLoading?: boolean;
}

interface UploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function parseFilename(name: string): { title: string; artist: string; album: string } {
  // 文件名去掉扩展名即为标题，不做任何分割解析
  const title = name.replace(/\.flac$/i, '');
  return { title, artist: '', album: '' };
}

async function parseLocalMetadata(file: File): Promise<{ title: string; artist: string; album: string }> {
  const fallback = parseFilename(file.name);
  try {
    const metadata = await parseBlob(file);
    const title = metadata.common.title?.trim() || fallback.title;
    const artist = (metadata.common.artists?.join(', ') || metadata.common.artist || '').trim();
    const album = (metadata.common.album || '').trim();
    return { title, artist, album };
  } catch {
    return fallback;
  }
}

const UploadModal: React.FC<UploadModalProps> = ({ visible, onClose, onSuccess }) => {
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadResults, setUploadResults] = useState<{ success: number; fail: number }>({ success: 0, fail: 0 });
  const [autoCredits, setAutoCredits] = useState(true);
  const [creditsScanning, setCreditsScanning] = useState(false);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Steps: 选择文件(0) → Credits预览(1) → 导入(2) → 完成(3)
  const steps = [
    { title: '选择文件',     icon: <FileSearchOutlined /> },
    { title: 'Credits 预览', icon: <TagOutlined /> },
    { title: '导入',         icon: <UploadIcon /> },
    { title: '完成',         icon: <CheckCircleOutlined /> },
  ];

  const formatSize = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(2)} MB`;

  const addFiles = useCallback(async (files: File[]) => {
    const accepted: File[] = [];
    for (const file of files) {
      const ok = file.name.toLowerCase().endsWith('.flac') ||
                 file.type === 'audio/flac' || file.type === 'audio/x-flac';
      if (!ok) {
        toast.error(`${file.name} 不是 FLAC 格式，已跳过`);
        continue;
      }
      accepted.push(file);
    }

    const parsed = await Promise.all(accepted.map(async (file) => ({
      file,
      ...(await parseLocalMetadata(file)),
    })));

    setFileItems(prev => {
      const next = [...prev];
      for (const item of parsed) {
        if (next.some(f => f.name === item.file.name && f.size === item.file.size)) continue;
        next.push({
          uid: `${Date.now()}-${Math.random()}`,
          name: item.file.name,
          originFileObj: item.file,
          size: item.file.size,
          status: 'pending',
          detectedTitle: item.title,
          detectedArtist: item.artist,
          detectedAlbum: item.album,
          editTitle: item.title,
          editArtist: item.artist,
          editAlbum: item.album,
        });
      }
      return next;
    });
  }, []);

  const handleBeforeUpload = useCallback((file: File) => {
    void addFiles([file]);
    return false;
  }, [addFiles]);

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    void addFiles(files);
    // reset so same folder can be selected again
    e.target.value = '';
  };

  const handleRemoveFile = (uid: string) =>
    setFileItems(prev => prev.filter(f => f.uid !== uid));

  const handleUpdateCredit = (uid: string, idx: number, field: 'key' | 'value', val: string) =>
    setFileItems(prev => prev.map(f => {
      if (f.uid !== uid || !f.credits) return f;
      const credits = f.credits.map((c, i) => i === idx ? { ...c, [field]: val } : c);
      return { ...f, credits };
    }));

  const handleDeleteCredit = (uid: string, idx: number) =>
    setFileItems(prev => prev.map(f => {
      if (f.uid !== uid || !f.credits) return f;
      return { ...f, credits: f.credits.filter((_, i) => i !== idx) };
    }));

  const handleAddCredit = (uid: string) =>
    setFileItems(prev => prev.map(f => {
      if (f.uid !== uid) return f;
      return { ...f, credits: [...(f.credits ?? []), { key: '', value: '' }] };
    }));

  // Step 0 → Step 1: scan credits via backend API (or skip to step 2)
  const handleGoToCredits = async () => {
    if (fileItems.length === 0) return;

    let nextItems = fileItems;
    setDuplicateChecking(true);
    try {
      const duplicates = await trackService.precheckDuplicateTracks(
        fileItems.map((f, index) => ({
          index,
          file: f.name,
          title: (f.editTitle || f.detectedTitle || '').trim(),
          album: (f.editAlbum || f.detectedAlbum || '').trim() || null,
        }))
      );

      if (duplicates.length > 0) {
        const duplicateIndexSet = new Set(duplicates.map((d) => d.index));
        nextItems = fileItems.filter((_, idx) => !duplicateIndexSet.has(idx));
        setFileItems(nextItems);
        toast.warning(`检测到 ${duplicates.length} 首重名，已自动跳过`);
      }
    } catch (e: any) {
      toast.error('重名检查失败：' + (e?.message || '未知错误'));
      return;
    } finally {
      setDuplicateChecking(false);
    }

    if (nextItems.length === 0) {
      toast.warning('所有待导入文件均与现有曲目重名，已全部跳过');
      setCurrentStep(0);
      return;
    }

    if (!autoCredits) {
      setCurrentStep(2); // skip credits preview, go straight to import
      return;
    }
    setCurrentStep(1);
    setCreditsScanning(true);
    setFileItems(prev => prev.map(f => ({ ...f, creditsLoading: true, credits: undefined })));
    try {
      // 后端一次性解析所有文件，返回 [{filename, credits}]
      const results = await trackService.previewCredits(nextItems.map(f => f.originFileObj));
      setFileItems(prev => prev.map(f => {
        const match = results.find(r => r.filename === f.name);
        return { ...f, credits: match ? match.credits : [], creditsLoading: false };
      }));
    } catch (e: any) {
      toast.error('读取 Credits 失败：' + (e?.message || '未知错误'));
      setFileItems(prev => prev.map(f => ({ ...f, credits: [], creditsLoading: false })));
    }
    setCreditsScanning(false);
  };

  const handleStartUpload = async () => {
    if (fileItems.length === 0) return;
    const currentAutoCredits = autoCredits;
    setUploading(true);
    setUploadProgress(0);
    let successCount = 0; let failCount = 0;

    for (let i = 0; i < fileItems.length; i++) {
      const item = fileItems[i];
      setFileItems(prev => prev.map(f => f.uid === item.uid ? { ...f, status: 'uploading' } : f));
      try {
        await trackService.uploadTracks([item.originFileObj], {
          autoCredits: currentAutoCredits,
          metaOverrides: [{ title: item.editTitle || undefined, artist: item.editArtist || undefined, album: item.editAlbum || undefined }],
          // 传入编辑后的 credits（若已通过预览步骤）
          creditsOverrides: [item.credits ?? null],
        });
        setFileItems(prev => prev.map(f => f.uid === item.uid ? { ...f, status: 'done' } : f));
        successCount++;
      } catch (e: any) {
        setFileItems(prev => prev.map(f =>
          f.uid === item.uid ? { ...f, status: 'error', error: e?.message || '上传失败' } : f
        ));
        failCount++;
      }
      setUploadProgress(Math.round(((i + 1) / fileItems.length) * 100));
    }

    setUploading(false);
    setCurrentStep(3);
    setUploadResults({ success: successCount, fail: failCount });
    if (successCount > 0) { toast.success(`成功导入 ${successCount} 首`); onSuccess(); }
    if (failCount > 0) toast.error(`${failCount} 首导入失败`);
  };

  const handleClose = () => {
    if (uploading) return;
    setFileItems([]); setCurrentStep(0); setUploadProgress(0);
    setAutoCredits(true); setCreditsScanning(false); setDuplicateChecking(false);
    onClose();
  };

  const totalSize = fileItems.reduce((s, f) => s + f.size, 0);

  return (
    <Modal
      title={
        <Space>
          <CloudUploadOutlined style={{ color: '#667eea' }} />
          <span>高级导入向导</span>
          {fileItems.length > 0 && currentStep < 3 && <Badge count={fileItems.length} color="#667eea" />}
        </Space>
      }
      open={visible} onCancel={handleClose}
      width={860} footer={null}
      className="upload-modal" maskClosable={!uploading}
    >
      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} size="small" />

      {/* ── Step 0: 选择文件 ──────────────────────────────────────── */}
      {currentStep === 0 && (
        <>
          {/* Hidden folder input */}
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore – webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            multiple
            accept=".flac"
            style={{ display: 'none' }}
            onChange={handleFolderChange}
          />

          <Dragger multiple accept=".flac" beforeUpload={handleBeforeUpload}
            showUploadList={false} className="upload-dragger">
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#667eea', fontSize: 48 }} />
            </p>
            <p className="ant-upload-text">点击或拖拽 FLAC 文件到此区域</p>
            <p className="ant-upload-hint">支持批量选择，仅支持 .flac 格式 · 默认以文件名作为歌曲标题</p>
          </Dragger>

          <div style={{ textAlign: 'center', marginTop: 10, marginBottom: 4 }}>
            <Button
              icon={<FolderOpenOutlined />}
              onClick={() => folderInputRef.current?.click()}
              style={{ borderColor: '#667eea', color: '#667eea' }}
            >
              选择文件夹上传
            </Button>
            <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 4 }}>
              选择文件夹后将自动扫描其中所有 .flac 文件（含子文件夹）
            </Text>
          </div>

          {fileItems.length > 0 && (
            <>
              <Divider style={{ margin: '16px 0 8px' }} />
              <div className="upload-file-summary">
                <Text type="secondary">已选 {fileItems.length} 个文件 · {formatSize(totalSize)}</Text>
                <Button type="text" size="small" danger onClick={() => setFileItems([])}>清空全部</Button>
              </div>
              <List className="upload-file-list" size="small" dataSource={fileItems}
                renderItem={item => (
                  <List.Item actions={[
                    <Button type="text" size="small" icon={<DeleteOutlined />} danger
                      onClick={() => handleRemoveFile(item.uid)} />
                  ]}>
                    <List.Item.Meta
                      avatar={<SoundOutlined style={{ fontSize: 20, color: '#667eea', marginTop: 2 }} />}
                      title={<Text ellipsis style={{ maxWidth: 400 }} title={item.name}>{item.name}</Text>}
                      description={
                        <Space size={4} wrap>
                          <Text type="secondary" style={{ fontSize: 11 }}>{formatSize(item.size)}</Text>
                          {item.detectedArtist && <Tag color="blue" style={{ fontSize: 11 }}>{item.detectedArtist}</Tag>}
                          {item.detectedTitle && <Tag color="purple" style={{ fontSize: 11 }}>{item.detectedTitle}</Tag>}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </>
          )}

          {/* Credits 决策区 */}
          <Card size="small" className="upload-option-card" style={{ marginTop: 16 }}
            title={<Space><TagOutlined style={{ color: '#667eea' }} /><span>是否自动读取 Credits？</span></Space>}
          >
            <div className="upload-option-row">
              <div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  自动从 FLAC 元数据提取 Credits（作曲、编曲、制作人、混音等）
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {autoCredits
                    ? '✅ 已开启 — 点击「下一步」将读取每个文件的 Credits 供预览确认'
                    : '⛔ 已关闭 — 将跳过 Credits，可在导入后手动添加'}
                </Text>
              </div>
              <Switch
                checked={autoCredits}
                onChange={setAutoCredits}
                disabled={duplicateChecking}
                checkedChildren="读取" unCheckedChildren="忽略"
                style={{ marginLeft: 16, flexShrink: 0 }}
              />
            </div>
          </Card>

          <div className="upload-footer">
            <Button onClick={handleClose}>取消</Button>
            <Button type="primary" icon={autoCredits ? <TagOutlined /> : <UploadIcon />}
              loading={duplicateChecking}
              disabled={fileItems.length === 0 || duplicateChecking}
              onClick={handleGoToCredits}>
              {duplicateChecking
                ? '检查重名中...'
                : (autoCredits ? `下一步：读取 Credits (${fileItems.length})` : `跳过，直接导入 (${fileItems.length})`)}
            </Button>
          </div>
        </>
      )}

      {/* ── Step 1: Credits 预览 + 编辑 ──────────────────────────── */}
      {currentStep === 1 && (
        <>
          {creditsScanning ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: 'var(--text-secondary)' }}>正在读取 FLAC 文件 Credits 元数据…</div>
            </div>
          ) : (
            <>
              <Alert
                message="可在下方直接修改、删除或添加 Credits 键值对，修改结果将在导入时写入数据库。"
                type="info" showIcon icon={<InfoCircleOutlined />} style={{ marginBottom: 12 }}
              />
              <div style={{ maxHeight: 440, overflowY: 'auto' }}>
                {fileItems.map(item => (
                  <Card
                    key={item.uid} size="small"
                    className="upload-option-card"
                    style={{ marginBottom: 10 }}
                    title={
                      <Space>
                        <SoundOutlined style={{ color: '#667eea' }} />
                        <Text ellipsis style={{ maxWidth: 380, fontSize: 13 }}>{item.name}</Text>
                        <Tag color={(item.credits?.length ?? 0) > 0 ? 'green' : 'orange'}>
                          {item.credits?.length ?? 0} 条 Credits
                        </Tag>
                      </Space>
                    }
                    extra={
                      <Button
                        type="dashed" size="small"
                        icon={<span style={{ fontSize: 14, lineHeight: 1 }}>＋</span>}
                        onClick={() => handleAddCredit(item.uid)}
                        style={{ color: '#667eea', borderColor: '#667eea' }}
                      >
                        添加行
                      </Button>
                    }
                  >
                    {item.creditsLoading ? (
                      <div style={{ textAlign: 'center', padding: 12 }}><Spin size="small" /></div>
                    ) : (item.credits && item.credits.length > 0) ? (
                      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {/* 表头 */}
                        <Row gutter={6} style={{ marginBottom: 4, padding: '0 4px' }}>
                          <Col span={8}>
                            <Text type="secondary" style={{ fontSize: 11 }}>KEY（标签名）</Text>
                          </Col>
                          <Col span={14}>
                            <Text type="secondary" style={{ fontSize: 11 }}>VALUE（内容）</Text>
                          </Col>
                        </Row>
                        {item.credits.map((credit, idx) => (
                          <Row key={idx} gutter={6} style={{ marginBottom: 4 }} align="middle">
                            <Col span={8}>
                              <Input
                                size="small"
                                value={credit.key}
                                onChange={e => handleUpdateCredit(item.uid, idx, 'key', e.target.value)}
                                placeholder="例: composer"
                                style={{ fontSize: 12 }}
                              />
                            </Col>
                            <Col span={14}>
                              <Input
                                size="small"
                                value={credit.value}
                                onChange={e => handleUpdateCredit(item.uid, idx, 'value', e.target.value)}
                                placeholder="例: 田中智章"
                                style={{ fontSize: 12 }}
                              />
                            </Col>
                            <Col span={2}>
                              <Button
                                type="text" size="small"
                                icon={<DeleteOutlined />}
                                danger
                                onClick={() => handleDeleteCredit(item.uid, idx)}
                              />
                            </Col>
                          </Row>
                        ))}
                      </div>
                    ) : (
                      <Alert
                        type="warning" showIcon
                        message="此文件未检测到 Credits 标签"
                        description="可点击右上角「添加行」手动添加 Credits。"
                        style={{ fontSize: 12 }}
                      />
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
          <div className="upload-footer">
            <Button onClick={() => setCurrentStep(0)} disabled={creditsScanning}>上一步</Button>
            <Button type="primary" icon={<UploadIcon />}
              disabled={creditsScanning} onClick={() => setCurrentStep(2)}>
              确认，开始导入 ({fileItems.length} 首)
            </Button>
          </div>
        </>
      )}

      {/* ── Step 2: 导入进度 ──────────────────────────────────────── */}
      {currentStep === 2 && (
        <>
          <Card size="small" className="upload-option-card" style={{ marginBottom: 16 }}
            title={<Space><FileTextOutlined style={{ color: '#667eea' }} /><span>导入摘要</span></Space>}
          >
            <Row gutter={16}>
              <Col span={8}>
                <div className="upload-stat">
                  <div className="upload-stat-num">{fileItems.length}</div>
                  <div className="upload-stat-label">待导入文件</div>
                </div>
              </Col>
              <Col span={8}>
                <div className="upload-stat">
                  <div className="upload-stat-num">{formatSize(totalSize)}</div>
                  <div className="upload-stat-label">总大小</div>
                </div>
              </Col>
              <Col span={8}>
                <div className="upload-stat">
                  <div className="upload-stat-num" style={{ color: autoCredits ? '#52c41a' : '#faad14' }}>
                    {autoCredits ? '读取' : '忽略'}
                  </div>
                  <div className="upload-stat-label">Credits</div>
                </div>
              </Col>
            </Row>
          </Card>

          {uploading && (
            <>
              <Progress
                percent={uploadProgress}
                status={uploadProgress < 100 ? 'active' : 'success'}
                format={pct => `${pct}% · ${fileItems.filter(f => f.status === 'done').length}/${fileItems.length} 完成`}
                style={{ marginBottom: 12 }}
              />
              <List size="small" dataSource={fileItems}
                style={{ maxHeight: 220, overflowY: 'auto' }}
                renderItem={item => (
                  <List.Item
                    className={`upload-file-item upload-file-item--${item.status}`}
                    actions={[
                      item.status === 'done'      ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : null,
                      item.status === 'error'     ? <Tooltip title={item.error}><CloseCircleOutlined style={{ color: '#ff4d4f' }} /></Tooltip> : null,
                      item.status === 'uploading' ? <LoadingOutlined style={{ color: '#667eea' }} /> : null,
                    ].filter(Boolean)}
                  >
                    <Text ellipsis style={{ maxWidth: 560, fontSize: 12 }} title={item.name}>{item.name}</Text>
                  </List.Item>
                )}
              />
            </>
          )}

          <div className="upload-footer">
            <Button onClick={() => setCurrentStep(autoCredits ? 1 : 0)} disabled={uploading}>上一步</Button>
            <Button type="primary" icon={<UploadIcon />} loading={uploading} disabled={uploading}
              onClick={handleStartUpload}>
              {uploading
                ? `导入中 ${uploadProgress}% (${fileItems.filter(f => f.status === 'done').length}/${fileItems.length})`
                : `开始导入 (${fileItems.length} 首)`}
            </Button>
          </div>
        </>
      )}

      {/* ── Step 3: 完成 ──────────────────────────────────────────── */}
      {currentStep === 3 && (
        <Result
          status={uploadResults.fail === 0 ? 'success' : 'warning'}
          title={uploadResults.fail === 0 ? '全部导入成功！' : '导入完成，部分失败'}
          subTitle={
            <Space direction="vertical" size={4} style={{ textAlign: 'center' }}>
              {uploadResults.success > 0 && <Tag color="green" style={{ fontSize: 13 }}>✅ {uploadResults.success} 首成功导入</Tag>}
              {uploadResults.fail > 0 && <Tag color="red" style={{ fontSize: 13 }}>❌ {uploadResults.fail} 首导入失败</Tag>}
              {autoCredits && uploadResults.success > 0 && <Tag color="blue" style={{ fontSize: 12 }}>🎵 已自动写入 Credits 元数据</Tag>}
            </Space>
          }
          extra={
            <Space>
              {uploadResults.fail > 0 && (
                <Button onClick={() => {
                  setFileItems(prev => prev.filter(f => f.status === 'error').map(f => ({ ...f, status: 'pending' as const })));
                  setCurrentStep(2);
                }}>重试失败项</Button>
              )}
              <Button type="primary" onClick={handleClose}>完成</Button>
            </Space>
          }
        />
      )}
    </Modal>
  );
};

export default UploadModal;


