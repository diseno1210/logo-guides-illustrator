# Logo 辅助线生成器

面向 Adobe Illustrator 的 Logo / 字标辅助线工具。**M0、M1 已验收；M2 自动验证通过，待 Illustrator 参考线绘制实测**。临时 Generate 仅生成参考线，尺寸标注、圆、角度及完整交互在后续里程碑实现。

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
npm run validate:geometry -- <导出的geometry_dump.json路径>
node tools/validate_references.js
npm run fixture -- tools/samples/illustrator-boatchin.geometry.json
```

当前 Codex 环境没有全局 npm：使用内置 pnpm 的 `pnpm dlx npm@10.9.4 <命令>` 替代 `npm <命令>`，不安装全局工具。详细命令见使用说明。

## 仓库与交付

本地 `main` 分支，尚未连接远程仓库。源码、文档、测试和 `package-lock.json` 入库；`node_modules/`、`dist/`、日志和密钥不入库。DumpGeometry 可读取选区并导出 JSON；临时 Generate 绘制参考线、写入文档数据与来源标签，并恢复活动图层。

真实导出证据见 [M1 验收记录](docs/acceptance/M1.md)。当前请按 [M2 验收步骤](docs/acceptance/M2.md) 测试 `dist/scripts/LogoGuides_Generate.jsx`；通过前不进入 M3。
