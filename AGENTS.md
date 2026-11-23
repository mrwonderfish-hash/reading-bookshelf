# 阅读词表 GitHub Pages 版本

这是用户明确要求的 GitHub 托管版本，迁移自现有三本书统一书架。保持公开免登录；未来新词表仍加入同一个书架。

- 不操作或打断用户当前阅读页面。默认后台检查；测试使用独立会话和状态。重启或操作用户当前浏览器须取得当次同意。
- `public/library.json` 管理书籍；`public/books/*.json` 是原有词条数据。不要为了部署修改原文、中文、词义或例句。
- 保留稳定的 book ID、词条 key、storageKey、cacheKey、导入导出格式。进度只保存在当前浏览器。
- 新域名不能自动接续旧域 localStorage。未迁移的记录不得声称已迁移；不要添加原来仅信任 Sites origin 的弹窗迁移按钮。
- `scripts/build.mjs` 输出 `dist/`；GitHub Actions 按实际 Pages base_path 构建。新增资产和链接须支持仓库子路径。
- 发布仅包含静态资产与公开词表，不加入 EPUB、凭据、旧 Git 历史、服务器、数据库或个人进度。
- 修改后运行 `node --test tests/*.test.mjs`、构建并在独立环境验证打开、搜索、筛选、翻页和刷新。不要通过清除用户存储来测试。
