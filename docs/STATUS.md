# 开发状态

更新日期：2026-10-17。当前授权：继续验收与开发，能代理完成的工作自主执行，确需用户操作时再交接；仍按M0–M9验收顺序推进。状态：未开始 / 进行中 / 自动验证通过 / 待 Illustrator 实测 / 已验收。

| 里程碑 | 状态 | 验证与提交 |
| --- | --- | --- |
| M0 | 已验收 | 48/48 测试通过；构建/ES3 通过；F1 JSON/SVG 预览一致；Chrome 截图已核对 |
| M1 | 已验收 | BOATCHIN 真实 Illustrator 导出经 Node 读取和 Chrome 预览核对通过 |
| M2 | 已验收 | 用户截图确认实际生成 12 条参考线、0 警告，辅助层锁定，原图层活动 |
| M3 | 已验收 | 115 项测试、构建/ES3、F3/F4/F6/F8 数值与 Chrome 布局通过；无额外宿主门槛 |
| M4 | 已验收 | `349a828`；129项测试/Chrome通过，F10 <300ms |
| M5 | 已验收 | `bb4e849`；136项测试/Chrome通过，F4角度/F3目标线/图例通过 |
| M6 | 已验收 | `6da8b2a`实现、`c4784b0`原生修复；154项测试、6份ASCII/ES3脚本、18项原生DOM、真实窗口/撤销与用户拖动均通过；v0.1.0 |
| M7 | 已验收 | v0.2.0；171项测试、9份ES3产物通过；真实CEP F10刷新1092ms/101图元，F9原生图元误差≤3.56e-13；14项CEP检查通过，证据见acceptance/M7.md |
| M8 | 已验收 | v0.3.0；186项测试、9份ES3通过；6项真实CEP模拟响应检查、一次AtlasCloud真实AI请求及原生应用通过，来源Geometry不变，见acceptance/M8.md |
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

M0–M7已满足各自门槛。当前交付v0.2.0，M8 AI和M9签名安装尚未实现。M7已完成实际CEP UI、桥接、特征选中/显隐与2000锚点性能实测；Notion日志与GitHub随阶段更新。

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
- 验收入口：[M2 用户验收](acceptance/M2.md)。后续实际验收记录见下节。主规范 SHA256 仍为 `F467FBB3475BB97A34B1732E4E7569975CE43F89561180D7B3EF4CAE3982E75D`。

## M2 真实 Illustrator 验证（2026-10-16）

- 用户提供三张截图并明确要求继续开发：成功弹窗为 M2、12 条参考线、0 警告；画面可见灰色虚线与红色视觉线，BOATCHIN 图形保留，与 Node 预览相符。
- 图层截图显示 Logo Guides 锁定，含隐藏 __LG_DATA__、LG Visual Lines、LG Baselines；原“图层 1”为活动图层。此证据满足第 15 节 M2 真实基准线绘制门槛，记为已验收。
- 截图没有证明重复生成、Manual 保留、CMYK、未转曲文字清理和撤销行为，不把这些项目记为真实实测通过。完整第 14.5 节验收仍在 M6。
- 用户授权继续按顺序推进，M3–M5 完成自动验收后逐一记录并提交；下一处明确要求用户实测的总验收门槛是 M6 第 14.5 节，不额外创造审批节点。

## M3 验收记录（2026-10-16）

- 实现笔画最近平行边配对、交断合并、间距/高度/字怀、a 候选与加权中位数、倍率/吸附/severity、车道与模块方块；preAnalyze 在参数完全相同时复用 normalize/sample/edges，lines/stems 总是重算。
- `node tools/run_tests.js`：115/115；`node tools/build.js`、`node tools/check_es3.js` 通过。F3 宽20/20/19.2、间距20/20.8、a20；F4 两条20pt斜笔画；F6 竖笔画20；F8 两行标注正确。F2 环兜底留到 M4。
- `node tools/validate_milestone.js M3` 输出 `dist/validation/m3/`；Chrome 无头截图 gallery.png 已实际查看。F3/吸附/F4/F6/F8 标签无重叠；BOATCHIN 默认四车道溢出并输出 LABEL_LANES_FULL，允许末车道重叠，不隐瞒且不自行提高默认车道数。
- 当前无圆/角度/完整交互；M3 无单独强制 Illustrator 实测节点，依第15节自动验收后进入 M4。

## M4 验收记录（2026-10-16）

- 实现曲率分段、Kåsa/LM、递归弧长拆分、相邻/跨区域合并、最大角隙覆盖、墨迹环验证、视觉分类/优先评分与数量限制。拟合中的采样不泄露到公开输出。
- F1 r=100.014、覆盖359.43°；F2 两圆、环40.006、a来源fallback-ring且标签a；F5均≤180°；F6环20.003及竖笔画20；F7宽松1圆、严格无异常；F9/F9b分类通过。
- 新增 CircleFromSelection：读取真正选中锚点，只有相邻端点均选中才加入曲线采样，输出 LG Manual，显示文档a倍率或pt及锚点最大偏差；不改来源数据，自动生成保留手动层。
- `node tools/run_tests.js`：129/129通过，包括拟合、开关、容差、环、圆弧手柄和手动选点。F10 预建输入完整 analyze=219.43ms（另一次216.92ms），低于300ms。测试文件串行避免其他工作进程争用CPU；未降低采样数或容差。
- `node tools/build.js`、`node tools/check_es3.js` 通过，三份ASCII ES3脚本。`node tools/validate_milestone.js M4` 和 Chrome 无头截图 `dist/validation/m4/gallery.png` 已实际查看；环与偏差符合预期，复杂真实样本车道重叠继续警告。
- 手动工具真实 Illustrator 行为留待第14.5节；原文M4无额外用户门槛，继续M5。

## M5 验收记录（2026-10-16）

- M4提交`349a828`。M5实现方向簇轴角、墨迹外夹角、共线构造线、尺寸/轴角目标线、实际类别图例；可选安全区/背景已实现且默认关闭，有符号轴角按设置输出。
- `node tools/run_tests.js`：136/136；`node tools/build.js`、`node tools/check_es3.js`通过。F4=两个35°轴角、一个70°夹角；F3吸附第三笔画目标x=80.9/99.9，第二间距目标x=81。夹角不画目标射线。
- Liang–Barsky裁剪在图例扩展最终区域后执行；圆full越界回退同样使用最终区域。纯dimension水平引线维持登记跨度，基准/视觉线覆盖辅助区域。图例只显示实际类别，guides模式仍保持样式化图例。
- `node tools/validate_milestone.js M5`及Chrome `dist/validation/m5/gallery.png`已实际查看，数值与图例符合预期；复杂样本默认车道警告仍保留。可选背景位于独立底层，自动测试验证锁定与活动图层恢复。
- M5没有单独宿主用户门槛，进入M6；v0.1尚未发布。

## M6 自动验证记录（2026-10-16）

- 实现提交：`6da8b2a`，`feat: integrate M6 scripts settings refresh clear and host acceptance`。该提交只确认自动验证通过，M6总验收仍待用户。

- 实现ScriptUI dialog：候选/上次锁定值/自定义a、容差、精度/吸附/特殊比例、已实现生成内容、输出样式/模式/锁层/延伸；候选列表不随窗口内改容差刷新。无效a保持窗口打开，取消不写设置、不绘制。
- 全局settings.json以UTF-8保存并与默认值合并，刷新以文档锁定a优先。刷新忽略当前部分选区，通过LG_SOURCE找全部来源，保留runId/标签/首次a来源及Manual。未锁定时更新a且保持文档未锁定。
- Clear三种范围、SetBaseUnit对象/两锚点选项及自动刷新、手动圆全局设置、双语摘要/警告、debug dump、日志轮转和异常恢复已接入六个真实构建入口。日志ms包括读取/预分析/分析/绘制，排除窗口停留。
- `node tools/run_tests.js`：153/153通过，无失败/跳过/todo；`node tools/build.js`、`node tools/check_es3.js`通过，六份脚本均ASCII/ES3。F10最终完整analyze=226.84ms（独立圆测试227.11ms），低于300ms；DOM/ScriptUI替身没有冒充真实宿主。
- `node tools/validate_milestone.js M6`生成15个预览案例；Chrome截图`dist/validation/m6/gallery.png`已实际查看，包含F4角度吸附、F3安全区/背景。默认复杂样本车道溢出继续记录警告。
- 整合修正：角点切线取精确段端点，稀疏采样不会误切连续圆；跨3条孤立锚点路径可手动拟合；预览视口纳入实际图元范围，完整显示超出guideArea的圆/安全区；不改核心裁剪规则或第7节参数。
- 规范SHA256仍为`F467FBB3475BB97A34B1732E4E7569975CE43F89561180D7B3EF4CAE3982E75D`；依赖和锁文件未改，Git仅本地main。
- 下一前置条件：用户完成[M6原文12项清单](acceptance/M6.md)，记录Illustrator版本、2000锚点耗时、撤销范围和复制标签行为。确认前不标M6已验收，不进入M7，不发布v0.1。
- 2026-10-16 用户委托代理执行原生验收；已发现运行中的 Illustrator 2026 与“测试验收.ai”窗口，但 Computer Use 截图在恢复窗口连接后仍连续超时。未执行脚本或修改文档，12项继续待验证；详见验收页执行记录。恢复桌面截图能力后继续，M6状态不变。

## M6 原生验收与修复记录（2026-10-16）

- 修复提交`c4784b0`：使用原生COM脚本接口恢复验收，发现Clear删除Layer后严格相等比较也会抛“对象无效”；只捕获失效引用比较，继续恢复存活层，真实锁定写入异常仍传播。新增回归及两个显式执行的原生验收生成工具，不进入发布脚本。
- `node tools/run_tests.js`：154/154，0失败/跳过/todo，F10 Node analyze=219.60ms；`node tools/build.js`、`node tools/check_es3.js`六份通过。两个验收工具Node语法及其生成的JSX ES3均通过。
- Illustrator版本30.0.0。独立RGB/CMYK各9项原生检查，共18/18通过：真实编组/复合路径/未转曲文字、颜色类型/图层/隐藏数据/活动层/背景、部分选区全量刷新/锁定a、4锚点手动圆及保留、DOM复制标签、SetBaseUnit、原生guides、三种Clear。普通探针只注入窗口选择和内存设置，实际执行同份core/host，未修改全局设置。
- RGB/CMYK实际渲染PNG已查看：标注与中文图例正常；每个生成102图元，DOM移动后101且a保持20；手动圆r=32.00445pt/误差0.00445pt；guides模式各62条原生参考线。
- 另用真实ScriptUI对话框，可访问性完整读取中文控件，Computer Use按Enter完成生成；实际按一次Ctrl+Z后20→2对象，根辅助层与2个LG_SOURCE标签一并撤销，原图形保留。COM单次生成结果不泛化为其他版本/入口，见D017。
- F10真实2000锚点全流程生成99,609ms、101图元，超过15秒目标；原文允许记录并列入M7优化，本次未放宽采样或参数。此值与Node核心219.60ms的测量范围/运行时不同，不能互换。
- 原始运行文件位于`dist/native-acceptance/`；可提交的事实摘录见[原生证据JSON](acceptance/evidence/M6-native.json)，详细命令及限制见[M6验收页](acceptance/M6.md)。首次试跑的探针自身断言问题和Clear错误均保留，未把首次全部检查标通过。
- 窗口截图持续超时；键盘移动尝试中锚点未改变，不记为真实直接选择拖动通过。已打开独立`LG_M6_UI.ai`（a=20，原生guides、两个来源标签）供用户直接选择拖动/吸附和Alt拖动；原“测试验收.ai”未修改。用户完成操作后读取实际数据并刷新，再决定M6验收；目前不进入M7、不发布v0.1。

## M6 最终验收（2026-10-16）

- 用户确认拖动“能吸附”，后续原生读取发现交互副本不带LG_SOURCE，Refresh只包含2个带标签原来源；准确记录差异，不以DOM duplicate推断Alt拖动。
- 用户另确认已移动原圆锚点。实际读取(320,250)→(316.596625766871,250)，Refresh图元13→20，a=20与runId保持不变，完成第4项。证据追加至`acceptance/evidence/M6-user-drag.json`。
- 第14.5节12项完成；2000点耗时99,609ms依原文列入M7优化，M6已验收，版本0.1.0。锁文件仅更新根包版本，依赖未变；不创建Git tag、远程或推送。

## M7 真实 CEP 验收（2026-10-17）

- Windows / Illustrator 30.0.0 / CEP12 / Chromium99 / Node17.7.2 / V8 9.9；用户打开面板后通过该面板本地调试端口执行真实CSInterface与DOM操作。
- 171项自动测试、构建及9份ES3产物通过；F1–F10及BOATCHIN的共享core比较保持类型/数量一致与数值误差≤1e-6。
- 14项真实CEP检查通过。F9 18图元，面板与原生ExtendScript最大数值差3.552713678800501e-13；实际选中1个原生对象。
- F10 50部件/2000锚点：生成986.7ms，刷新1092.2ms（read590 / compute111.3 / draw105ms，其余为序列化、通信与校验），101图元；默认功能与采样未降低。
- 修复无变化选区反复赋值触发的原生锚点重选；宿主用原生无描边geometricBounds选择画板，退化检查提前停止重复采样。原始Geometry坐标和core算法不变。
- 修复临时选择被图层锁定取消；对应辅助层临时解锁，下次面板操作或重新连接恢复。新增文档身份校验与明确的连接按钮，防止延时刷新/清除/设a作用于另一文档。
- 旧M7-native中的758ms是纯ExtendScript探针，598ms计时包含read，不能称为V8；旧测试只检查matched，未验证selected。已纠正并保留历史记录。
- 原始结果/实际CEP截图：dist/native-acceptance/m7-cep-final/；入库摘要：[M7-cep.json](acceptance/evidence/M7-cep.json)。独立测试文档已关闭，测试前的全局设置与dump已恢复。
- 命令：node tools/run_tests.js；node tools/build.js；node tools/check_es3.js；node tools/cep_acceptance.js dist/native-acceptance/m7-cep-final。

## M8 实现与自动验证（2026-10-17，开发提交8a28775）

- 已按第12节实现OpenAI兼容及Anthropic设置、数值摘要、Node HTTPS调用、60秒绝对超时、严格JSON/单次重试、响应校验、暂存/应用及精选回退；仅本机保存连接配置，无新增依赖。
- 目标在同一ES3核心的ratios→layout→primitives流程生效，覆盖尺寸、圆、环、轴角/夹角；Geometry/Settings/Doc Data及analyze返回契约不变。groups/notes纯文本，目标/说明不持久化到文档。
- 186/186自动测试通过、9份ES3构建通过。M8新增15项测试，覆盖两种协议、传输失败/超时、中断/响应上限、严格重试、非法id/越界target、隐私、全类别目标图元及未改来源、精选省略项可见性、busy/文档/几何/a/参数变化保护。
- 真实Illustrator30/CEP12中6项M8检查通过，只有远端响应模拟：首次非JSON→重试成功，过滤非法项；F9应用后22图元含1个原生目标圆，隐藏1特征对应2个对象；原生读取来源Geometry不变；刷新清除目标，双非JSON回退，编辑来源/切换文档拒绝旧建议。独立测试文件已关闭，全局设置与原活动文档恢复。
- 命令：node tools/run_tests.js；node tools/build.js；node tools/check_es3.js；node tools/cep_ai_acceptance.js dist/native-acceptance/m8-cep-final。结果见[验收页](acceptance/M8.md)及[M8-cep.json](acceptance/evidence/M8-cep.json)，实际CEP截图已查看。
- 此开发提交阶段，用户已选择OpenAI兼容接口，真实调用尚待本机保存配置；当时保持v0.2.0，未提前验收。DEV_PLAN SHA256仍为F467FBB3475BB97A34B1732E4E7569975CE43F89561180D7B3EF4CAE3982E75D。

## M8 真实AI与最终验收（2026-10-17）

- 用户提供https://api.atlascloud.ai/v1并确认本机配置已保存。使用面板中用户选择的openai/gpt-6-luna执行真实请求；未读取或输出key至工具结果，连接配置不入Git，不修改默认模型。
- `node tools/cep_ai_acceptance.js dist/native-acceptance/m8-live-01 --live`：真实请求与原生应用两项检查通过。校验后show=3、hide=9、targets=0、groups=2、notes183字符；应用后16图元，9个隐藏特征对应12个原生隐藏对象，来源Geometry完全相同。
- 本次AI未提出目标值，不把它描述为真实服务目标线验证；全类别目标及原生目标圆证据仍来自既有自动测试和模拟响应CEP验收。Anthropic尚无真实调用证据。
- 独立F9测试文档已关闭，原活动文档及全局设置恢复。实际CEP截图已查看；原始结果位于dist/native-acceptance/m8-live-01/，入库证据为[验收JSON](acceptance/evidence/M8-live.json)。
- 满足第15节M8验收，版本统一更新为0.3.0。没有发布tag或签名ZXP；M9干净机器安装仍待下一阶段。
- 版本更新后186项全量测试、9份ES3构建再次通过；最终开发扩展已重载，实读LG.version=0.3.0、milestone=M8，面板配置保留且非busy，未重复发起真实请求。
- 同步前远端新增fe65875（清空README），已rebase并保留该变更，没有恢复旧README。其余最终源码与通过验证的版本一致；阶段状态、使用说明及证据入口位于docs/。
