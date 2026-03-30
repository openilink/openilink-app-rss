# @openilink/app-rss

RSS 订阅推送工具，自动检查 RSS 源更新并推送新文章通知。

## 特色

- **RSS 订阅管理** — 订阅、查看、取消订阅
- **自动定时检查** — 每 5 分钟检查所有订阅源
- **新文章推送** — 通过 guid 去重，自动推送新条目
- **手动立即检查** — 支持手动触发检查更新

## 快速开始

```bash
npm install
npm run dev
```

### Docker 部署

```bash
docker-compose up -d
```

## 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `HUB_URL` | 是 | — | OpeniLink Hub 服务地址 |
| `BASE_URL` | 是 | — | 本服务的公网回调地址 |
| `DB_PATH` | 否 | `data/rss.db` | SQLite 数据库文件路径 |
| `PORT` | 否 | `8097` | HTTP 服务端口 |

## 4 个 AI Tools

| 工具名 | 说明 |
|--------|------|
| `subscribe_feed` | 订阅 RSS 源（验证有效性后保存） |
| `list_feeds` | 查看当前用户的订阅列表 |
| `unsubscribe_feed` | 取消订阅指定 RSS 源 |
| `check_feeds` | 立即检查所有订阅的更新 |

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/hub/webhook` | 接收 Hub 推送的事件 |
| `GET` | `/oauth/setup` | 启动 OAuth 安装流程 |
| `GET` | `/oauth/redirect` | OAuth 回调处理 |
| `POST` | `/oauth/redirect` | 模式 2 直接安装 |
| `GET` | `/manifest.json` | 返回应用清单 |
| `GET` | `/health` | 健康检查 |

## 安全与隐私

### 数据存储说明

本 App 需要存储用户数据以实现功能（RSS 订阅 URL 和文章标题）。所有数据：

- **严格按用户隔离**：每条记录绑定 `installation_id` + `user_id`，不同用户之间完全隔离
- **无法跨用户访问**：所有查询、删除操作均在 SQL 层面强制过滤用户归属
- **数据存储在 SQLite**：数据文件位于 `data/` 目录，不上传到任何云端

### 应用市场安装（托管模式）

通过应用市场安装时，您的数据存储在我们的服务器上。我们承诺：

- 不会查看、分析或使用您的个人数据
- 所有 App 代码完全开源，接受社区审查
- 我们会对每个 App 进行严格的安全审查

### 自部署（推荐注重隐私的用户）

如果您对数据隐私有更高要求，**强烈建议自行部署**：

```bash
docker compose up -d
```

自部署后所有数据（订阅 URL、文章标题和链接）仅存储在您自己的服务器上。

## License

MIT
