import { createClient, WebDAVClient } from 'webdav';
import dotenv from 'dotenv';

dotenv.config();

// WebDAV配置
export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  basePath: string;
  publicUrl: string; // 公开访问的URL前缀
}

// 从环境变量读取配置
export const webdavConfig: WebDAVConfig = {
  url: process.env.WEBDAV_URL || 'http://localhost:8080/webdav',
  username: process.env.WEBDAV_USERNAME || 'admin',
  password: process.env.WEBDAV_PASSWORD || 'admin',
  basePath: process.env.WEBDAV_BASE_PATH || '/hoyomusic',
  publicUrl: process.env.WEBDAV_PUBLIC_URL || 'http://localhost:8080/webdav/hoyomusic',
};

// 创建WebDAV客户端实例
let webdavClient: WebDAVClient | null = null;

export const getWebDAVClient = (): WebDAVClient => {
  if (!webdavClient) {
    webdavClient = createClient(webdavConfig.url, {
      username: webdavConfig.username,
      password: webdavConfig.password,
    });
  }
  return webdavClient;
};

// 初始化WebDAV目录结构
export const initWebDAVDirectories = async (): Promise<void> => {
  const client = getWebDAVClient();
  const basePath = webdavConfig.basePath;

  try {
    // 创建基础目录结构
    const directories = [
      basePath,
      `${basePath}/covers`,      // 专辑封面
      `${basePath}/tracks`,      // 音频文件
      `${basePath}/lyrics`,      // 歌词文件
    ];

    for (const dir of directories) {
      try {
        const exists = await client.exists(dir);
        if (!exists) {
          await client.createDirectory(dir);
          console.log(`Created WebDAV directory: ${dir}`);
        }
      } catch (error: any) {
        // 如果目录已存在，忽略错误
        if (!error.message?.includes('exists')) {
          console.error(`Error creating directory ${dir}:`, error.message);
        }
      }
    }

    console.log('WebDAV directories initialized successfully');
  } catch (error: any) {
    console.error('Error initializing WebDAV directories:', error.message);
    throw error;
  }
};

// 验证WebDAV连接
export const testWebDAVConnection = async (): Promise<boolean> => {
  try {
    const client = getWebDAVClient();
    await client.getDirectoryContents('/');
    console.log('WebDAV connection successful');
    return true;
  } catch (error: any) {
    console.error('WebDAV connection failed:', error.message);
    return false;
  }
};

export default getWebDAVClient;

