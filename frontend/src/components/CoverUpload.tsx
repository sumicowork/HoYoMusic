import React, { useState } from 'react';
import { Upload, message, Modal, Image } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import { albumService } from '../services/albumService';
import { trackService } from '../services/trackService';

interface CoverUploadProps {
  type: 'album' | 'track';
  id: number;
  currentCover?: string | null;
  onSuccess?: (coverPath: string) => void;
}

const CoverUpload: React.FC<CoverUploadProps> = ({ type, id, currentCover, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState(currentCover);

  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件！');
      return false;
    }
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('图片大小不能超过 10MB！');
      return false;
    }
    return true;
  };

  const handleUpload = async (options: any) => {
    const { file, onSuccess: onUploadSuccess, onError } = options;

    try {
      setLoading(true);
      let result;

      if (type === 'album') {
        result = await albumService.uploadCover(id, file);
      } else {
        result = await trackService.uploadCover(id, file);
      }

      setCoverUrl(result.cover_path);
      message.success('封面上传成功！');
      onUploadSuccess(result);

      if (onSuccess) {
        onSuccess(result.cover_path);
      }
    } catch (error: any) {
      message.error(error.message || '封面上传失败');
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  const uploadButton = (
    <div>
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>上传封面</div>
    </div>
  );

  const getCoverDisplayUrl = () => {
    if (coverUrl) {
      if (type === 'album') {
        return trackService.getCoverUrl(coverUrl);
      } else {
        return trackService.getCoverUrl(coverUrl);
      }
    }
    return undefined;
  };

  return (
    <>
      <Upload
        name="cover"
        listType="picture-card"
        className="cover-uploader"
        showUploadList={false}
        beforeUpload={beforeUpload}
        customRequest={handleUpload}
      >
        {getCoverDisplayUrl() ? (
          <img
            src={getCoverDisplayUrl()}
            alt="cover"
            style={{ width: '100%', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(true);
            }}
          />
        ) : (
          uploadButton
        )}
      </Upload>

      <Modal
        open={previewOpen}
        title="封面预览"
        footer={null}
        onCancel={() => setPreviewOpen(false)}
      >
        <Image
          alt="cover preview"
          style={{ width: '100%' }}
          src={getCoverDisplayUrl()}
        />
      </Modal>
    </>
  );
};

export default CoverUpload;


