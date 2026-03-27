import React, { useState } from 'react';
import { App as AntApp, Button, Form, Input, Modal } from 'antd';
import { feedbackService } from '../services/feedbackService';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

interface FeedbackFormValues {
  content: string;
  contact?: string;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ open, onClose }) => {
  const [form] = Form.useForm<FeedbackFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const { message } = AntApp.useApp();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await feedbackService.submit(values.content, values.contact);
      message.success('反馈已提交，感谢你的建议');
      form.resetFields();
      onClose();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.message || '提交反馈失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="提交反馈"
      open={open}
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
          提交
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="content"
          label="反馈内容"
          rules={[
            { required: true, message: '请输入反馈内容' },
            { max: 2000, message: '反馈内容最多 2000 字' },
          ]}
        >
          <Input.TextArea rows={5} placeholder="请描述你的建议或遇到的问题" maxLength={2000} showCount />
        </Form.Item>
        <Form.Item
          name="contact"
          label="联系方式（选填）"
          rules={[{ max: 200, message: '联系方式最多 200 字' }]}
        >
          <Input placeholder="例如：邮箱 / QQ / 微信" maxLength={200} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FeedbackModal;

