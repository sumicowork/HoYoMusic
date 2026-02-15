import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, List, message, Space, InputNumber } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Credit {
  id: number;
  credit_key: string;
  credit_value: string;
  display_order: number;
}

interface CreditsEditorProps {
  trackId: number;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreditsEditor: React.FC<CreditsEditorProps> = ({ trackId, visible, onClose, onSuccess }) => {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCredit, setEditingCredit] = useState<Credit | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      fetchCredits();
    }
  }, [visible, trackId]);

  const fetchCredits = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/credits/${trackId}/credits`);
      if (response.data.success) {
        setCredits(response.data.data.credits);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
    }
  };

  const handleAdd = () => {
    setEditingCredit(null);
    form.resetFields();
    form.setFieldsValue({ display_order: credits.length });
  };

  const handleEdit = (credit: Credit) => {
    setEditingCredit(credit);
    form.setFieldsValue(credit);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (editingCredit) {
        // Update existing credit
        await axios.put(
          `${API_BASE_URL}/credits/${trackId}/credits/${editingCredit.id}`,
          values,
          { headers }
        );
        message.success('Credit updated successfully');
      } else {
        // Add new credit
        await axios.post(
          `${API_BASE_URL}/credits/${trackId}/credits`,
          values,
          { headers }
        );
        message.success('Credit added successfully');
      }

      form.resetFields();
      setEditingCredit(null);
      fetchCredits();
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || 'Failed to save credit');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (creditId: number) => {
    Modal.confirm({
      title: 'Delete Credit',
      content: 'Are you sure you want to delete this credit?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          await axios.delete(
            `${API_BASE_URL}/credits/${trackId}/credits/${creditId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          message.success('Credit deleted successfully');
          fetchCredits();
          onSuccess();
        } catch (error: any) {
          message.error(error.response?.data?.error?.message || 'Failed to delete credit');
        }
      }
    });
  };

  return (
    <Modal
      title="Manage Credits"
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" style={{ marginBottom: 16 }}>
        <Form.Item
          name="credit_key"
          label="Key (e.g., Producer, Composer, Vocal)"
          rules={[{ required: true, message: 'Please enter credit key' }]}
        >
          <Input placeholder="Enter credit key" />
        </Form.Item>

        <Form.Item
          name="credit_value"
          label="Value (e.g., Name, Description)"
          rules={[{ required: true, message: 'Please enter credit value' }]}
        >
          <Input placeholder="Enter credit value" />
        </Form.Item>

        <Form.Item
          name="display_order"
          label="Display Order"
          initialValue={0}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleSave} loading={loading}>
              {editingCredit ? 'Update' : 'Add'} Credit
            </Button>
            {editingCredit && (
              <Button onClick={() => { form.resetFields(); setEditingCredit(null); }}>
                Cancel
              </Button>
            )}
          </Space>
        </Form.Item>
      </Form>

      <List
        header={<div><strong>Existing Credits</strong></div>}
        bordered
        dataSource={credits}
        renderItem={(credit) => (
          <List.Item
            actions={[
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(credit)}
              />,
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(credit.id)}
              />,
            ]}
          >
            <List.Item.Meta
              title={credit.credit_key}
              description={credit.credit_value}
            />
          </List.Item>
        )}
      />
    </Modal>
  );
};

export default CreditsEditor;

