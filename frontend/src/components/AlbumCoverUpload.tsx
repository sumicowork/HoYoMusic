import React, { useState } from 'react';
import { Modal, Upload, message, Button } from 'antd';
import { UploadOutlined, PictureOutlined } from '@ant-design/icons';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface AlbumCoverUploadProps {
  visible: boolean;
  albumId: number;
  currentCover?: string;
  onClose: () => void;
  onSuccess: (coverPath: string) => void;
}

const AlbumCoverUpload: React.FC<AlbumCoverUploadProps> = ({
  visible,
  albumId,
  currentCover,
  onClose,
  onSuccess
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleBeforeUpload = (file: RcFile) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件！');
      return false;
    }

    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('图片大小不能超过 5MB！');
      return false;
    }

    // Preview image
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setFileList([file as any]);
    return false; // Prevent auto upload
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请选择图片文件');
      return;
    }

    const formData = new FormData();
    formData.append('cover', fileList[0] as any);

    try {
      setUploading(true);
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API_URL}/albums/${albumId}/cover`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        message.success('封面上传成功！');
        onSuccess(response.data.data.cover_path);
        handleCancel();
      }
    } catch (error: any) {
      console.error('Upload cover error:', error);
      message.error(error.response?.data?.error?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setFileList([]);
    setPreviewImage(null);
    onClose();
  };

  const handleRemove = () => {
    setFileList([]);
    setPreviewImage(null);
  };

  return (
    <Modal
      title="上传专辑封面"
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="upload"
          type="primary"
          loading={uploading}
          onClick={handleUpload}
          disabled={fileList.length === 0}
        >
          上传
        </Button>
      ]}
      width={600}
    >
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: '#666', marginBottom: 8 }}>
          支持 JPG、PNG、GIF 等图片格式，建议尺寸 1000x1000 像素，大小不超过 5MB
        </p>
      </div>

      {currentCover && !previewImage && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8, fontWeight: 500 }}>当前封面：</p>
          <img
            src={`http://localhost:3000${currentCover}`}
            alt="Current cover"
            style={{
              width: 200,
              height: 200,
              objectFit: 'cover',
              borderRadius: 8,
              border: '1px solid #d9d9d9'
            }}
          />
        </div>
      )}

      {previewImage && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8, fontWeight: 500 }}>新封面预览：</p>
          <img
            src={previewImage}
            alt="Preview"
            style={{
              width: 200,
              height: 200,
              objectFit: 'cover',
              borderRadius: 8,
              border: '1px solid #d9d9d9'
            }}
          />
        </div>
      )}

      <Upload
        beforeUpload={handleBeforeUpload}
        onRemove={handleRemove}
        fileList={fileList}
        maxCount={1}
        listType="picture"
        accept="image/*"
      >
        <Button icon={<UploadOutlined />} disabled={fileList.length >= 1}>
          选择图片
        </Button>
      </Upload>

      {fileList.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: '#f0f2f5', borderRadius: 4 }}>
          <PictureOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          <span style={{ color: '#666' }}>
            已选择: {fileList[0].name} ({(fileList[0].size! / 1024).toFixed(2)} KB)
          </span>
        </div>
      )}
    </Modal>
  );
};

export default AlbumCoverUpload;

