# 使用说明

M1 的真实 Illustrator 导出已通过 Node 读取验收。当前 M2 自动验证通过，等待用户验证实际参考线绘制；临时 Generate 只生成水平/竖直基准线与视觉线。笔画/倍率、圆拟合、角度、刷新、清除、面板与 AI 尚未实现。当前操作见 [M2 验收](acceptance/M2.md)。

## 开发命令

安装 Node 20+ 和 npm 10 后，在项目根目录执行：

```powershell
npm ci
npm test
npm run build
npm run check:es3
npm run fixture -- F1
npm run preview -- dist/previews/F1.geometry.json
npm run preview -- dist/previews/F1.svg --out dist/previews/F1.roundtrip.svg
npm run validate:geometry -- "导出文件实际路径" dist/validation/illustrator-m1.json
node tools/validate_references.js
npm run fixture -- tools/samples/illustrator-boatchin.geometry.json
```

当前机器的 npm 替代入口（仅此环境需要）：

```powershell
$pnpmPath = 'C:\Users\disen\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
& $pnpmPath dlx npm@10.9.4 ci
& $pnpmPath dlx npm@10.9.4 test
& $pnpmPath dlx npm@10.9.4 run build
& $pnpmPath dlx npm@10.9.4 run check:es3
& $pnpmPath dlx npm@10.9.4 run fixture -- F1
```

dist 为可重新生成的输出目录，不入 Git。DumpGeometry 导出选区；临时 Generate 绘制参考线。preview 和 fixture 现在运行真实阶段 analyze，按样式叠加参考线，并跳过辅助组的再次导入。fixture 输出 geometry.json、SVG 和 analysis.json；既可输入 F1–F10（含 F9b），也可输入真实 JSON/SVG 文件。

SVG 导入支持 path、rect（含圆角）、circle、ellipse、polygon、polyline、line，以及 transform。跳过 lg-guides；不展开文本、use、外部 CSS、剪切或蒙版，相关内容会跳过或警告。非法变换/数值/嵌套 viewport 会报错。viewBox 的数值坐标按 pt 使用；不根据根 width/height 二次缩放。无单位/px 数值按 1pt，显式物理单位换算；与浏览器截图的 CSS px 比例不同，详见 DECISIONS.md D005。

预览检查命令（Chrome 参数路径可按本机调整）：

```powershell
$previewFile = (Resolve-Path 'dist/previews/F1.svg').Path
$previewUrl = ([System.Uri]$previewFile).AbsoluteUri
$previewPng = Join-Path (Get-Location).Path 'dist/previews/F1.png'
$previewProfile = Join-Path (Get-Location).Path 'dist/chrome-profile'
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --headless --disable-gpu --no-first-run --hide-scrollbars --force-device-scale-factor=1 --window-size=640,640 --user-data-dir=$previewProfile --screenshot=$previewPng $previewUrl
```

Chrome 可能异步结束写图，应确认 PNG 存在后再打开查看。M2 汇总页面位于 `dist/validation/m2/gallery.html`，使用同样方式截图检查。基准线颜色严格使用默认 dark 样式，在白底上较浅；没有启用背景板，不自动添加背景。

## Illustrator 安装与运行

当前可运行 DumpGeometry 与临时 Generate。Generate 的真实绘制待用户按 M2 清单实测。

- Windows：`C:\Program Files\Adobe\Adobe Illustrator 版本\Presets\zh_CN\脚本`。
- macOS：`/Applications/Adobe Illustrator 版本/Presets.localized/zh_CN/脚本`。
- 放入发布脚本并重启后，可从“文件 › 脚本”运行；也可“文件 › 脚本 › 其他脚本”选择 JSX。
- 正式功能就绪后，可在动作面板通过“插入菜单项”记录脚本，再为动作设置快捷键；具体行为需宿主验收。

临时 Generate：选中 Logo，从“其他脚本”运行 `dist/scripts/LogoGuides_Generate.jsx`，成功弹窗显示参考线/警告数量。它创建或更新顶层 Logo Guides、按需的 LG Baselines / LG Visual Lines、隐藏文档数据和 LG_SOURCE 来源标签，默认锁定辅助层，并恢复原活动图层与来源选区。默认 styled 输出是可编辑线条，不是 Illustrator 原生参考线；原生 guides/both 已有宿主支持和自动测试，待 M6 完整界面提供设置入口。

再次 Generate 会替换自动辅助子层，保留 LG Manual。M2 没有 Refresh/Clear；需要移除预览线时可手动解锁并删除 Logo Guides 图层。这样只删除图层，来源标签仍保留，下次 Generate 会重写；完整清理功能在 M6。当前建议在副本文档完成验收。

## 设置与日志

DumpGeometry 将 geometry_dump.json 和 log.txt 放在 Illustrator 的 Folder.userData/LogoGuides/ 下；每次覆盖 dump，日志追加并在超过 1MB 时轮转。Generate 成功/失败也写入同一日志。导出弹窗显示实际路径。M2 入口使用默认设置，尚不读取用户 settings.json；全局设置文件与对话框在 M6 实现。完整字段和默认值见 DEV_PLAN.md 第 7 节。

文档数据保存在辅助层隐藏路径 `__LG_DATA__` 的 note。M2 尚无自动 a，相关值为 null 且不锁定；不显示模拟倍率。后续 M3 会补全自动 a 与标注。

## 推送到自己的仓库

本次只初始化本地 main 并提交，不设置远程。拿到自己的仓库地址后，可自行执行：

```powershell
git remote add origin <你的仓库地址>
git push -u origin main
```

远程仓库若已包含提交，应先检查并整合历史，不强制推送。
