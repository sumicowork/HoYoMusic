/**
 * 全局 Toast 通知工具
 * 基于 Ant Design message/notification，提供统一的调用接口
 */
import { message, notification } from 'antd';

// ---- 简短提示 (message) ----
export const toast = {
  success: (content: string, duration = 2.5) => {
    message.success({ content, duration });
  },
  error: (content: string, duration = 3.5) => {
    message.error({ content, duration });
  },
  warning: (content: string, duration = 3) => {
    message.warning({ content, duration });
  },
  info: (content: string, duration = 2.5) => {
    message.info({ content, duration });
  },
  loading: (content: string, duration = 0) => {
    return message.loading({ content, duration });
  },
};

// ---- 富通知 (notification，右上角带标题) ----
export const notify = {
  success: (title: string, desc?: string) => {
    notification.success({ message: title, description: desc, placement: 'topRight', duration: 3 });
  },
  error: (title: string, desc?: string) => {
    notification.error({ message: title, description: desc, placement: 'topRight', duration: 4 });
  },
  warning: (title: string, desc?: string) => {
    notification.warning({ message: title, description: desc, placement: 'topRight', duration: 3.5 });
  },
  info: (title: string, desc?: string) => {
    notification.info({ message: title, description: desc, placement: 'topRight', duration: 3 });
  },
};

