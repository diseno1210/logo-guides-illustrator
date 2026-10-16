# Logo 辅助线生成器

面向 Adobe Illustrator 的 Logo / 字标辅助线工具。当前正在实施 **M0 骨架与工具链**，尚不能生成 Illustrator 辅助线。

## 开发入口

- [开发规范](docs/DEV_PLAN.md)：第 6 节为数据契约，第 7 节为参数唯一来源。
- [开发流程](docs/DEVELOPMENT_WORKFLOW.md)：严格按 M0–M9 顺序开发和验收。
- [当前状态](docs/STATUS.md)、[决策记录](docs/DECISIONS.md)、[变更记录](docs/CHANGELOG.md)。
- [使用说明](docs/USER_GUIDE.md)：仅描述实际可用能力。

## 环境与命令

需要 Node.js 20+、npm 10 和 Git。只有三个固定版本开发依赖；core / host 无运行时依赖。

```powershell
npm ci
npm test
npm run build
npm run check:es3
npm run fixture -- F1
npm run preview -- dist/previews/F1.geometry.json
```

当前 Codex 环境没有全局 npm：使用内置 pnpm 的 `pnpm dlx npm@10.9.4 <命令>` 替代 `npm <命令>`，不安装全局工具。详细命令见使用说明。

## 仓库与交付

本地 `main` 分支，尚未连接远程仓库。源码、文档、测试和 `package-lock.json` 入库；`node_modules/`、`dist/`、日志和密钥不入库。构建入口为 M0 提示脚本，不读取或绘制文档。

本次仅交付 M0，验收后停在 M0，不自动进入 M1。
