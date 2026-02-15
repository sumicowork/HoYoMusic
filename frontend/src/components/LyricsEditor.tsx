import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, message, Space } from 'antd';
import { UploadOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';

const { TextArea } = Input;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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

  useEffect(() => {
    if (visible) {
      fetchLyrics();
    }
  }, [visible, trackId]);

  const fetchLyrics = async () => {
    try {
      const token = localStorage.getItem('token');
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
    if (!lyrics.trim()) {
      message.error('Please enter lyrics content');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = hasExisting
        ? `${API_BASE_URL}/lyrics/${trackId}/lyrics`
        : `${API_BASE_URL}/lyrics/${trackId}/lyrics`;

      const method = hasExisting ? 'put' : 'post';

      await axios[method](url, { lyrics }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      message.success('Lyrics saved successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || 'Failed to save lyrics');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Modal.confirm({
      title: 'Delete Lyrics',
      content: 'Are you sure you want to delete the lyrics?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          await axios.delete(`${API_BASE_URL}/lyrics/${trackId}/lyrics`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          message.success('Lyrics deleted successfully');
          setLyrics('');
          setHasExisting(false);
          onSuccess();
          onClose();
        } catch (error: any) {
          message.error(error.response?.data?.error?.message || 'Failed to delete lyrics');
        }
      }
    });
  };

  return (
    <Modal
      title={hasExisting ? "Edit Lyrics" : "Upload Lyrics"}
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        hasExisting && (
          <Button key="delete" danger onClick={handleDelete}>
            Delete
          </Button>
        ),
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="save" type="primary" loading={loading} onClick={handleSave}>
          Save
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: '#666', marginBottom: 8 }}>
          LRC format example:
        </p>
        <pre style={{ background: '#f5f5f5', padding: 8, fontSize: 12 }}>
          [00:12.00]First line of lyrics{'\n'}
          [00:17.20]Second line of lyrics{'\n'}
          [00:21.10]Third line of lyrics
        </pre>
      </div>

      <TextArea
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder="Enter lyrics in LRC format..."
        rows={15}
        style={{ fontFamily: 'monospace' }}
      />
    </Modal>
  );
};

export default LyricsEditor;

