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

## License

MIT
