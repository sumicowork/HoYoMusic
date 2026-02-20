import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import webdavService from './webdavService';

const STORAGE_MODE = process.env.STORAGE_MODE || 'local';
const UPLOAD_DIR = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

// 确保上传目录存在
const ensureDirectories = async () => {
  const dirs = ['tracks', 'covers', 'lyrics'];
  for (const dir of dirs) {
    await fs.mkdir(path.join(UPLOAD_DIR, dir), { recursive: true });
  }
};

ensureDirectories().catch(console.error);

class StorageService {
  private mode: 'local' | 'webdav';

  constructor() {
    this.mode = (STORAGE_MODE as 'local' | 'webdav') || 'local';
    console.log(`Storage mode: ${this.mode}`);
  }

  /**
   * 上传文件
   * @param buffer 文件Buffer
   * @param filename 文件名
   * @param type 文件类型: 'tracks' | 'covers' | 'lyrics'
   * @param mimetype MIME类型
   * @returns 文件URL或路径
   */
  async uploadFile(
    buffer: Buffer,
    filename: string,
    type: 'tracks' | 'covers' | 'lyrics',
    mimetype?: string
  ): Promise<string> {
    if (this.mode === 'webdav') {
      // WebDAV模式
      const remotePath = webdavService.generateRemotePath(filename, type);
      return await webdavService.uploadFile(buffer, remotePath, mimetype);
    } else {
      // 本地存储模式
      const ext = path.extname(filename);
      const uniqueName = `${uuidv4()}${ext}`;
      const relativePath = `${type}/${uniqueName}`;  // 使用正斜杠，URL兼容
      const fullPath = path.join(UPLOAD_DIR, type, uniqueName);

      await fs.writeFile(fullPath, buffer);

      // 返回 /uploads/<type>/<filename> 格式路径，供前端直接访问
      return `/uploads/${relativePath}`;
    }
  }

  /**
   * 删除文件
   * @param filePath 文件路径
   */
  async deleteFile(filePath: string): Promise<void> {
    if (this.mode === 'webdav') {
      // WebDAV模式
      const relativePath = webdavService.extractRelativePath(filePath);
      await webdavService.deleteFile(relativePath);
    } else {
      // 本地存储模式
      const fullPath = this.getFullPath(filePath);
      try {
        await fs.unlink(fullPath);
      } catch (error) {
        console.error(`Failed to delete file: ${fullPath}`, error);
      }
    }
  }

  /**
   * 获取文件完整路径（仅本地存储）
   * @param relativePath 相对路径
   * @returns 完整路径
   */
  getFullPath(relativePath: string): string {
    if (this.mode === 'webdav') {
      return relativePath; // WebDAV模式返回URL
    }
    // 本地存储：去掉前缀 /uploads/ 后拼接实际磁盘路径
    const stripped = relativePath.startsWith('/uploads/')
      ? relativePath.slice('/uploads/'.length)
      : relativePath;
    return path.join(UPLOAD_DIR, stripped);
  }

  /**
   * 获取文件URL（用于流式传输）
   * @param filePath 文件路径
   * @returns 文件URL或路径
   */
  getFileUrl(filePath: string): string {
    if (this.mode === 'webdav') {
      return filePath; // WebDAV已经是完整URL
    }
    // 本地存储返回API路径
    return filePath;
  }

  /**
   * 检查是否为WebDAV模式
   */
  isWebDAV(): boolean {
    return this.mode === 'webdav';
  }

  /**
   * 检查是否为本地存储模式
   */
  isLocal(): boolean {
    return this.mode === 'local';
  }
}

export default new StorageService();

