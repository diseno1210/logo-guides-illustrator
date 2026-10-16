# 变更记录

## 未发布 — M1（自动验证通过，待 Illustrator 实测，2026-10-16）

- 添加 namespaced public-domain JSON2、ES3 工具函数、完整规范配置、向量与贝塞尔解析计算。
- 添加精确包围盒、S 相对直线判定、行聚类、小部件归属、弧长采样预算控制和 even-odd 墨迹测试。
- 补齐 F1–F10（含 F9b）几何夹具；添加解析几何和配置规范对照测试。
- 添加选区读取、复合路径去重、临时文字轮廓及异常清理、UTF-8 dump 和日志；构建 DumpGeometry.jsx。
- 添加 Node `validate:geometry` 入口和真实 Illustrator 验收清单；不进入 M2，不宣称宿主实测通过。

## 0.0.0-dev — M0（已验收，2026-10-16）

- 建立规范归档、开发流程、状态、决策与使用说明。
- 初始化本地 Git main；尚未连接远程。
- 完成按序拼接、IIFE、#target 和 Unicode 转义构建；ES3 AST 检查及禁用 API 规则已验证。
- 完成移除禁用 API 的 vm 测试框架、F1 四段贝塞尔夹具、SVG 导入与几何预览。
- 固定三项开发依赖与 npm 锁文件；全新 npm ci 后 48 项测试、构建、ES3 检查全部通过。
- JSON / SVG 两条预览路径输出 hash 一致；Chrome 无头截图已人工视觉核对。
- 此版本尚不具备 Illustrator 辅助线功能；M1–M9 未开始，未执行 Illustrator 实测。
