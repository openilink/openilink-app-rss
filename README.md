# @openilink/app-rss

微信 RSS 订阅推送 -- 自动检查 RSS 源更新并推送新文章通知，零外部依赖。

> **一键安装** -- 前往 [OpeniLink Hub 应用市场](https://hub.openilink.com) 搜索「RSS」，点击安装即可在微信中使用。

## 功能亮点

- **RSS 订阅管理** -- 订阅、查看、取消订阅一站搞定
- **自动定时检查** -- 每 5 分钟检查所有订阅源更新
- **新文章推送** -- 通过 guid 去重，自动推送新条目
- **手动立即检查** -- 支持手动触发检查更新

## 使用方式

安装到 Bot 后，直接用微信对话即可：

**自然语言（推荐）**

- "帮我订阅这个博客 https://example.com/feed"
- "看看我订阅了哪些源"

**命令调用**

- `/subscribe_feed --url https://example.com/feed`

**AI 自动调用** -- Hub AI 在多轮对话中会自动判断是否需要调用 RSS 功能，无需手动触发。

### AI Tools

| 工具名 | 说明 |
|--------|------|
| `subscribe_feed` | 订阅 RSS 源（验证有效性后保存） |
| `list_feeds` | 查看当前用户的订阅列表 |
| `unsubscribe_feed` | 取消订阅指定 RSS 源 |
| `check_feeds` | 立即检查所有订阅的更新 |

<details>
<summary><strong>部署与开发</strong></summary>

### 快速开始

```bash
npm install
npm run dev
```

### Docker 部署

```bash
docker-compose up -d
```

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `HUB_URL` | 是 | -- | OpeniLink Hub 服务地址 |
| `BASE_URL` | 是 | -- | 本服务的公网回调地址 |
| `DB_PATH` | 否 | `data/rss.db` | SQLite 数据库文件路径 |
| `PORT` | 否 | `8097` | HTTP 服务端口 |

### API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/hub/webhook` | 接收 Hub 推送的事件 |
| `GET` | `/oauth/setup` | 启动 OAuth 安装流程 |
| `GET` | `/oauth/redirect` | OAuth 回调处理 |
| `POST` | `/oauth/redirect` | 模式 2 直接安装 |
| `GET` | `/manifest.json` | 返回应用清单 |
| `GET` | `/health` | 健康检查 |

</details>

## 安全与隐私

本 App 需要存储 RSS 订阅 URL 和文章标题。所有数据：

- **严格按用户隔离** -- 每条记录绑定 `installation_id` + `user_id`，不同用户之间完全隔离
- **无法跨用户访问** -- 所有查询、删除操作均在 SQL 层面强制过滤用户归属
- **数据存储在 SQLite** -- 数据文件位于 `data/` 目录，不上传到任何云端
- **代码完全开源** -- 接受社区审查

如果您对数据隐私有更高要求，建议自行部署：`docker compose up -d`，所有数据仅存储在您自己的服务器上。

## License

MIT
