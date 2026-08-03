import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal, Upload, Button, Progress, List, Tag, Typography, Space,
  Divider, Result, Badge, Steps, Alert, Input, Tooltip,
  Row, Col, Card, Spin, Select,
} from 'antd';
import {
  InboxOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SoundOutlined, LoadingOutlined, CloudUploadOutlined, FileSearchOutlined,
  UploadOutlined as UploadIcon, InfoCircleOutlined,
  FileTextOutlined, TagOutlined, FolderOpenOutlined,
} from '@ant-design/icons';
import { trackService } from '../services/trackService';
import { gameService } from '../services/gameService';
import type { Game } from '../types';
import { toast } from '../utils/toast';
import './UploadModal.css';

const { Dragger } = Upload;
const { Text } = Typography;

interface GameOption { label: string; value: number; }

interface FileItem {
  uid: string;
  name: string;
  originFileObj: File;
  size: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  editTitle: string;
  editTrackNumber: string;
  scannedTitle: string;
  scannedAlbum: string;
  scannedTrackNumber: string;
}

interface UploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// 文件名仅用于去重和显示，标题/专辑由后端 metaflac 自动读取
// 用户可在后续步骤手动覆盖
function emptyMeta() {
  return { title: '', album: '' };
}

const UploadModal: React.FC<UploadModalProps> = ({ visible, onClose, onSuccess }) => {
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadResults, setUploadResults] = useState<{ success: number; fail: number }>({ success: 0, fail: 0 });
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanSpeed, setScanSpeed] = useState('');
  const [scanError, setScanError] = useState('');
  const [albumGameMap, setAlbumGameMap] = useState<Record<string, number>>({});
  const [games, setGames] = useState<GameOption[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    gameService.getGames().then(gs => {
      setGames(gs.map(g => ({ label: g.name, value: g.id })));
    }).catch(() => {
      setGames([{ label: '原神', value: 1 }, { label: '崩坏：星穹铁道', value: 2 }, { label: '绝区零', value: 3 }]);
    });
  }, []);

  // Steps: 选择文件(0) → 填写信息(1) → 导入(2) → 完成(3)
  const steps = [
    { title: '选择文件',     icon: <FileSearchOutlined /> },
    { title: '扫描标签',   icon: <TagOutlined /> },
    { title: '导入',         icon: <UploadIcon /> },
    { title: '完成',         icon: <CheckCircleOutlined /> },
  ];

  const formatSize = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(2)} MB`;

  const addFiles = useCallback((files: File[]) => {
    setFileItems(prev => {
      const next = [...prev];
      for (const file of files) {
      const ok = file.name.toLowerCase().endsWith('.flac') ||
                 file.type === 'audio/flac' || file.type === 'audio/x-flac';
      if (!ok) {
        toast.error(`${file.name} 不是 FLAC 格式，已跳过`);
        continue;
      }
        if (next.some(f => f.name === file.name && f.size === file.size)) continue;
        const { title } = emptyMeta();
        next.push({
          uid: `${Date.now()}-${Math.random()}`,
          name: file.name,
          originFileObj: file,
          size: file.size,
          status: 'pending',
          editTitle: '',
          editTrackNumber: '',
          scannedTitle: file.name.replace(/\.flac$/i, ''),
          scannedAlbum: '',
          scannedTrackNumber: '',
        });
      }
      return next;
    });
  }, []);

  const handleBeforeUpload = useCallback((file: File) => {
    addFiles([file]);
    return false;
  }, [addFiles]);

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    // reset so same folder can be selected again
    e.target.value = '';
  };

  const handleRemoveFile = (uid: string) =>
    setFileItems(prev => prev.filter(f => f.uid !== uid));

  // Step 0 → Step 1: scan FLAC tags via backend, then show results for review
  const handleGoToMetadata = async () => {
    if (fileItems.length === 0) return;
    setScanning(true);
    setScanError('');
    setScanProgress(0);
    setScanSpeed('');
    try {
      const scanned = await trackService.scanTags(
        fileItems.map(f => f.originFileObj),
        (pct, spd) => { setScanProgress(pct); setScanSpeed(spd); },
      );
      // Map scan results back to fileItems by filename
      const scanMap = new Map(scanned.map(s => [s.filename, s]));
      setFileItems(prev => prev.map(f => {
        const s = scanMap.get(f.name);
        if (!s) return f;
        return {
          ...f,
          scannedTitle: s.title,
          scannedAlbum: s.album,
          scannedTrackNumber: s.track_number,
          editTitle: '',     // reset — user hasn't decided override yet
          editTrackNumber: '',
        };
      }));
      // 按专辑分组，每个专辑初始默认为游戏1
      const albumGames: Record<string, number> = {};
      scanned.forEach(s => {
        if (s.album && !albumGames[s.album]) albumGames[s.album] = 1;
      });
      setAlbumGameMap(albumGames);
      setCurrentStep(1);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || '未知错误';
      setScanError(msg);
      toast.error('扫描标签失败：' + msg);
    } finally { setScanning(false); }
  };

  const handleStartUpload = async () => {
    if (fileItems.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    let successCount = 0; let failCount = 0;

    for (let i = 0; i < fileItems.length; i++) {
      const item = fileItems[i];
      setFileItems(prev => prev.map(f => f.uid === item.uid ? { ...f, status: 'uploading' } : f));
      try {
        // 1. 获取 OSS 预签名上传 URL
        const { uploadUrl, objectKey } = await trackService.getUploadToken(item.name, albumGameMap[item.scannedAlbum] || 1);

        // 2. PUT 直传 OSS
        await uploadToOSS(item.originFileObj, uploadUrl);

        // 3. 通知服务器入库
        await trackService.commitUpload({
          objectKey,
          gameId: albumGameMap[item.scannedAlbum] || 1,
          title_override: item.editTitle.trim() || undefined,
          track_number_override: item.editTrackNumber.trim() || undefined,
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

  /** PUT 文件到 OSS 预签名 URL */
  const uploadToOSS = (file: File, url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', 'audio/flac');
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`OSS 上传失败: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('OSS 网络错误'));
      xhr.send(file);
    });
  };

  const handleClose = () => {
    if (uploading) return;
    setFileItems([]); setCurrentStep(0); setUploadProgress(0);
    setScanning(false); setScanError('');
    setAlbumGameMap({});
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
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </>
          )}

          {scanning && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Progress
                type="circle"
                percent={scanProgress}
                format={() => `${scanProgress}%`}
                size={100}
              />
              <div style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
                正在上传并扫描 {fileItems.length} 首 FLAC 标签...
              </div>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {scanProgress < 100
                    ? `上传中 ${scanSpeed}`
                    : '服务器正在解析标签...'}
                </Text>
              </div>
            </div>
          )}

          {scanError && (
            <Alert
              type="error"
              message="扫描失败"
              description={scanError}
              showIcon
              closable
              onClose={() => setScanError('')}
              style={{ margin: '12px 0' }}
            />
          )}

          {!scanning && <div className="upload-footer">
            <Button onClick={handleClose}>取消</Button>
            <Button type="primary" icon={<TagOutlined />}
              disabled={fileItems.length === 0}
              onClick={handleGoToMetadata}>
              下一步：扫描标签 ({fileItems.length})
            </Button>
          </div>}
        </>
      )}

      {/* ── Step 1: 核对标签 ──────────────────────────── */}
      {currentStep === 1 && (
        <>
          <Alert
            message={`已扫描 ${fileItems.length} 首 FLAC 标签 — ${Object.keys(albumGameMap).length} 个专辑`}
            type="success" showIcon icon={<InfoCircleOutlined />} style={{ marginBottom: 8 }}
          />

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {/* 按扫描到的专辑分组 */}
            {Object.entries(albumGameMap).map(([album, gameId]) => {
              const albumFiles = fileItems.filter(f => f.scannedAlbum === album);
              return (
                <Card key={album} size="small" style={{ marginBottom: 12 }}>
                  <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col flex="auto">
                      <Text strong style={{ fontSize: 13 }}>{album || '未分类专辑'}</Text>
                      <Tag style={{ marginLeft: 8 }}>{albumFiles.length} 首</Tag>
                    </Col>
                    <Col>
                      <Text style={{ fontSize: 12, marginRight: 4 }}>游戏：</Text>
                      <Select
                        size="small"
                        value={gameId}
                        onChange={v => setAlbumGameMap(prev => ({ ...prev, [album]: v }))}
                        style={{ width: 140, fontSize: 12 }}
                        options={games}
                      />
                    </Col>
                  </Row>
                  {albumFiles.map((item, idx) => (
                    <Row key={item.uid} gutter={8} style={{ marginBottom: 2 }} align="middle">
                      <Col span={2} style={{ textAlign: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {item.scannedTrackNumber ? `#${item.scannedTrackNumber}` : `${idx + 1}`}
                        </Text>
                      </Col>
                      <Col span={16}>
                        <Text ellipsis style={{ fontSize: 11, lineHeight: '28px' }} title={item.name}>
                          {item.name}
                        </Text>
                      </Col>
                      <Col span={6}>
                        <Input
                          size="small"
                          value={item.editTitle}
                          onChange={e => setFileItems(prev => prev.map(f => f.uid === item.uid ? { ...f, editTitle: e.target.value } : f))}
                          placeholder={item.scannedTitle}
                          style={{ fontSize: 11 }}
                        />
                      </Col>
                    </Row>
                  ))}
                </Card>
              );
            })}
          </div>
          <div className="upload-footer">
            <Button onClick={() => setCurrentStep(0)}>上一步</Button>
            <Button type="primary" icon={<UploadIcon />} onClick={() => setCurrentStep(2)}>
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
                  <div className="upload-stat-num" style={{ color: '#52c41a' }}>
                    手动
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
            <Button onClick={() => setCurrentStep(1)} disabled={uploading}>上一步</Button>
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


