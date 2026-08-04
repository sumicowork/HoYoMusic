import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, message, Space, Upload, Typography } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

const { TextArea } = Input;
const { Text } = Typography;
type LyricsStatus = 'none' | 'has' | 'instrumental';

interface LyricsEditorProps {
  trackId: number;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LyricsEditor: React.FC<LyricsEditorProps> = ({ trackId, visible, onClose, onSuccess }) => {
  const [lyrics, setLyrics] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [lyricsStatus, setLyricsStatus] = useState<LyricsStatus>('none');

  useEffect(() => {
    if (visible) {
      fetchLyrics();
    }
  }, [visible, trackId]);

  const fetchLyrics = async () => {
    try {
      const token = localStorage.getItem('token');
      const trackResponse = await axios.get(`${API_BASE_URL}/tracks/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const track = trackResponse.data?.data?.track;
      const trackLyricsPath = typeof track?.lyrics_path === 'string' && track.lyrics_path.trim().length > 0;
      const normalizedStatus: LyricsStatus = track?.lyrics_status === 'has' || track?.lyrics_status === 'instrumental' || track?.lyrics_status === 'none'
        ? track.lyrics_status
        : trackLyricsPath
          ? 'has'
          : 'none';

      setLyricsStatus(normalizedStatus);

      if (normalizedStatus !== 'has') {
        setLyrics('');
        setHasExisting(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/lyrics/${trackId}/lyrics`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.data.lyrics) {
        setLyrics(response.data.data.lyrics);
        setHasExisting(true);
      } else {
        setLyrics('');
        setHasExisting(false);
      }
    } catch (error) {
      setLyrics('');
      setHasExisting(false);
    }
  };

  const handleSave = async () => {
    if (lyricsStatus === 'instrumental') {
      message.warning('当前曲目标记为纯音乐，请先取消纯音乐标记后再保存歌词');
      return;
    }

    if (!lyrics.trim()) {
      message.error('请输入歌词内容');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = `${API_BASE_URL}/lyrics/${trackId}/lyrics`;
      const method = hasExisting ? 'put' : 'post';

      await axios[method](url, { lyrics, mode: 'cleaned' }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      message.success('歌词已保存');
      setLyricsStatus('has');
      onSuccess();
      onClose();
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '保存歌词失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Modal.confirm({
      title: '删除歌词',
      content: '确定要删除此曲目的歌词吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          await axios.delete(`${API_BASE_URL}/lyrics/${trackId}/lyrics`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          message.success('歌词已删除');
          setLyrics('');
          setHasExisting(false);
          setLyricsStatus('none');
          onSuccess();
          onClose();
        } catch (error: any) {
          message.error(error.response?.data?.error?.message || '删除歌词失败');
        }
      }
    });
  };

  const handleMarkInstrumental = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/lyrics/${trackId}/instrumental`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('已标记为纯音乐');
      setLyrics('');
      setHasExisting(false);
      setLyricsStatus('instrumental');
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '标记纯音乐失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUnmarkInstrumental = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/lyrics/${trackId}/lyrics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('已取消纯音乐标记');
      setLyricsStatus('none');
      setLyrics('');
      setHasExisting(false);
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '取消纯音乐标记失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLrcFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setLyrics(content);
      if (lyricsStatus === 'instrumental') {
        setLyricsStatus('none');
      }
      message.success(`已加载 ${file.name}`);
    };
    reader.onerror = () => message.error('读取文件失败');
    reader.readAsText(file, 'utf-8');
    return false; // prevent auto upload
  };

  return (
    <Modal
      title={lyricsStatus === 'instrumental' ? '歌词编辑（纯音乐）' : (hasExisting ? '编辑歌词' : '上传歌词')}
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        lyricsStatus === 'instrumental' ? (
          <Button key="unmark" onClick={handleUnmarkInstrumental} loading={loading}>
            取消纯音乐标记
          </Button>
        ) : (
          <Button key="instrumental" onClick={handleMarkInstrumental} loading={loading}>
            标记为纯音乐
          </Button>
        ),
        hasExisting && (
          <Button key="delete" danger onClick={handleDelete}>
            删除歌词
          </Button>
        ),
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" loading={loading} onClick={handleSave} disabled={lyricsStatus === 'instrumental'}>
          保存
        </Button>,
      ]}
    >
      {lyricsStatus === 'instrumental' && (
        <div style={{ marginBottom: 12 }}>
          <Text style={{ color: '#1677ff', fontSize: 12 }}>
            当前曲目标记为纯音乐（蓝色状态）。若需填写歌词，请先点击“取消纯音乐标记”。
          </Text>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <Space>
          <Upload
            accept=".lrc"
            showUploadList={false}
            beforeUpload={handleLrcFileUpload}
            disabled={lyricsStatus === 'instrumental'}
          >
            <Button icon={<UploadOutlined />} size="small" disabled={lyricsStatus === 'instrumental'}>
              导入 .lrc 文件
            </Button>
          </Upload>
          <Text type="secondary" style={{ fontSize: 12 }}>
            或在下方直接粘贴 LRC 格式歌词
          </Text>
        </Space>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          LRC 格式示例：
        </Text>
        <pre style={{ background: 'rgba(0,0,0,0.04)', padding: '6px 10px', fontSize: 11, borderRadius: 4, margin: '4px 0 0' }}>
          [00:12.00]第一行歌词{'\n'}
          [00:17.20]第二行歌词{'\n'}
          [00:21.10]第三行歌词
        </pre>
      </div>

      <TextArea
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder="在此粘贴 LRC 格式歌词，或使用上方按钮导入 .lrc 文件..."
        rows={15}
        disabled={lyricsStatus === 'instrumental'}
        style={{ fontFamily: 'monospace', fontSize: 13 }}
      />
    </Modal>
  );
};

export default LyricsEditor;

