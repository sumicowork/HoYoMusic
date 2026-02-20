# WebDAV负载均衡 - 快速参考

> 开发时的速查表，包含关键代码片段和配置示例

---

## 🚀 快速配置

### 环境变量 (.env)
```env
# 服务器1 - 坚果云账号1
WEBDAV_URL_1=https://dav.jianguoyun.com/dav/
WEBDAV_USERNAME_1=user1@example.com
WEBDAV_PASSWORD_1=app_password_1
WEBDAV_MAX_CONCURRENT_1=20
WEBDAV_ENABLED_1=true

# 服务器2 - 坚果云账号2
WEBDAV_URL_2=https://dav.jianguoyun.com/dav/
WEBDAV_USERNAME_2=user2@example.com
WEBDAV_PASSWORD_2=app_password_2
WEBDAV_MAX_CONCURRENT_2=20
WEBDAV_ENABLED_2=true

# 服务器3 - 坚果云账号3
WEBDAV_URL_3=https://dav.jianguoyun.com/dav/
WEBDAV_USERNAME_3=user3@example.com
WEBDAV_PASSWORD_3=app_password_3
WEBDAV_MAX_CONCURRENT_3=20
WEBDAV_ENABLED_3=true
```

---

## 📦 核心代码片段

### 1. 哈希分片算法
```typescript
import * as crypto from 'crypto';

function getServerByHash(filename: string, serverCount: number): number {
  const hash = crypto.createHash('md5').update(filename).digest('hex');
  return parseInt(hash.substring(0, 8), 16) % serverCount;
}

// 使用示例
const serverId = getServerByHash('song.flac', 3); // 返回 0, 1, 或 2
```

---

### 2. 并发队列管理
```typescript
import PQueue from 'p-queue';

class WebDAVQueueService {
  private queues: Map<string, PQueue> = new Map();
  
  constructor(servers: WebDAVServerConfig[]) {
    servers.forEach(config => {
      this.queues.set(config.id, new PQueue({
        concurrency: config.maxConcurrent,
        interval: 1000,
        intervalCap: config.maxConcurrent
      }));
    });
  }
  
  async addTask<T>(serverId: string, task: () => Promise<T>): Promise<T> {
    const queue = this.queues.get(serverId);
    return queue.add(task);
  }
}
```

---

### 3. 上传文件（自动分片）
```typescript
async uploadFile(localPath: string, remotePath: string): Promise<string> {
  // 1. 选择服务器
  const { id, client, config } = this.getServerByHash(remotePath);
  
  // 2. 检查并发
  const queue = this.queues.get(id);
  
  // 3. 上传文件
  return queue.add(async () => {
    const fileBuffer = await fs.promises.readFile(localPath);
    await client.putFileContents(remotePath, fileBuffer);
    return `${config.url}${remotePath}`;
  });
}
```

---

### 4. 读取文件（从正确的服务器）
```typescript
async getFile(remotePath: string): Promise<Buffer> {
  const { client, id } = this.getServerByHash(remotePath);
  const queue = this.queues.get(id);
  
  return queue.add(async () => {
    return await client.getFileContents(remotePath) as Buffer;
  });
}
```

---

### 5. 健康检查
```typescript
async checkHealth(serverId: string): Promise<HealthInfo> {
  const client = this.clients.get(serverId);
  const start = Date.now();
  
  try {
    await client.exists('/');
    return {
      healthy: true,
      latency: Date.now() - start,
      lastCheck: new Date()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      lastCheck: new Date()
    };
  }
}
```

---

### 6. 监控API
```typescript
@Get('/api/admin/webdav/status')
async getWebDAVStatus() {
  const servers = await Promise.all(
    WEBDAV_SERVERS.map(async (config) => {
      const health = await this.healthService.checkHealth(config.id);
      const queue = this.queueService.getQueue(config.id);
      
      return {
        id: config.id,
        url: config.url,
        enabled: config.enabled,
        healthy: health.healthy,
        latency: health.latency,
        concurrent: queue.pending,
        maxConcurrent: config.maxConcurrent,
        usage: `${Math.round(queue.pending / config.maxConcurrent * 100)}%`
      };
    })
  );
  
  return { servers };
}
```

---

## 🎯 关键接口定义

### WebDAVServerConfig
```typescript
interface WebDAVServerConfig {
  id: string;                    // 服务器唯一ID
  url: string;                   // WebDAV服务器URL
  username: string;              // 用户名
  password: string;              // 密码/应用密码
  maxConcurrent: number;         // 最大并发数
  priority: number;              // 优先级
  enabled: boolean;              // 是否启用
  description?: string;          // 描述
}
```

### HealthInfo
```typescript
interface HealthInfo {
  healthy: boolean;              // 是否健康
  latency?: number;              // 延迟(ms)
  error?: string;                // 错误信息
  lastCheck: Date;               // 最后检查时间
}
```

### ServerInfo
```typescript
interface ServerInfo {
  id: string;                    // 服务器ID
  client: WebDAVClient;          // WebDAV客户端
  config: WebDAVServerConfig;    // 配置信息
}
```

---

## 📊 数据库Schema

### tracks表修改
```sql
ALTER TABLE tracks ADD COLUMN webdav_server_id VARCHAR(50);
CREATE INDEX idx_tracks_webdav_server ON tracks(webdav_server_id);
```

### albums表修改
```sql
ALTER TABLE albums ADD COLUMN webdav_server_id VARCHAR(50);
CREATE INDEX idx_albums_webdav_server ON albums(webdav_server_id);
```

---

## 🧪 测试命令

### 性能测试
```bash
cd backend
npm run test:performance
```

### 单元测试
```bash
npm run test -- webdav-shard.service
```

### 健康检查测试
```bash
curl http://localhost:3000/api/admin/webdav/status
```

---

## 📈 监控指标

### 关键指标
- **总并发数**: 所有服务器当前并发之和
- **服务器健康状态**: 是否可达、延迟
- **队列长度**: 等待处理的任务数
- **成功率**: 上传/下载成功的百分比

### 告警阈值
- 延迟 > 500ms: ⚠️ 警告
- 延迟 > 1000ms: 🔴 严重
- 并发使用率 > 80%: ⚠️ 警告
- 并发使用率 > 95%: 🔴 严重
- 健康检查失败: 🔴 严重

---

## 🔧 故障排查

### 问题1: 文件上传失败
```bash
# 1. 检查服务器状态
curl http://localhost:3000/api/admin/webdav/status

# 2. 查看后端日志
npm run dev

# 3. 测试WebDAV连接
curl -u username:password https://dav.jianguoyun.com/dav/
```

### 问题2: 并发过高导致超时
```typescript
// 临时降低并发限制
WEBDAV_MAX_CONCURRENT_1=10  // 从20降至10
```

### 问题3: 某个服务器故障
```typescript
// 禁用故障服务器
WEBDAV_ENABLED_2=false
```

---

## 💡 最佳实践

### ✅ DO
- 使用3个服务器实现2+1配置（2主1备）
- 定期监控存储使用情况
- 设置健康检查间隔为60秒
- 为不同类型文件设置不同并发限制

### ❌ DON'T
- 不要在多个服务器存储同一文件
- 不要设置过高的并发限制（超过30）
- 不要频繁启用/禁用服务器
- 不要忽略健康检查告警

---

## 📚 相关文档

- 详细开发方案: [WEBDAV_LOAD_BALANCING_TODO.md](./WEBDAV_LOAD_BALANCING_TODO.md)
- 文档索引: [WEBDAV_DOCS_INDEX.md](./WEBDAV_DOCS_INDEX.md)

---

**版本**: 1.0  
**更新**: 2026-02-18

