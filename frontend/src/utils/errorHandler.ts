import { message } from 'antd';

export function handleApiError(error: any, fallbackMsg = '加载失败') {
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    message.error('请先登录');
  } else if (!error?.response) {
    message.error('网络连接异常，请检查网络后重试');
  } else if (error?.response?.status >= 500) {
    message.error('服务繁忙，请稍后重试');
  } else {
    message.error(fallbackMsg);
  }
}
