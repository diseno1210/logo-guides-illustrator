# 暗色紧凑面板验收

日期：2026-10-17。基线 `8693050`；本地分支 `codex/dark-compact-panel`；版本 v0.3.2。状态：自动、浏览器和 Windows Illustrator 30 / CEP 12 开发验收通过。未发布测试包，M9 状态不变。

## 本次执行与结果

| 检查 | 实际结果 | 证据（仓库根目录下，忽略文件） |
| --- | --- | --- |
| 旧版基线 | 14/14 真实 CEP 回归；F10 刷新 452ms；浏览器 400px 宽页面高 2494px，AI 按钮 y=2101px | dist/dark-compact/baseline/cep、baseline/layout |
| node tools/run_tests.js | 207/207；F10 analyze 219.39ms，原 300ms 阈值保留 | dist/dark-compact/final/node-tests.txt |
| node tools/build.js、node tools/check_es3.js | 构建成功；ES3 OK: 9 file(s) | 本轮命令输出、构建产物 dist/panel |
| node tools/panel_layout_acceptance.js dist/dark-compact/final/layout-complete | 87 项检查通过；20 张默认页截图；F1–F10（含 F9b）Geometry 和 render 与改版前基线相等 | final/layout-complete/results.json、geometry-render.json、PNG |
| node tools/cep_acceptance.js dist/dark-compact/final/cep | 14/14；F9 两引擎图元最大差 3.552713678800501e-13；F10 2000 锚点刷新 497.3ms、101 图元 | final/cep/results.json、四页截图 |
| node tools/cep_readability_acceptance.js dist/dark-compact/final/readability-cep | 10/10；原生字号、颜色、物理虚线、圆弧、线宽、AI 目标与两种标注模式通过 | final/readability-cep/results.json、panel.png、artwork.png |
| node tools/cep_ai_acceptance.js dist/dark-compact/final/ai-cep | 6/6；真实 CEP 中模拟网络响应，重试、过滤、应用、回退、来源变化及跨文档拒绝通过 | final/ai-cep/results.json、panel.png |
| node tools/cep_compact_acceptance.js dist/dark-compact/final/compact-cep-complete | 6/6 组专项；8 参数、15 开关、定位提示、busy 标签键盘导航、地址切换、外观及20张尺寸截图 | final/compact-cep-complete/results.json、PNG |
| 本机安装文件复核 | 9 个关键运行文件 SHA256 与 dist/panel 一致 | final/installed-build.json |

以上 final 路径均相对 `dist/dark-compact/`。自动测试的 app DOM 替身只用于隔离配置、busy 与事件边界；真实宿主结果来自另外四套 CEP 工具，不以替身替代。

## 实际布局

真实 CEP 使用尺寸模拟，字体和运行时代码为本机宿主。测量时已生成 F9 并有一行候选，状态/标签固定区均为 80px；四页均无横向滚动。

| 尺寸 | 参数页外层溢出 | 标注页外层溢出 | 特征列表可视高度 | AI 页外层溢出 |
| --- | --- | --- | --- | --- |
| 280×600 | 263px | 135px | 397px | 0 |
| 320×420 | 117px | 44px | 262px | 0 |
| 400×420 | 53px | 0 | 262px | 0 |
| 320×780 | 0 | 0 | 614px | 0 |
| 400×780 | 0 | 0 | 614px | 0 |

非 CEP 浏览器中参数页在 320×420 溢出 97px，400×420 溢出 33px；差异来自真机已有候选。400×780 标注字号距内容顶部 6px，请求 AI 建议距顶部 6px。两行候选在 320×780 可完整显示；100 行特征、长 AI 文本各自局部滚动；短面板展开摘要不产生外层滚动；展开连接设置允许外层滚动且不溢出宽度。280px 是宿主最小宽度以外的降级尺寸，允许纵向滚动及按钮换行。

主文字对比度 6.28，提示文字 4.60，主按钮白字 4.54，焦点环 4.10，ok/warn/bad 分别 4.53/5.12/4.61。浏览器计算复核通过，最低字体 11px。

## 行为、数据与恢复

- light 样式状态下 body 不含 light；原生两条视觉线实际为 RGB(163,116,95)，证明辅助线仍采用 light 样式。整理展示重复点击不继续缩小，面板背景保持 RGB(83,83,83)。
- 关闭笔画输出后定位：matched=0、selected=0，提示“当前未绘制”；实际隐藏后 matched=1、selected=0，提示“已隐藏”；恢复显示后 selected=1，提示选中。测量条目仍保留。
- F-1 自动测试通过模拟存储保存配置，并通过模拟 transport 确认切回后的请求地址为 example.test/v1/chat/completions；Anthropic 首次加载后切回无历史地址时为空。真实 CEP 只在内存往返切换模拟地址，不保存真实 AI 配置，也没有调用真实远端服务。
- busy 请求期间业务控件全部禁用，四标签可点击和键盘导航；AI 提示点、无结果/无建议禁用态、文本内容不解析 HTML 均通过。
- 所有宿主测试使用独立 F9/F10/BOATCHIN 文档，在 finally 中关闭；设置、dump 及原活动文档恢复，开发面板重新连接原文档。没有刷新用户原稿。证据不包含 API key。
- git 差异确认 core、host、model、ai.js、host_api.js、manifest、package/lock、构建和发布清单未变；版本保持 0.3.2。

保留了早期失败证据：首次新增原生颜色断言存在工具字符串转义错误，修正后回归通过；真机短面板初测溢出 127px，校准间距后复测 117px。失败目录保留在 final/compact-cep 和 ui/cep，不冒充最终通过证据。

## 未覆盖

CEP 11 / Chromium 88、macOS、不同 Illustrator 版本、原生停靠/浮动拖拽及 100%/150% 系统缩放、与属性面板并排的物理尺寸比较仍待独立实测。尺寸模拟不替代系统 DPI 验证。未运行真实 AI 远端请求，未制作签名包或同步 Notion；开发验收阶段未推送，用户随后追加授权将已验收改动同步 GitHub main；M9 干净机器安装仍未完成。
