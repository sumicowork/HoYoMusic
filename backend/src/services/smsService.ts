// 短信服务抽象（手机号实名验证用）
// 生产模式：阿里云 SMS 接入（SMS_ACCESS_KEY_ID/SMS_ACCESS_KEY_SECRET/SMS_SIGN_NAME/SMS_TEMPLATE_CODE）
// 合规：《互联网跟帖评论服务管理规定》第4条① 基于移动电话号码的真实身份信息认证
// ⚠️ 2026-08-07 体检修复：未配置短信通道时拒绝发送（此前"假装成功 + 验证码明文进日志"，
//    生产环境泄露验证码且实名形同虚设）；任何情况下验证码绝不写入日志。

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
    // 未配置短信通道：拒绝发送并明确报错（不落验证码明文，日志仅记脱敏手机号）
    console.warn(`[sms] 短信通道未配置（SMS_ACCESS_KEY_ID/SMS_SIGN_NAME），拒绝发送 phone=${maskPhone(phone)}`);
    return { success: false, message: '短信服务未配置，实名认证暂不可用' };
  }

  // 阿里云 SMS 接入点（配置后生效）
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

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return '***';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}
