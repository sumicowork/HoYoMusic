import { getWebDAVClient, webdavConfig } from '../config/webdav';
import { Readable } from 'stream';
import path from 'path';

export class WebDAVService {
  private client = getWebDAVClient();
  private basePath = webdavConfig.basePath;
  private publicUrl = webdavConfig.publicUrl;

  /**
   * 上传文件到WebDAV
   * @param fileBuffer 文件Buffer
   * @param remotePath 远程路径（相对于basePath）
   * @param contentType 内容类型
   * @returns 公开访问URL
   */
  async uploadFile(
    fileBuffer: Buffer,
    remotePath: string,
    contentType?: string
  ): Promise<string> {
    try {
      const fullPath = `${this.basePath}/${remotePath}`;

      // 确保目录存在
      const directory = path.dirname(fullPath);
      await this.ensureDirectory(directory);

      // 上传文件
      await this.client.putFileContents(fullPath, fileBuffer, {
        overwrite: true,
        contentLength: fileBuffer.length,
        ...(contentType && { contentType }),
      });

      // 返回公开访问URL
      return `${this.publicUrl}/${remotePath}`;
    } catch (error: any) {
      console.error('Error uploading file to WebDAV:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * 上传Stream到WebDAV
   * @param stream 可读流
   * @param remotePath 远程路径
   * @param contentType 内容类型
   * @returns 公开访问URL
   */
  async uploadStream(
    stream: Readable,
    remotePath: string,
    contentType?: string
  ): Promise<string> {
    try {
      const fullPath = `${this.basePath}/${remotePath}`;

      // 确保目录存在
      const directory = path.dirname(fullPath);
      await this.ensureDirectory(directory);

      // 上传��
      await this.client.putFileContents(fullPath, stream, {
        overwrite: true,
        ...(contentType && { contentType }),
      });

      // 返回公开访问URL
      return `${this.publicUrl}/${remotePath}`;
    } catch (error: any) {
      console.error('Error uploading stream to WebDAV:', error);
      throw new Error(`Failed to upload stream: ${error.message}`);
    }
  }

  /**
   * 删除文件
   * @param remotePath 远程路径
   */
  async deleteFile(remotePath: string): Promise<void> {
    try {
      const fullPath = `${this.basePath}/${remotePath}`;
      const exists = await this.client.exists(fullPath);

      if (exists) {
        await this.client.deleteFile(fullPath);
        console.log(`Deleted file from WebDAV: ${fullPath}`);
      }
    } catch (error: any) {
      console.error('Error deleting file from WebDAV:', error);
      // 不抛出错误，因为文件可能已经不存在
    }
  }

  /**
   * 检查文件是否存在
   * @param remotePath 远程路径
   */
  async fileExists(remotePath: string): Promise<boolean> {
    try {
      const fullPath = `${this.basePath}/${remotePath}`;
      return await this.client.exists(fullPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * 确保目录存在
   * @param directory 目录路径
   */
  private async ensureDirectory(directory: string): Promise<void> {
    try {
      const exists = await this.client.exists(directory);
      if (!exists) {
        // 递归创建父目录
        const parent = path.dirname(directory);
        if (parent !== directory && parent !== '/' && parent !== this.basePath) {
          await this.ensureDirectory(parent);
        }
        await this.client.createDirectory(directory);
      }
    } catch (error: any) {
      // 忽略目录已存在的错误
      if (!error.message?.includes('exists')) {
        throw error;
      }
    }
  }

  /**
   * 从URL提取相对路径
   * @param url 完整URL或相对路径
   * @returns 相对路径
   */
  extractRelativePath(url: string): string {
    if (url.startsWith('http')) {
      // 从完整URL中提取相对路径
      const publicUrlBase = this.publicUrl.replace(/\/$/, '');
      return url.replace(publicUrlBase + '/', '');
    }
    return url;
  }

  /**
   * 生成唯一文件名
   * @param originalName 原始文件名
   * @param category 分类（covers/tracks/lyrics）
   * @returns 远程路径
   */
  generateRemotePath(originalName: string, category: 'covers' | 'tracks' | 'lyrics'): string {
    const timestamp = Date.now();
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${sanitizedName}_${timestamp}${ext}`;
    return `${category}/${fileName}`;
  }
}

export default new WebDAVService();

