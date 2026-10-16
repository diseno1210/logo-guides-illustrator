# Logo 辅助线生成器

面向 Adobe Illustrator 的 Logo / 字标辅助线工具。**M0–M6已验收，v0.1脚本可用**。M7 CEP 面板已完成源码与自动验证，正在进行 Illustrator CEP 实测；M8–M9按计划继续。

## 开发入口

- [开发规范](docs/DEV_PLAN.md)：第 6 节为数据契约，第 7 节为参数唯一来源。
- [开发流程](docs/DEVELOPMENT_WORKFLOW.md)：严格按 M0–M9 顺序开发和验收。
- [当前状态](docs/STATUS.md)、[决策记录](docs/DECISIONS.md)、[变更记录](docs/CHANGELOG.md)。
- [使用说明](docs/USER_GUIDE.md)：仅描述实际可用能力。
- [M6用户验收清单](docs/acceptance/M6.md)：按原文第14.5节完成12项宿主验证。
- [M7实施计划](docs/implementation/M7.md)：面板、桥接与性能门槛。

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
node tools/validate_milestone.js M6
npm run fixture -- tools/samples/illustrator-boatchin.geometry.json
```

`npm run build` 同时生成 `dist/scripts/` 与 `dist/panel/`；将 `dist/panel/` 复制到 `%APPDATA%/Adobe/CEP/extensions/local.logoguides.panel/` 可进行本机 CEP 调试。

当前 Codex 环境没有全局 npm：使用内置 pnpm 的 `pnpm dlx npm@10.9.4 <命令>` 替代 `npm <命令>`，不安装全局工具。详细命令见使用说明。

## 仓库与交付

本地`main`，无远程、无推送、无发布tag。源码、文档、测试和锁文件入库；`node_modules/`、`dist/`、日志和密钥不入库。三项开发依赖固定版本，core/host保持ES3、无运行时依赖。

构建后从Illustrator“文件 › 脚本 › 其他脚本”运行`dist/scripts/LogoGuides_Generate.jsx`。配套有Refresh、Clear、SetBaseUnit、CircleFromSelection和DumpGeometry。详细步骤见使用说明；自动验证与真实宿主证据分别记录在STATUS。

自动测试166项通过，F10预建2000锚点Geometry的Node/V8完整analyze约307ms；真实Illustrator ExtendScript全计算约117秒，作为M7迁移性能基线。原生RGB/CMYK检查18项通过，真实生成窗口、Ctrl+Z及用户拖动/吸附均已验收。M7 F9原生桥接总计758ms；CEP面板实际UI仍待实测。
