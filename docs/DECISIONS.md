# 决策记录

仅记录规范空白、冲突及实施选择；不得覆盖 DEV_PLAN.md 第 6、7 节。

## D001 — 项目根目录与文档迁移（2026-10-16）

当前工作区直接作为原文 logo-guides 根目录，不嵌套同名子目录。主文档移动到 docs/DEV_PLAN.md，导出版保留在 docs/reference；移动前后核对 hash。主规范正文不修改。

## D002 — M0 能力与后续模块边界（2026-10-16）

M0 只实现基础设施及 F1 原始几何预览。后续编号模块、host/panel 目录建立可追踪的阶段说明；不放置返回假数据的空算法。Generate 仅提示 M0 尚未实现功能，不访问 Illustrator 文档。analyze/preAnalyze 在其所需算法里程碑逐步实现。

## D003 — 本地 Git（2026-10-16）

按用户确认初始化 main，沿用机器上的作者配置。只准备本地提交，不设置远程、不推送。文本固定 LF；依赖、构建、日志、缓存、密钥忽略。

## D004 — 当前环境 npm 入口（2026-10-16）

Node 24 已提供，但 PATH 无 npm；用已有 pnpm 临时执行 npm@10.9.4，不做全局安装或系统配置修改。项目仍使用 npm scripts 与 package-lock.json，不生成 pnpm-lock.yaml。
