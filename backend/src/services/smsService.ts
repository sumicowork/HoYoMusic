// 短信服务抽象（手机号实名验证用）
// 开发模式：验证码输出到日志 + 控制台，不真实发送
// 生产模式：预留阿里云 SMS 接入（SMS_ACCESS_KEY_ID/SMS_ACCESS_KEY_SECRET/SMS_SIGN_NAME/SMS_TEMPLATE_CODE）
// 合规：《互联网跟帖评论服务管理规定》第4条① 基于移动电话号码的真实身份信息认证

import crypto from 'crypto';

export interface SmsResult {
  success: boolean;
  message: string;
}

export function createSmsCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function sendSmsCode(phone: string, code: string): Promise<SmsResult> {
  const accessKeyId = process.env.SMS_ACCESS_KEY_ID;
  const signName = process.env.SMS_SIGN_NAME;

  if (!accessKeyId || !signName) {
    // 开发/未配置模式：不真实发送，验证码打进日志（生产接入后自动切换）
    console.log(`[sms] 开发模式验证码 phone=${phone} code=${code}`);
    return { success: true, message: '开发模式：验证码已输出到日志' };
  }

  // 阿里云 SMS 接入点（预留，配置后生效）
  try {
    const templateCode = process.env.SMS_TEMPLATE_CODE || '';
    // TODO: 使用阿里云 SMS SDK 发送（@alicloud/dysmsapi20170525）
    // const client = new DysmsapiClient({ accessKeyId, accessKeySecret });
    // await client.sendSms({ PhoneNumbers: phone, SignName: signName, TemplateCode: templateCode, TemplateParam: JSON.stringify({ code }) });
    throw new Error('阿里云 SMS SDK 未接入，请安装 @alicloud/dysmsapi20170525 并实现发送');
  } catch (e) {
    console.error('[sms] 发送失败:', (e as Error).message);
    return { success: false, message: '短信服务暂不可用' };
  }
}
