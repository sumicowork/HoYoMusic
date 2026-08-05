import { Readable } from 'stream';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getOSSClient, getOSSPublicClient, ossConfig, buildOSSPublicUrl } from '../config/oss';

export class OSSService {
  private get client() {
    return getOSSClient();
  }

  private get basePath() {
    return ossConfig.basePath;
  }

  /**
   * 生成 OSS object key
   * 格式：<basePath>/<category>/<uuid><ext>
   */
  generateObjectKey(
    originalName: string,
    category: 'covers' | 'tracks' | 'lyrics'
  ): string {
    const ext = path.extname(originalName).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    return `${this.basePath}/${category}/${uniqueName}`;
  }

  /**
   * 从公开 URL 中提取 OSS object key
   */
  extractObjectKey(url: string): string {
    if (!url.startsWith('http')) {
      // 已经是 object key
      return url;
    }
    // CDN 域名格式：https://cdn.example.com/<basePath>/...
    if (ossConfig.cdnDomain) {
      const cdnBase = `${ossConfig.secure ? 'https' : 'http'}://${ossConfig.cdnDomain.replace(/\/$/, '')}/`;
      if (url.startsWith(cdnBase)) {
        return url.slice(cdnBase.length);
      }
    }
    // 默认 OSS 域名格式：https://<bucket>.<region>.aliyuncs.com/<key>
    const ossBase = `${ossConfig.secure ? 'https' : 'http'}://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com/`;
    if (url.startsWith(ossBase)) {
      return url.slice(ossBase.length);
    }
    return url;
  }

  /**
   * 上传 Buffer 到 OSS
   * @returns 公开访问 URL
   */
  async uploadBuffer(
    buffer: Buffer,
    objectKey: string,
    contentType?: string
  ): Promise<string> {
    try {
      const options: { mime?: string } = {};
      if (contentType) {
        options.mime = contentType;
      }

      await this.client.put(objectKey, buffer, options);
      const url = buildOSSPublicUrl(objectKey);
      console.log(`[OSS] Uploaded: ${objectKey}`);
      return url;
    } catch (error: any) {
      console.error('[OSS] Upload failed:', error.message);
      throw new Error(`OSS upload failed: ${error.message}`);
    }
  }

  /**
   * 上传 Stream 到 OSS
   * @returns 公开访问 URL
   */
  async uploadStream(
    stream: Readable,
    objectKey: string,
    contentType?: string
  ): Promise<string> {
    try {
      const options: { mime?: string } = {};
      if (contentType) {
        options.mime = contentType;
      }

      await this.client.putStream(objectKey, stream, options as any);
      const url = buildOSSPublicUrl(objectKey);
      console.log(`[OSS] Stream uploaded: ${objectKey}`);
      return url;
    } catch (error: any) {
      console.error('[OSS] Stream upload failed:', error.message);
      throw new Error(`OSS stream upload failed: ${error.message}`);
    }
  }

  /**
   * 删除 OSS 对象
   */
  async deleteFile(objectKeyOrUrl: string): Promise<void> {
    try {
      const objectKey = this.extractObjectKey(objectKeyOrUrl);
      await this.client.delete(objectKey);
      console.log(`[OSS] Deleted: ${objectKey}`);
    } catch (error: any) {
      // 文件不存在时不抛出错误
      if (error.code === 'NoSuchKey' || error.status === 404) {
        console.warn(`[OSS] File not found (already deleted?): ${objectKeyOrUrl}`);
        return;
      }
      console.error('[OSS] Delete failed:', error.message);
      throw new Error(`OSS delete failed: ${error.message}`);
    }
  }

  /**
   * 检查 OSS 对象是否存在
   */
  async fileExists(objectKeyOrUrl: string): Promise<boolean> {
    try {
      const objectKey = this.extractObjectKey(objectKeyOrUrl);
      await this.client.head(objectKey);
      return true;
    } catch (error: any) {
      if (error.code === 'NoSuchKey' || error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * 生成私有文件的临时签名 URL（用于受保护资源）
   * @param objectKeyOrUrl OSS object key 或完整 URL
   * @param expireSeconds  有效期（秒），默认 3600
   */
  async getSignedUrl(objectKeyOrUrl: string, expireSeconds = 3600): Promise<string> {
    const objectKey = this.extractObjectKey(objectKeyOrUrl);
    const url = this.client.signatureUrl(objectKey, { expires: expireSeconds });
    return url;
  }

  /**
   * 生成 PUT 预签名上传 URL（前端直传 OSS，不走服务器中转）
   * @param objectKey OSS object key
   * @param expireSeconds  有效期（秒），默认 3600
   * @param contentType    上传时客户端必须使用完全一致的 Content-Type（参与签名）
   */
  generatePutSignedUrl(objectKey: string, expireSeconds = 3600, contentType = 'audio/flac'): string {
    // 使用公网 endpoint — 前端直传 OSS 无法访问内网地址
    const pub = getOSSPublicClient();
    return pub.signatureUrl(objectKey, {
      expires: expireSeconds,
      method: 'PUT',
      'Content-Type': contentType,
    });
  }

  /**
   * 下载文件到本地临时路径
   * @param objectKey OSS object key
   * @param localPath 本地临时文件路径
   */
  async downloadToFile(objectKey: string, localPath: string): Promise<void> {
    const result = await this.client.get(objectKey, localPath);
    if ((result as any).res?.status >= 400) {
      throw new Error(`OSS download failed: ${(result as any).res?.status}`);
    }
  }

  /**
   * 获取文件公开 URL（对象存储为公读时使用）
   */
  getPublicUrl(objectKeyOrUrl: string): string {
    if (objectKeyOrUrl.startsWith('http')) {
      return objectKeyOrUrl;
    }
    return buildOSSPublicUrl(objectKeyOrUrl);
  }
}

export default new OSSService();





