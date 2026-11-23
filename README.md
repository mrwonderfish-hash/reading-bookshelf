# 来点sci-fi novel

三本书共 4,307 个词与表达，保留原文例句、中文译文、常见用法和自编双语例句。

这是可独立部署到 GitHub Pages 的静态版本。无需登录、数据库、API key 或付费运行时。

## 阅读与进度

- 书架集中管理《变化的位面》《红的自传》《播种者寓言》。
- 支持搜索、章节/级别/学习状态筛选、逐词/列表阅读及进度导入导出。
- 学习进度保存在当前浏览器；GitHub 托管网页，不同步个人进度。
- 新域名不能自动读取旧网址的浏览器记录。在旧词表“阅读设置”中导出，再到新网址的同一本书导入。不要清除旧站数据后再迁移。

## 构建与发布

使用 Node.js 22 或更高版本，无需安装依赖：

```sh
node --test tests/*.test.mjs
node scripts/build.mjs
```

输出在 `dist/`。本地可用任意静态服务器预览；请勿以 `file://` 方式打开模块网页。

GitHub 仓库启用 Settings → Pages → Source: GitHub Actions。推送到 `main` 后，内置 workflow 测试并发布 `dist/`，自动读取仓库网址的子路径。

自定义部署路径时：

```sh
PAGES_BASE_PATH=/reading-bookshelf node scripts/build.mjs
```

每本书有实体页面 `read/<book-id>/index.html`，支持直接打开与刷新。首页兼容 `?book=<book-id>` 链接。

## 增加下一本书

1. 将词条 JSON 添加到 `public/books/<stable-id>.json`。
2. 在 `public/library.json` 添加配置，`data` 为 `./books/<stable-id>.json`。
3. 保持每本书的 ID、词条 key、storageKey 与 cacheKey 稳定。
4. 运行测试与构建，检查原文、中文、搜索、筛选和进度隔离，再推送。

引文与译文的作者、译者及来源保留在各书词条和“词表说明与来源”中。此仓库不包含完整 EPUB、账户信息或个人学习记录。
