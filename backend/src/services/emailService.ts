import nodemailer from 'nodemailer';

interface MailEnvConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

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

  const now = new Date().toISOString();
  await transporter.sendMail({
    from: config.from,
    to,
    subject: 'HoYoMusic - 测试邮件',
    text: `这是一封 HoYoMusic 后台发送的测试邮件。\n发送时间：${now}`,
    html: `<p>这是一封 <strong>HoYoMusic</strong> 后台发送的测试邮件。</p><p>发送时间：${now}</p>`,
  });
};

