# 开发状态

更新日期：2026-10-16。首次交付仅 M0。状态：未开始 / 进行中 / 自动验证通过 / 待 Illustrator 实测 / 已验收。

| 里程碑 | 状态 | 验证与提交 |
| --- | --- | --- |
| M0 | 已验收 | 48/48 测试通过；构建/ES3 通过；F1 JSON/SVG 预览一致；Chrome 截图已核对 |
| M1 | 未开始 | M0 验收后另行启动 |
| M2 | 未开始 | 依赖 M1，包括 DumpGeometry 实测 |
| M3 | 未开始 | 依赖 M2，包括宿主绘制实测 |
| M4 | 未开始 | 依赖 M3 |
| M5 | 未开始 | 依赖 M4 |
| M6 | 未开始 | 依赖 M5；要求原文 14.5 完整手动验收 |
| M7 | 未开始 | 依赖 M6 |
| M8 | 未开始 | 依赖 M7 与真实 AI 调用 |
| M9 | 未开始 | 依赖 M8 与干净机器安装验证 |

## 原始输入

- 主文档迁移前 SHA256：`F467FBB3475BB97A34B1732E4E7569975CE43F89561180D7B3EF4CAE3982E75D`。
- 导出版迁移前 SHA256：`062541FC9E19594F2102E63337E60443BA1CE2DE2ECD121B8F60AAF9500682F5`。
- 移动后主文档字节 hash 已验证未变；Git 文本规范化为 LF 后，以正文一致性和 Git 记录复核。

## M0 验收记录

- 日期：2026-10-16；Windows / Node v24.19.0 / npm 10.9.4（由已有 pnpm 临时执行）/ Git 2.53.0.windows.3。
- 文档与仓库基础提交：`6f22276`，`docs: establish specification and milestone workflow`。
- 工具链提交：见后续验收提交中的记录；无 origin、无 push、无发布 tag。
- 全新 `npm ci --ignore-scripts --no-audit --no-fund` 重新安装三个锁定依赖成功，package-lock.json hash 未变化。
- `npm test`：48 项通过，0 失败、0 跳过、0 todo。覆盖 ES3 禁用语法/API、例外规则、vm 禁用环境、确定性构建、F1 契约、规定 SVG 元素/路径/变换、输入错误和往返导入。
- `npm run build` 与 `npm run check:es3`：`dist/scripts/LogoGuides_Generate.jsx` 全 ASCII，ES3 通过；在带 app 访问陷阱的 vm 中只弹阶段提示，不访问宿主且不泄露 LG 全局。
- `npm run fixture -- F1`：输出 `dist/previews/F1.geometry.json` 和 `F1.svg`。
- `npm run preview -- dist/previews/F1.geometry.json --out dist/previews/F1.from-json.svg` 成功。
- `npm run preview -- dist/previews/F1.svg --out dist/previews/F1.roundtrip.svg` 成功；再次导入后不重复读取 lg-guides。
- 三份 SVG SHA256 相同：`321A580E09959A89DF5D3F504E916CA160EFFE8A3A59B2410C86DE87864ED9B5`。
- Chrome 无头生成并实际查看 `dist/previews/F1.png`（640×640）：浅灰圆完整，四段连接无可见缺口，无变形或辅助图元。PNG SHA256：`350730D86E0884D7BADCCC52E7811B678D279B50F44CC3DE7D6B645CACC175C7`。
- Node/Chrome 结果不代表 Illustrator 实测；M0 没有宿主功能实测要求。

## 当前限制与 M1 前置条件

尚未实现几何分析、Illustrator 操作、CEP 或 AI；M0 不要求 Illustrator 宿主功能实测。

本次按用户范围停在 M0，不自动进入 M1。M1 已满足 M0 前置验收条件；另行启动后实现第 15 节规定的读取/归一化模块，并在进入 M2 前由用户验证 DumpGeometry 导出。
