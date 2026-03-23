import nodemailer from 'nodemailer';

interface MailEnvConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

const formatBeijingTime = (date: Date): string => date.toLocaleString('zh-CN', {
  hour12: false,
  timeZone: 'Asia/Shanghai',
});

const getMissingMailEnvKeys = (): string[] => {
  const required = ['MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASS', 'MAIL_FROM'] as const;
  return required.filter((key) => !process.env[key] || !String(process.env[key]).trim());
};

const getMailEnvConfig = (): MailEnvConfig | null => {
  const host = process.env.MAIL_HOST || '';
  const user = process.env.MAIL_USER || '';
  const pass = process.env.MAIL_PASS || '';
  const from = process.env.MAIL_FROM || user;
  const portRaw = Number(process.env.MAIL_PORT || 465);
  const secure = String(process.env.MAIL_SECURE || 'true').toLowerCase() === 'true';

  if (!host || !user || !pass || !from || !Number.isFinite(portRaw)) {
    return null;
  }

  return {
    host,
    port: portRaw,
    secure,
    user,
    pass,
    from,
  };
};

export const isMailConfigured = (): boolean => getMailEnvConfig() !== null;

export const getMailConfigurationError = (): string | null => {
  const missing = getMissingMailEnvKeys();
  if (missing.length > 0) {
    return `缺少 SMTP 配置项: ${missing.join(', ')}`;
  }
  return null;
};

export const sendTestEmail = async (to: string): Promise<void> => {
  const config = getMailEnvConfig();
  if (!config) {
    throw new Error('MAIL_NOT_CONFIGURED');
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const now = new Date();
  const issuedAt = formatBeijingTime(now);
  const expiresAt = formatBeijingTime(new Date(now.getTime() + 10 * 60 * 1000));
  const verificationCode = String(Math.floor(100000 + Math.random() * 900000));

  const textContent = [
    'HoYoMusic 验证码',
    '',
    `验证码：${verificationCode}`,
    '有效期：10 分钟',
    `签发时间：${issuedAt}`,
    `失效时间：${expiresAt}`,
    '',
    '如果这不是你的操作，请忽略此邮件。',
  ].join('\n');

  const htmlContent = `
  <div style="margin:0;padding:24px;background:#0f1324;font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;">
    <div style="max-width:620px;margin:0 auto;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.45);background:linear-gradient(135deg,#1f2a5a 0%,#302861 50%,#191f43 100%);">
      <div style="padding:26px 32px;background:radial-gradient(circle at top right,rgba(137,180,255,0.45),rgba(137,180,255,0) 42%),radial-gradient(circle at bottom left,rgba(255,118,196,0.35),rgba(255,118,196,0) 38%);border-bottom:1px solid rgba(255,255,255,0.12);">
        <div style="font-size:13px;letter-spacing:1px;color:#c5d6ff;text-transform:uppercase;">HoYoMusic Security Center</div>
        <h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;color:#ffffff;">登录验证码</h1>
      </div>

      <div style="padding:28px 32px;background:rgba(7,10,23,0.55);">
        <p style="margin:0 0 14px;color:#dce6ff;font-size:15px;line-height:1.7;">您好，</p>
        <p style="margin:0 0 20px;color:#dce6ff;font-size:15px;line-height:1.7;">你正在进行账号验证，请在页面输入以下验证码完成身份确认：</p>

        <div style="margin:0 auto 20px;padding:14px 16px;border:1px solid rgba(255,255,255,0.18);border-radius:14px;background:linear-gradient(135deg,rgba(111,168,255,0.2),rgba(255,122,198,0.18));text-align:center;">
          <span style="display:inline-block;font-size:40px;letter-spacing:8px;font-weight:700;color:#ffffff;">${verificationCode}</span>
        </div>

        <div style="padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);">
          <p style="margin:0 0 8px;color:#b9c8f5;font-size:13px;">有效期：10 分钟</p>
          <p style="margin:0 0 8px;color:#b9c8f5;font-size:13px;">签发时间：${issuedAt}</p>
          <p style="margin:0;color:#b9c8f5;font-size:13px;">失效时间：${expiresAt}</p>
        </div>

        <p style="margin:20px 0 0;color:#aebce6;font-size:13px;line-height:1.8;">若非本人操作，请忽略本邮件并尽快修改密码。</p>
      </div>

      <div style="padding:14px 24px;text-align:center;background:rgba(5,8,18,0.55);border-top:1px solid rgba(255,255,255,0.08);">
        <span style="font-size:12px;color:#8ea0d4;">This is a system-generated message from HoYoMusic</span>
      </div>
    </div>
  </div>`;

  await transporter.sendMail({
    from: config.from,
    to,
    subject: 'HoYoMusic - 验证码邮件模板测试',
    text: textContent,
    html: htmlContent,
  });
};

export const sendVerificationCodeEmail = async (to: string, verificationCode: string): Promise<void> => {
  const config = getMailEnvConfig();
  if (!config) {
    throw new Error('MAIL_NOT_CONFIGURED');
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const now = new Date();
  const issuedAt = formatBeijingTime(now);
  const expiresAt = formatBeijingTime(new Date(now.getTime() + 10 * 60 * 1000));

  const textContent = [
    'HoYoMusic 注册验证码',
    '',
    `验证码：${verificationCode}`,
    '有效期：10 分钟',
    `签发时间：${issuedAt}`,
    `失效时间：${expiresAt}`,
    '',
    '如果这不是你的操作，请忽略此邮件。',
  ].join('\n');

  const htmlContent = `
  <div style="margin:0;padding:24px;background:#0f1324;font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;">
    <div style="max-width:620px;margin:0 auto;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.45);background:linear-gradient(135deg,#1f2a5a 0%,#302861 50%,#191f43 100%);">
      <div style="padding:26px 32px;background:radial-gradient(circle at top right,rgba(137,180,255,0.45),rgba(137,180,255,0) 42%),radial-gradient(circle at bottom left,rgba(255,118,196,0.35),rgba(255,118,196,0) 38%);border-bottom:1px solid rgba(255,255,255,0.12);">
        <div style="font-size:13px;letter-spacing:1px;color:#c5d6ff;text-transform:uppercase;">HoYoMusic Security Center</div>
        <h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;color:#ffffff;">注册验证码</h1>
      </div>

      <div style="padding:28px 32px;background:rgba(7,10,23,0.55);">
        <p style="margin:0 0 14px;color:#dce6ff;font-size:15px;line-height:1.7;">您好，</p>
        <p style="margin:0 0 20px;color:#dce6ff;font-size:15px;line-height:1.7;">你正在进行账号注册，请输入以下验证码完成邮箱确认：</p>

        <div style="margin:0 auto 20px;padding:14px 16px;border:1px solid rgba(255,255,255,0.18);border-radius:14px;background:linear-gradient(135deg,rgba(111,168,255,0.2),rgba(255,122,198,0.18));text-align:center;">
          <span style="display:inline-block;font-size:40px;letter-spacing:8px;font-weight:700;color:#ffffff;">${verificationCode}</span>
        </div>

        <div style="padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);">
          <p style="margin:0 0 8px;color:#b9c8f5;font-size:13px;">有效期：10 分钟</p>
          <p style="margin:0 0 8px;color:#b9c8f5;font-size:13px;">签发时间：${issuedAt}</p>
          <p style="margin:0;color:#b9c8f5;font-size:13px;">失效时间：${expiresAt}</p>
        </div>

        <p style="margin:20px 0 0;color:#aebce6;font-size:13px;line-height:1.8;">若非本人操作，请忽略本邮件。</p>
      </div>

      <div style="padding:14px 24px;text-align:center;background:rgba(5,8,18,0.55);border-top:1px solid rgba(255,255,255,0.08);">
        <span style="font-size:12px;color:#8ea0d4;">This is a system-generated message from HoYoMusic</span>
      </div>
    </div>
  </div>`;

  await transporter.sendMail({
    from: config.from,
    to,
    subject: 'HoYoMusic - 注册验证码',
    text: textContent,
    html: htmlContent,
  });
};

