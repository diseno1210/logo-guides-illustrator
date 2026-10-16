# 使用说明

当前 M1 已实现几何基础和 DumpGeometry 导出，等待真实 Illustrator 验收。提供 F1–F10（含 F9b）几何夹具和预览。Illustrator 辅助线生成、刷新、清除、圆拟合、面板与 AI 尚未实现。具体步骤见 [M1 验收](acceptance/M1.md)。

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

dist 为可重新生成的输出目录，不入 Git。DumpGeometry 已实现；Generate 仍是阶段提示。预览仅画输入几何；辅助图元组暂为空。

SVG 导入支持 path、rect（含圆角）、circle、ellipse、polygon、polyline、line，以及 transform。跳过 lg-guides；不展开文本、use、外部 CSS、剪切或蒙版，相关内容会跳过或警告。非法变换/数值/嵌套 viewport 会报错。viewBox 的数值坐标按 pt 使用；不根据根 width/height 二次缩放。无单位/px 数值按 1pt，显式物理单位换算；与浏览器截图的 CSS px 比例不同，详见 DECISIONS.md D005。

预览检查命令（Chrome 参数路径可按本机调整）：

```powershell
$previewFile = (Resolve-Path 'dist/previews/F1.svg').Path
$previewUrl = ([System.Uri]$previewFile).AbsoluteUri
$previewPng = Join-Path (Get-Location).Path 'dist/previews/F1.png'
$previewProfile = Join-Path (Get-Location).Path 'dist/chrome-profile'
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --headless --disable-gpu --no-first-run --hide-scrollbars --force-device-scale-factor=1 --window-size=640,640 --user-data-dir=$previewProfile --screenshot=$previewPng $previewUrl
```

Chrome 可能异步结束写图，应确认 PNG 存在后再打开查看。M0 视觉验收对象为 F1 浅灰圆形，无辅助线、标注或 AI 结果。

## Illustrator 安装与运行（后续阶段）

以下是原规范的安装路径说明，当前应运行 DumpGeometry；真实 Illustrator 实测待用户完成。

- Windows：`C:\Program Files\Adobe\Adobe Illustrator 版本\Presets\zh_CN\脚本`。
- macOS：`/Applications/Adobe Illustrator 版本/Presets.localized/zh_CN/脚本`。
- 放入发布脚本并重启后，可从“文件 › 脚本”运行；也可“文件 › 脚本 › 其他脚本”选择 JSX。
- 正式功能就绪后，可在动作面板通过“插入菜单项”记录脚本，再为动作设置快捷键；具体行为需宿主验收。

## 设置与日志

DumpGeometry 将 geometry_dump.json 和 log.txt 放在 Illustrator 的 Folder.userData/LogoGuides/ 下；每次覆盖 dump，日志追加并在超过 1MB 时轮转。导出成功弹窗显示实际路径。M1 使用默认设置，尚不读取用户 settings.json；设置存储与对话框留在后续里程碑。完整字段和默认值见 DEV_PLAN.md 第 7 节。

## 推送到自己的仓库

本次只初始化本地 main 并提交，不设置远程。拿到自己的仓库地址后，可自行执行：

```powershell
git remote add origin <你的仓库地址>
git push -u origin main
```

远程仓库若已包含提交，应先检查并整合历史，不强制推送。
