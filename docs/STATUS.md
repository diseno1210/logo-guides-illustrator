# 开发状态

更新日期：2026-10-16。当前授权：在 M0 基础上推进开发，遇到规范要求的用户验收节点停下。状态：未开始 / 进行中 / 自动验证通过 / 待 Illustrator 实测 / 已验收。

| 里程碑 | 状态 | 验证与提交 |
| --- | --- | --- |
| M0 | 已验收 | 48/48 测试通过；构建/ES3 通过；F1 JSON/SVG 预览一致；Chrome 截图已核对 |
| M1 | 已验收 | BOATCHIN 真实 Illustrator 导出经 Node 读取和 Chrome 预览核对通过 |
| M2 | 待 Illustrator 实测 | 105/105 测试通过；构建/ES3、夹具分类、Chrome 预览通过；临时 Generate 待用户验证 |
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
- 工具链与测试提交：`7bc5306`，`build: complete M0 toolchain and F1 preview validation`；无 origin、无 push、无发布 tag。
- 全新 `npm ci --ignore-scripts --no-audit --no-fund` 重新安装三个锁定依赖成功，package-lock.json hash 未变化。
- `npm test`：48 项通过，0 失败、0 跳过、0 todo。覆盖 ES3 禁用语法/API、例外规则、vm 禁用环境、确定性构建、F1 契约、规定 SVG 元素/路径/变换、输入错误和往返导入。
- `npm run build` 与 `npm run check:es3`：`dist/scripts/LogoGuides_Generate.jsx` 全 ASCII，ES3 通过；在带 app 访问陷阱的 vm 中只弹阶段提示，不访问宿主且不泄露 LG 全局。
- `npm run fixture -- F1`：输出 `dist/previews/F1.geometry.json` 和 `F1.svg`。
- `npm run preview -- dist/previews/F1.geometry.json --out dist/previews/F1.from-json.svg` 成功。
- `npm run preview -- dist/previews/F1.svg --out dist/previews/F1.roundtrip.svg` 成功；再次导入后不重复读取 lg-guides。
- 三份 SVG SHA256 相同：`321A580E09959A89DF5D3F504E916CA160EFFE8A3A59B2410C86DE87864ED9B5`。
- Chrome 无头生成并实际查看 `dist/previews/F1.png`（640×640）：浅灰圆完整，四段连接无可见缺口，无变形或辅助图元。PNG SHA256：`350730D86E0884D7BADCCC52E7811B678D279B50F44CC3DE7D6B645CACC175C7`。
- Node/Chrome 结果不代表 Illustrator 实测；M0 没有宿主功能实测要求。

## M1 自动验证记录

- 实现提交：`ad37aeb`，`feat: implement M1 geometry foundations and dump acceptance script`。本提交表示自动验证完成，尚未通过真实 Illustrator 验收。
- 依据：原文 15 节 M1，实现 util/config/vec/bezier/geometry/sample/ink/rows、LG.json、host env/read 和 DumpGeometry。
- 设置字段和参数数值由测试直接对照 DEV_PLAN 第 7 节；所有 core 均在移除禁用 API 的 vm 中运行。
- 自动测试覆盖 M0 回归、解析几何、F1–F10（含 F9b）、复合孔洞、开放/描边、采样预算、文字临时轮廓失败清理、选区/activeLayer 恢复、RGB/CMYK、多画板、真实构建脚本的 mock 导出及 Node 读取。
- `npm test`：83/83 通过，0 失败、0 跳过、0 todo；`npm run build` 和 `npm run check:es3` 通过。产物 `dist/scripts/LogoGuides_DumpGeometry.jsx` 和 `LogoGuides_Generate.jsx` 均为 ASCII ES3。
- DumpGeometry JSX SHA256：`53FCCE198A9FC28B56FAB7D2E281B330D549E66F443FB2276ADDB6C249826273`。主规范迁移前 SHA256 保持不变。
- F1–F10 汇总产物：`dist/validation/M1.fixtures.json`，每个夹具均有 `*.m1.json` 验证报告和 `dist/previews/*.svg` 原始几何预览。
- F10：50 部件、2000 锚点、5 行、S=40、采样 20000，正常记录 SAMPLES_CAPPED。完整 analyze 尚未实现，因此不宣称通过 M4 的 <300ms 指标。
- `npm run validate:geometry -- dist/previews/F1.geometry.json dist/validation/F1.m1.json` 已运行，报告有限数值；UTF-8 BOM 输入兼容由测试覆盖。
- Chrome 无头生成并查看 `dist/validation/M1.gallery.png`：圆、环、矩形、X、椭圆、D、多行、I/O、50 圆布局与预期原始几何相符。尚无辅助图元识别结果。
- 操作清单：[M1 用户验收](acceptance/M1.md)。后续取得的实测证据见下节。

## 当前限制与下一步

M1 几何基础与实际选区导出已验收。M2 参考线分析、基础绘制和存储自动验证通过，等待真实 Generate 绘制；尺寸、圆、角度、完整交互、CEP 和 AI 未实现。host 自动测试使用 DOM mock，不能替代真实 Illustrator 实测。

## M1 真实 Illustrator 验证（2026-10-16）

- 证据提交：`a9fe4be`；验收状态与后续顺序提交：`46ba4dd`。
- 用户截图显示 BOATCHIN 选区导出成功：9 部件、0 警告；本机读取 `%APPDATA%/LogoGuides/geometry_dump.json`（74800 字节）。此前无选区时报错是正常保护，后续导出成功。
- 原始样本保存在 `tools/samples/illustrator-boatchin.geometry.json`，SHA256：`381999A50338F6FD452DC1E32BB7A7E2A792728D6D969476796BA2ADFB0CCAFC`。
- `node tools/validate_geometry.js tools/samples/illustrator-boatchin.geometry.json dist/validation/illustrator-m1.json` 退出 0：9 部件、21 轮廓、205 锚点、2 行、2582 采样，S=93.11435022375002，D=223.37563392497097，warnings=[]。
- `node tools/preview.js tools/samples/illustrator-boatchin.geometry.json --out dist/previews/illustrator-m1.svg` 退出 0；Chrome 无头截图 `dist/previews/illustrator-m1.png` 已实际查看，外形、文字孔洞及方向与用户截图相符。
- 此证据满足第 15 节 M1“DumpGeometry 导出的 JSON 能被 Node 读取（用户验证）”，可进入 M2。
- 未取得 Illustrator 具体版本、未转曲文字清理、CMYK 和撤销的实测证据；继续留在第 14.5 节完整清单，不记为通过。M1 操作页的扩展建议不额外增加原文门槛。

## M2 自动验证记录（2026-10-16）

- 实现提交：`49dd8fe`，`feat: implement M2 reference analysis and Illustrator drawing`。该提交代表自动验证完成，M2 尚未通过真实 Illustrator 绘制验收。
- 构建脚本 SHA256：Generate=`C50830AFEF980CB5AC15FAA015E5ED1BCD8DC217F7C6884F05C6453D1D05041B`；DumpGeometry=`5C85A48BAF626B131C59D8EAA823A37888D0A4D7EA904A1EAE3141EB3D9F93FC`。依赖与锁文件未变，无新增远程仓库或推送。
- 依据第 15 节 M2；实现 core/09、11、12、18、19、20、21 和 host/h03、h04；入口 Generate 暂用默认设置。数据契约、参数表与主规范正文均不修改。
- `npm test`：105/105 通过（83 项回归 + 22 项 M2 专项），0 失败、0 跳过、0 todo。使用移除禁用 API 的同一份 core；构建产物通过 ASCII/ES3 检查。
- `npm run build` 与 `npm run check:es3`：两份脚本均通过。Generate 的实际构建入口在 DOM mock 中执行完整 read/analyze/draw/store 流程，生成矩形夹具的 8 条线、隐藏数据和来源标签，并恢复原图层。此项不等于 Illustrator 实测。
- `node tools/validate_references.js`：生成 `dist/validation/m2/results.json`、各夹具 Geometry/analysis/render/SVG 和 `gallery.html`。F3=8、F6=5、F8=14、F9=7、F9b=5 条参考线；均 0 警告。F9 的 4 条水平线含 2 条 flat 和 2 条 overshoot；F9b 的 mixed 开关两种分支均验证。阈值冲突处理见 D011。
- F11 预览导入后 F3 分析结果一致，lg-guides 不作为输入几何。线开关只影响输出，分类证据保留；注册表验证 span 并集和 visual > baseline > dimension。曲线解析极值、孔洞、重叠墨迹、平移/缩放和有限数值保护均覆盖。
- `npm run fixture -- tools/samples/illustrator-boatchin.geometry.json` 与 `npm run preview -- dist/previews/illustrator-boatchin.svg --out dist/previews/illustrator-boatchin.roundtrip.svg` 均成功。真实编组的多个部件共享 sourceIndex=0，预览元素 id 改按部件序号保持唯一；测试覆盖。fixture 文件输入禁止覆盖自身。
- BOATCHIN 原始样本：9 部件、205 锚点、2 行；M2 输出 12 条参考线、0 警告，未生成测量、拟合圆或其他后续阶段特征。
- Chrome 无头生成并实际查看 `dist/validation/m2/gallery.png`（1800×1520）：F3/D/两行矩形边界线、F9 的视觉超出线、F9b 混合线及 BOATCHIN 方向/孔洞均符合当前阶段；对照页包含 mixedAsVisual=false。无尺寸标签可验收，字号/精确居中目前只经过自动 DOM 测试。
- 宿主自动验证覆盖 RGB/CMYK（包括纯黑防除零）、字体回退、多行实际边界居中与 -90°、重复生成保留 LG Manual、隐藏数据/来源标签、损坏数据拒绝和绘制失败时的锁定/选区/图层恢复。
- 验收入口：[M2 用户验收](acceptance/M2.md)。**当前停在 M2，不进入 M3**，等待用户确认真实 Illustrator 基准线绘制。主规范 SHA256 仍为 `F467FBB3475BB97A34B1732E4E7569975CE43F89561180D7B3EF4CAE3982E75D`。
