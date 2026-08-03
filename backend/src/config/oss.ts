import OSS from 'ali-oss';
import dotenv from 'dotenv';

dotenv.config();

// 阿里云 OSS 配置
export interface OSSConfig {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint?: string;       // 自定义 Endpoint（可选，默认按 region 生成）
  cdnDomain?: string;      // 自定义 CDN 域名（可选，否则使用 OSS 默认域名）
  secure: boolean;         // 是否使用 HTTPS
  basePath: string;        // OSS 内文件路径前缀，例如 "hoyomusic"
}

// 从环境变量读取配置
export const ossConfig: OSSConfig = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  bucket: process.env.OSS_BUCKET || '',
  endpoint: process.env.OSS_ENDPOINT || undefined,
  cdnDomain: process.env.OSS_CDN_DOMAIN || undefined,
  secure: process.env.OSS_SECURE !== 'false', // 默认 true
  basePath: (process.env.OSS_BASE_PATH || 'hoyomusic').replace(/^\/|\/$/g, ''),
};

// 创建 OSS 客户端实例（懒加载）
let ossClient: OSS | null = null;
let ossClientPublic: OSS | null = null;

/** 内网 OSS 客户端：服务器→OSS 操作使用，免外网流量费 */
export const getOSSClient = (): OSS => {
  if (!ossClient) {
    if (!ossConfig.accessKeyId || !ossConfig.accessKeySecret || !ossConfig.bucket) {
      throw new Error(
        'OSS configuration is incomplete. Please set OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET in .env'
      );
    }

    const clientOptions: OSS.Options = {
      region: ossConfig.region,
      accessKeyId: ossConfig.accessKeyId,
      accessKeySecret: ossConfig.accessKeySecret,
      bucket: ossConfig.bucket,
      secure: ossConfig.secure,
      internal: true, // 内网 endpoint，免外网流量费
      timeout: 300000, // 5min — large FLAC uploads need more time
    };

    if (ossConfig.endpoint) {
      clientOptions.endpoint = ossConfig.endpoint;
    }

    ossClient = new OSS(clientOptions);
    console.log(`[OSS] Client initialized (internal). Region: ${ossConfig.region}, Bucket: ${ossConfig.bucket}`);
  }
  return ossClient;
};

/** 公网 OSS 客户端：仅用于生成预签名上传 URL（前端直传需要公网地址） */
export const getOSSPublicClient = (): OSS => {
  if (!ossClientPublic) {
    ossClientPublic = new OSS({
      region: ossConfig.region,
      accessKeyId: ossConfig.accessKeyId,
      accessKeySecret: ossConfig.accessKeySecret,
      bucket: ossConfig.bucket,
      secure: ossConfig.secure,
      timeout: 300000,
    });
    console.log('[OSS] Public client initialized for pre-signed URLs');
  }
  return ossClientPublic;
};

/**
 * 根据 OSS object key 生成公开访问 URL
 * 优先使用自定义 CDN 域名，否则使用 OSS 默认域名
 */
export const buildOSSPublicUrl = (objectKey: string): string => {
  const key = objectKey.replace(/^\//, '');
  if (ossConfig.cdnDomain) {
    const domain = ossConfig.cdnDomain.replace(/\/$/, '');
    const scheme = ossConfig.secure ? 'https' : 'http';
    return `${scheme}://${domain}/${key}`;
  }
  // 默认 OSS 域名格式：https://<bucket>.<region>.aliyuncs.com/<key>
  const scheme = ossConfig.secure ? 'https' : 'http';
  return `${scheme}://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com/${key}`;
};

/**
 * 测试 OSS 连接（检查 bucket 是否可访问）
 */
export const testOSSConnection = async (): Promise<boolean> => {
  try {
    const client = getOSSClient();
    await client.getBucketInfo(ossConfig.bucket);
    console.log('[OSS] Connection test successful');
    return true;
  } catch (error: any) {
    // getBucketInfo 需要特定权限，如果返回 AccessDenied 说明 key/secret 正确但权限受限，仍算连通
    if (error.code === 'AccessDenied' || error.name === 'AccessDeniedError') {
      console.warn('[OSS] Connection OK (AccessDenied on getBucketInfo — check bucket policy)');
      return true;
    }
    console.error('[OSS] Connection test failed:', error.message);
    return false;
  }
};

/**
 * 初始化 OSS（目前仅做连接验证，OSS 无需创建目录）
 */
export const initOSSDirectories = async (): Promise<void> => {
  // OSS 使用对象存储，不需要预先创建目录
  // 路径前缀会在上传时自动生成
  console.log(`[OSS] Base path prefix: ${ossConfig.basePath}`);
  console.log('[OSS] Storage structure initialized (tracks / covers / lyrics)');
};

export default getOSSClient;

