# WebDAV多服务器负载均衡开发方案

> **目标**: 解决单WebDAV服务器并发限制问题，提升系统并发处理能力从20提升至60+

**创建日期**: 2026-02-18  
**优先级**: 🔴 高  
**预计工时**: 16-20小时  
**状态**: 📋 待开始

---

## 📊 问题背景

### 当前瓶颈
- ❌ 单服务器并发限制: 20-30
- ❌ 50+用户同时播放导致超时
- ❌ 批量上传性能差
- ❌ 大量图片加载缓慢

### 目标改进
- ✅ 并发能力提升至 60-90
- ✅ 支持100+用户同时在线
- ✅ 批量操作性能提升 3倍
- ✅ 故障自动切换

---

## 🎯 技术方案: 哈希分片 + 并发限流

### 核心策略
1. **一致性哈希**: 根据文件名哈希分配到固定服务器
2. **并发限流**: 每个服务器独立的并发控制
3. **智能降级**: 服务器过载时自动切换
4. **统一接口**: 对上层业务透明

### 架构图
```
┌─────────────┐
│   上传请求   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ WebDAVShardService  │ ← 哈希分片 + 并发控制
└──────┬──────────────┘
       │
       ├──────────┬──────────┬──────────┐
       ▼          ▼          ▼          ▼
   Server1    Server2    Server3    Server4
   (20并发)   (20并发)   (20并发)   (20并发)
   坚果云1     坚果云2     坚果云3    自建服务器
```

---

## 📋 开发任务清单

### Phase 1: 配置层 (2小时)

#### ✅ TODO 1.1: 创建多服务器配置文件
**文件**: `backend/src/config/webdav.config.ts`

**任务**:
- [ ] 定义 `WebDAVServerConfig` 接口
  - id: 服务器唯一标识
  - url: WebDAV服务器地址
  - username/password: 认证信息
  - maxConcurrent: 最大并发数
  - priority: 优先级
  - enabled: 是否启用
  - description: 描述信息

- [ ] 创建服务器配置数组 `WEBDAV_SERVERS`
  - 支持从环境变量读取
  - 支持动态启用/禁用服务器
  - 添加配置验证

**代码框架**:
```typescript
export interface WebDAVServerConfig {
  id: string;
  url: string;
  username: string;
  password: string;
  maxConcurrent: number;
  priority: number;
  enabled: boolean;
  description?: string;
}

export const WEBDAV_SERVERS: WebDAVServerConfig[] = [
  // 从环境变量加载配置
];

export function validateWebDAVConfig(): boolean {
  // 配置验证逻辑
}
```

---

#### ✅ TODO 1.2: 更新环境变量配置
**文件**: `backend/.env.example`

**任务**:
- [ ] 添加多服务器配置示例
- [ ] 添加每个服务器的详细注释
- [ ] 提供不同场景的配置模板

**配置示例**:
```env
# WebDAV服务器1 - 坚果云账号1 (主)
WEBDAV_URL_1=https://dav.jianguoyun.com/dav/
WEBDAV_USERNAME_1=user1@example.com
WEBDAV_PASSWORD_1=app_password_1
WEBDAV_MAX_CONCURRENT_1=20
WEBDAV_ENABLED_1=true

# WebDAV服务器2 - 坚果云账号2 (备)
WEBDAV_URL_2=https://dav.jianguoyun.com/dav/
WEBDAV_USERNAME_2=user2@example.com
WEBDAV_PASSWORD_2=app_password_2
WEBDAV_MAX_CONCURRENT_2=20
WEBDAV_ENABLED_2=true

# WebDAV服务器3 - 坚果云账号3 (备)
WEBDAV_URL_3=https://dav.jianguoyun.com/dav/
WEBDAV_USERNAME_3=user3@example.com
WEBDAV_PASSWORD_3=app_password_3
WEBDAV_MAX_CONCURRENT_3=20
WEBDAV_ENABLED_3=true

# 负载均衡策略
WEBDAV_STRATEGY=hash  # hash | round-robin | least-busy
WEBDAV_HEALTH_CHECK_INTERVAL=60000  # 健康检查间隔(ms)
```

---

### Phase 2: 核心服务层 (8小时)

#### ✅ TODO 2.1: 实现哈希分片服务
**文件**: `backend/src/services/webdav-shard.service.ts`

**任务**:
- [ ] 实现 `WebDAVShardService` 类
- [ ] 实现一致性哈希算法 `getServerByHash()`
- [ ] 实现并发计数管理
- [ ] 实现智能服务器选择 `selectLeastBusyServer()`
- [ ] 添加并发限流机制
- [ ] 实现故障切换逻辑

**核心方法**:
```typescript
class WebDAVShardService {
  // 初始化所有客户端
  private initClients(): void
  
  // 根据文件名哈希选择服务器
  private getServerByHash(filename: string): ServerInfo
  
  // 选择最空闲的服务器
  private selectLeastBusyServer(): ServerInfo
  
  // 上传文件（自动分片）
  async uploadFile(localPath: string, remotePath: string): Promise<string>
  
  // 读取文件（从正确的服务器）
  async getFile(remotePath: string): Promise<Buffer>
  
  // 删除文件
  async deleteFile(remotePath: string): Promise<void>
  
  // 获取服务器状态
  getServerStatus(): ServerStatus[]
}
```

---

#### ✅ TODO 2.2: 实现并发队列管理
**文件**: `backend/src/services/webdav-queue.service.ts`

**任务**:
- [ ] 安装 `p-queue` 依赖: `npm install p-queue`
- [ ] 为每个服务器创建独立队列
- [ ] 实现队列优先级管理
- [ ] 添加队列监控和统计

**代码框架**:
```typescript
import PQueue from 'p-queue';

class WebDAVQueueService {
  private queues: Map<string, PQueue> = new Map();
  
  constructor() {
    // 为每个服务器创建队列
  }
  
  async addTask<T>(serverId: string, task: () => Promise<T>): Promise<T> {
    const queue = this.queues.get(serverId);
    return queue.add(task);
  }
  
  getQueueStatus(serverId: string) {
    const queue = this.queues.get(serverId);
    return {
      pending: queue.pending,
      size: queue.size,
    };
  }
}
```

---

#### ✅ TODO 2.3: 实现健康检查服务
**文件**: `backend/src/services/webdav-health.service.ts`

**任务**:
- [ ] 定时检查每个服务器可用性
- [ ] 测量服务器响应延迟
- [ ] 自动禁用故障服务器
- [ ] 自动恢复已修复的服务器
- [ ] 记录健康检查日志

**代码框架**:
```typescript
class WebDAVHealthService {
  private healthStatus: Map<string, HealthInfo> = new Map();
  
  async checkHealth(serverId: string): Promise<HealthInfo> {
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
  
  startHealthCheck(): void {
    // 定时检查所有服务器
  }
}
```

---

### Phase 3: 业务集成层 (4小时)

#### ✅ TODO 3.1: 重构 trackController
**文件**: `backend/src/controllers/trackController.ts`

**任务**:
- [ ] 替换原有 `webdavService` 为 `webdavShardService`
- [ ] 更新音频上传逻辑
- [ ] 更新音频流式传输
- [ ] 处理服务器URL映射

**修改点**:
```typescript
// 上传音频
const audioUrl = await this.webdavShardService.uploadFile(
  file.path,
  `/music/audio/${filename}`
);

// 流式传输
const audioBuffer = await this.webdavShardService.getFile(audioPath);
```

---

#### ✅ TODO 3.2: 重构 albumController
**文件**: `backend/src/controllers/albumController.ts`

**任务**:
- [ ] 更新封面上传逻辑
- [ ] 更新封面删除逻辑
- [ ] 支持批量操作

---

#### ✅ TODO 3.3: 重构 gameController
**文件**: `backend/src/controllers/gameController.ts`

**任务**:
- [ ] 更新游戏封面上传
- [ ] 更新背景图片上传

---

### Phase 4: 监控和管理 (3小时)

#### ✅ TODO 4.1: 创建监控接口
**文件**: `backend/src/controllers/admin/webdavController.ts`

**任务**:
- [ ] 创建 `/api/admin/webdav/status` 接口
  - 返回所有服务器状态
  - 当前并发数
  - 存储使用情况
  - 健康状态

- [ ] 创建 `/api/admin/webdav/servers/:id/toggle` 接口
  - 动态启用/禁用服务器

- [ ] 创建 `/api/admin/webdav/stats` 接口
  - 统计数据（上传/下载次数、流量等）

**接口示例**:
```typescript
@Get('/api/admin/webdav/status')
async getWebDAVStatus() {
  return {
    servers: [
      {
        id: 'server1',
        url: 'https://dav.jianguoyun.com/dav/',
        enabled: true,
        healthy: true,
        concurrent: 12,
        maxConcurrent: 20,
        usage: '60%',
        latency: 45,
        storage: {
          used: '2.5 GB',
          total: '5 GB',
          percentage: 50
        }
      }
    ],
    totalConcurrent: 25,
    totalMaxConcurrent: 60
  };
}
```

---

#### ✅ TODO 4.2: 创建前端监控面板
**文件**: `frontend/src/pages/Admin/WebDAVMonitor.tsx`

**任务**:
- [ ] 创建服务器状态卡片组件
- [ ] 显示实时并发数
- [ ] 显示健康状态
- [ ] 支持启用/禁用服务器
- [ ] 显示统计图表（使用 recharts）

**UI设计**:
```
┌─────────────────────────────────────────┐
│  WebDAV服务器监控                        │
├─────────────────────────────────────────┤
│  总并发: 25/60 (41%)  ████████░░░       │
├─────────────────────────────────────────┤
│  服务器1 [✅健康] [启用]                 │
│  坚果云1 (user1@example.com)            │
│  并发: 12/20  延迟: 45ms                │
│  存储: 2.5GB/5GB (50%)  ██████░░░       │
├─────────────────────────────────────────┤
│  服务器2 [✅健康] [启用]                 │
│  坚果云2 (user2@example.com)            │
│  并发: 8/20   延迟: 52ms                │
│  存储: 1.8GB/5GB (36%)  ████░░░░        │
├─────────────────────────────────────────┤
│  服务器3 [⚠️降级] [启用]                │
│  坚果云3 (user3@example.com)            │
│  并发: 5/20   延迟: 180ms               │
│  存储: 3.2GB/5GB (64%)  ███████░        │
└─────────────────────────────────────────┘
```

---

### Phase 5: 数据库适配 (2小时)

#### ✅ TODO 5.1: 更新数据库Schema
**文件**: `backend/schema.sql` 或迁移文件

**任务**:
- [ ] 为 `tracks` 表添加 `webdav_server_id` 字段
- [ ] 为 `albums` 表添加 `webdav_server_id` 字段
- [ ] 创建索引优化查询

**SQL**:
```sql
-- 添加服务器标识字段
ALTER TABLE tracks ADD COLUMN webdav_server_id VARCHAR(50);
ALTER TABLE albums ADD COLUMN webdav_server_id VARCHAR(50);

-- 创建索引
CREATE INDEX idx_tracks_webdav_server ON tracks(webdav_server_id);
CREATE INDEX idx_albums_webdav_server ON albums(webdav_server_id);
```

---

#### ✅ TODO 5.2: 创建数据迁移脚本
**文件**: `backend/scripts/migrate-to-sharded-webdav.ts`

**任务**:
- [ ] 读取所有现有文件记录
- [ ] 为每个文件分配服务器ID（使用哈希）
- [ ] 更新数据库记录
- [ ] 生成迁移报告

---

### Phase 6: 测试和优化 (3小时)

#### ✅ TODO 6.1: 单元测试
**文件**: `backend/src/services/__tests__/webdav-shard.service.test.ts`

**测试用例**:
- [ ] 测试哈希分片算法一致性
- [ ] 测试并发限流机制
- [ ] 测试故障切换逻辑
- [ ] 测试队列管理
- [ ] 测试健康检查

---

#### ✅ TODO 6.2: 性能测试
**文件**: `backend/scripts/test-webdav-performance.ts`

**测试场景**:
- [ ] 模拟50并发上传
- [ ] 模拟100并发下载
- [ ] 测试批量操作性能
- [ ] 压力测试（找到极限）

**期望结果**:
- 50并发上传: 成功率 > 95%
- 100并发下载: 平均响应时间 < 500ms
- 批量上传100首歌: 时间 < 20分钟

---

#### ✅ TODO 6.3: 集成测试
**任务**:
- [ ] 测试完整上传流程
- [ ] 测试音乐播放流程
- [ ] 测试文件删除流程
- [ ] 测试服务器故障恢复

---

### Phase 7: 文档和部署 (2小时)

#### ✅ TODO 7.1: 更新文档
**文件**: `WEBDAV_LOAD_BALANCING_GUIDE.md`

**内容**:
- [ ] 多服务器配置指南
- [ ] 性能调优建议
- [ ] 监控面板使用说明
- [ ] 故障排查指南
- [ ] 最佳实践

---

#### ✅ TODO 7.2: 更新现有文档
**文件**: 
- `WEBDAV_QUICK_START.md`
- `WEBDAV_SETUP_GUIDE.md`
- `WEBDAV_DOCS_INDEX.md`

**任务**:
- [ ] 添加多服务器配置章节
- [ ] 更新配置示例
- [ ] 添加性能对比数据

---

#### ✅ TODO 7.3: 创建部署检查清单
**文件**: `WEBDAV_LOAD_BALANCING_DEPLOYMENT.md`

**内容**:
```markdown
## 部署前检查
- [ ] 已配置2个以上WebDAV服务器
- [ ] 所有服务器连接测试通过
- [ ] 已备份现有数据
- [ ] 已运行数据迁移脚本

## 部署步骤
1. 停止服务
2. 更新代码
3. 运行迁移脚本
4. 更新配置文件
5. 启动服务
6. 验证功能

## 部署后验证
- [ ] 监控面板显示正常
- [ ] 上传文件成功
- [ ] 播放音乐正常
- [ ] 并发测试通过
```

---

## 🔧 技术细节

### 哈希算法选择
```typescript
// 使用MD5哈希 + 取模
function getServerIndex(filename: string, serverCount: number): number {
  const hash = crypto.createHash('md5').update(filename).digest('hex');
  return parseInt(hash.substring(0, 8), 16) % serverCount;
}
```

**优势**:
- 同一文件总是分配到同一服务器
- 分布均匀
- 简单高效

---

### 并发控制策略
```typescript
// 使用 p-queue 限制每个服务器的并发
const queue = new PQueue({
  concurrency: 20,  // 最大并发
  interval: 1000,   // 时间窗口
  intervalCap: 20   // 时间窗口内最大请求数
});
```

---

### 故障切换逻辑
```
1. 选择主服务器（通过哈希）
2. 检查主服务器并发是否超限
3. 如果超限，选择最空闲的备用服务器
4. 如果所有服务器都超限，等待队列
5. 如果主服务器故障，自动切换备用
```

---

## 📈 性能预期

### 单服务器 vs 三服务器对比

| 指标 | 单服务器 | 三服务器 | 提升 |
|------|---------|---------|------|
| 最大并发 | 20 | 60 | +200% |
| 50用户播放 | ❌超时 | ✅流畅 | ∞ |
| 批量上传100首 | 50分钟 | 18分钟 | +177% |
| 封面加载(100张) | 25秒 | 9秒 | +177% |
| 可用性 | 99% | 99.9% | +0.9% |

---

## 🚨 风险和注意事项

### 技术风险
- ⚠️ 需要确保哈希算法的一致性
- ⚠️ 数据迁移可能耗时较长
- ⚠️ 需要额外的监控和维护成本

### 业务风险
- ⚠️ 短期内需要多个WebDAV账号（成本）
- ⚠️ 配置复杂度增加
- ⚠️ 需要定期检查各服务器存储使用情况

### 缓解措施
- ✅ 充分测试后再上线
- ✅ 保留原有单服务器模式作为备选
- ✅ 提供详细的文档和监控工具
- ✅ 实现平滑降级机制

---

## 📦 依赖包

### 新增依赖
```json
{
  "dependencies": {
    "p-queue": "^7.4.1"  // 并发队列管理
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

### 安装命令
```bash
cd backend
npm install p-queue
```

---

## 🎯 成功标准

### 功能完整性
- ✅ 支持3个以上WebDAV服务器
- ✅ 自动哈希分片
- ✅ 并发限流正常工作
- ✅ 故障自动切换
- ✅ 监控面板可用

### 性能指标
- ✅ 并发能力达到60+
- ✅ 50并发上传成功率 > 95%
- ✅ 平均响应时间 < 500ms
- ✅ 批量操作性能提升 > 150%

### 稳定性
- ✅ 单服务器故障不影响整体服务
- ✅ 7x24小时稳定运行
- ✅ 无内存泄漏

---

## 📅 时间规划

### Week 1 (Day 1-3)
- Phase 1: 配置层 ✅
- Phase 2: 核心服务层 (部分)

### Week 2 (Day 4-5)
- Phase 2: 核心服务层 (完成)
- Phase 3: 业务集成层

### Week 3 (Day 6-7)
- Phase 4: 监控和管理
- Phase 5: 数据库适配

### Week 4 (Day 8-10)
- Phase 6: 测试和优化
- Phase 7: 文档和部署
- 上线部署

---

## 🔗 相关文档

- [WebDAV文档索引](./WEBDAV_DOCS_INDEX.md)
- [WebDAV快速开始](./WEBDAV_QUICK_START.md)
- [坚果云配置指南](./JIANGUOYUN_WEBDAV_GUIDE.md)
- [WebDAV实施总结](./WEBDAV_IMPLEMENTATION_SUMMARY.md)

---

## 📝 开发日志

### 2026-02-18
- ✅ 创建开发方案文档
- 📋 TODO: 开始 Phase 1 实施

---

## 🎉 预期收益

### 技术收益
- 🚀 并发能力提升3倍
- 🔧 系统可扩展性增强
- 📊 监控和可观测性提升
- 🛡️ 故障容错能力增强

### 业务收益
- 👥 支持更多用户同时在线
- ⚡ 用户体验大幅提升
- 💰 使用免费WebDAV服务降低成本
- 📈 为未来扩展打下基础

---

**下一步行动**: 开始 Phase 1 - 配置层开发

**负责人**: 待分配  
**审核人**: 待分配  
**状态**: 📋 等待开始

---

**文档版本**: 1.0  
**最后更新**: 2026-02-18  
**维护者**: HoYoMusic Team

