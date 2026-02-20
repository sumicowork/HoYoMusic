import React, { useState, useCallback } from 'react';
import {
  Modal,
  Upload,
  Button,
  Progress,
  List,
  Tag,
  Typography,
  Space,
  Divider,
  Result,
  Badge,
} from 'antd';
import {
  InboxOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SoundOutlined,
  LoadingOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { trackService } from '../services/trackService';
import { toast } from '../utils/toast';
import './UploadModal.css';

const { Dragger } = Upload;
const { Text } = Typography;

interface FileItem {
  uid: string;
  name: string;
  originFileObj: File;
  size: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  detectedTitle?: string;
  detectedArtist?: string;
  detectedAlbum?: string;
}

interface UploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ visible, onClose, onSuccess }) => {
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ success: number; fail: number }>({ success: 0, fail: 0 });

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleBeforeUpload = useCallback(
    (file: File) => {
      const isFlac = file.name.toLowerCase().endsWith('.flac') || file.type === 'audio/flac' || file.type === 'audio/x-flac';
      if (!isFlac) {
        toast.error(`${file.name} 不是 FLAC 格式，已跳过`);
        return Upload.LIST_IGNORE;
      }
      // 解析文件名猜测元数据
      const base = file.name.replace(/\.flac$/i, '');
      // 尝试 "Artist - Title" 或 "01. Title" 等格式
      let detectedTitle = base;
      let detectedArtist = '';
      let detectedAlbum = '';
      const artistTitleMatch = base.match(/^(.+?)\s*[-–]\s*(.+)$/);
      if (artistTitleMatch) {
        detectedArtist = artistTitleMatch[1].trim();
        detectedTitle = artistTitleMatch[2].replace(/^\d+\.\s*/, '').trim();
      } else {
        detectedTitle = base.replace(/^\d+\.\s*/, '').trim();
      }

      const newItem: FileItem = {
        uid: `${Date.now()}-${Math.random()}`,
        name: file.name,
        originFileObj: file,
        size: file.size,
        status: 'pending',
        detectedTitle,
        detectedArtist,
        detectedAlbum,
      };

      setFileItems(prev => {
        // 去重
        if (prev.some(f => f.name === file.name && f.size === file.size)) return prev;
        return [...prev, newItem];
      });
      return false; // 阻止自动上传
    },
    []
  );

  const handleRemoveFile = (uid: string) => {
    setFileItems(prev => prev.filter(f => f.uid !== uid));
  };

  const handleStartUpload = async () => {
    if (fileItems.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadDone(false);

    let successCount = 0;
    let failCount = 0;

    // 逐文件上传，实时更新进度
    for (let i = 0; i < fileItems.length; i++) {
      const item = fileItems[i];
      setFileItems(prev =>
        prev.map(f => f.uid === item.uid ? { ...f, status: 'uploading' } : f)
      );

      try {
        await trackService.uploadTracks([item.originFileObj]);
        setFileItems(prev =>
          prev.map(f => f.uid === item.uid ? { ...f, status: 'done' } : f)
        );
        successCount++;
      } catch (e: any) {
        setFileItems(prev =>
          prev.map(f =>
            f.uid === item.uid
              ? { ...f, status: 'error', error: e?.message || '上传失败' }
              : f
          )
        );
        failCount++;
      }
      setUploadProgress(Math.round(((i + 1) / fileItems.length) * 100));
    }

    setUploading(false);
    setUploadDone(true);
    setUploadResults({ success: successCount, fail: failCount });

    if (successCount > 0) {
      toast.success(`成功上传 ${successCount} 首`);
      onSuccess();
    }
    if (failCount > 0) {
      toast.error(`${failCount} 首上传失败`);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    setFileItems([]);
    setUploadDone(false);
    setUploadProgress(0);
    onClose();
  };

  const pendingCount = fileItems.filter(f => f.status === 'pending').length;
  const doneCount = fileItems.filter(f => f.status === 'done').length;
  const errorCount = fileItems.filter(f => f.status === 'error').length;
  const totalSize = fileItems.reduce((s, f) => s + f.size, 0);

  return (
    <Modal
      title={
        <Space>
          <CloudUploadOutlined style={{ color: '#667eea' }} />
          <span>上传音乐</span>
          {fileItems.length > 0 && (
            <Badge count={fileItems.length} color="#667eea" />
          )}
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={700}
      footer={null}
      className="upload-modal"
      maskClosable={!uploading}
    >
      {/* 拖拽区域 */}
      {!uploadDone && (
        <Dragger
          multiple
          accept=".flac"
          beforeUpload={handleBeforeUpload}
          showUploadList={false}
          disabled={uploading}
          className="upload-dragger"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#667eea', fontSize: 48 }} />
          </p>
          <p className="ant-upload-text">点击或拖拽 FLAC 文件到此区域</p>
          <p className="ant-upload-hint">支持批量上传，仅支持 .flac 格式</p>
        </Dragger>
      )}

      {/* 上传完成结果 */}
      {uploadDone && (
        <Result
          status={uploadResults.fail === 0 ? 'success' : 'warning'}
          title={
            uploadResults.fail === 0
              ? `全部上传成功！共 ${uploadResults.success} 首`
              : `上传完成：${uploadResults.success} 成功，${uploadResults.fail} 失败`
          }
          extra={
            <Button type="primary" onClick={handleClose}>
              关闭
            </Button>
          }
        />
      )}

      {/* 文件列表 */}
      {fileItems.length > 0 && !uploadDone && (
        <>
          <Divider style={{ margin: '16px 0 8px' }} />
          <div className="upload-file-summary">
            <Text type="secondary">
              共 {fileItems.length} 个文件 · {formatSize(totalSize)}
            </Text>
            <Space>
              {doneCount > 0 && <Tag color="green">{doneCount} 完成</Tag>}
              {errorCount > 0 && <Tag color="red">{errorCount} 失败</Tag>}
              {pendingCount > 0 && <Tag color="blue">{pendingCount} 待上传</Tag>}
            </Space>
          </div>
          {uploading && (
            <Progress
              percent={uploadProgress}
              status={uploadProgress < 100 ? 'active' : 'success'}
              style={{ margin: '8px 0' }}
            />
          )}
          <List
            className="upload-file-list"
            size="small"
            dataSource={fileItems}
            renderItem={item => (
              <List.Item
                className={`upload-file-item upload-file-item--${item.status}`}
                actions={[
                  item.status === 'pending' && !uploading ? (
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      danger
                      onClick={() => handleRemoveFile(item.uid)}
                    />
                  ) : null,
                  item.status === 'done' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : null,
                  item.status === 'error' ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> : null,
                  item.status === 'uploading' ? <LoadingOutlined style={{ color: '#667eea' }} /> : null,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={<SoundOutlined style={{ fontSize: 20, color: '#667eea', marginTop: 2 }} />}
                  title={
                    <div className="upload-file-meta">
                      <Text ellipsis style={{ maxWidth: 280 }} title={item.name}>
                        {item.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{formatSize(item.size)}</Text>
                    </div>
                  }
                  description={
                    <div className="upload-file-detected">
                      {item.detectedTitle && (
                        <Tag color="purple" style={{ fontSize: 11 }}>标题: {item.detectedTitle}</Tag>
                      )}
                      {item.detectedArtist && (
                        <Tag color="blue" style={{ fontSize: 11 }}>艺术家: {item.detectedArtist}</Tag>
                      )}
                      {item.status === 'error' && (
                        <Tag color="red" style={{ fontSize: 11 }}>❌ {item.error}</Tag>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}

      {/* 操作区 */}
      {!uploadDone && (
        <div className="upload-footer">
          <Button onClick={handleClose} disabled={uploading}>
            取消
          </Button>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            loading={uploading}
            disabled={fileItems.length === 0 || uploading}
            onClick={handleStartUpload}
          >
            {uploading ? `上传中 ${uploadProgress}%` : `开始上传 ${fileItems.length > 0 ? `(${fileItems.length})` : ''}`}
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default UploadModal;


