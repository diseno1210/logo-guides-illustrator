# 使用说明

当前阶段 M0：仅供开发工具链和 F1 几何预览验收。Illustrator 辅助线生成、刷新、清除、圆拟合、面板与 AI 尚未实现。

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

dist 为可重新生成的输出目录，不入 Git。M0 的 JSX 是阶段提示，不应当作已实现的 Generate 使用。预览也仅画输入几何；辅助图元组暂为空。

## Illustrator 安装与运行（后续阶段）

以下是原规范的安装路径说明，目前尚未完成脚本功能和 Illustrator 实测。

- Windows：`C:\Program Files\Adobe\Adobe Illustrator 版本\Presets\zh_CN\脚本`。
- macOS：`/Applications/Adobe Illustrator 版本/Presets.localized/zh_CN/脚本`。
- 放入发布脚本并重启后，可从“文件 › 脚本”运行；也可“文件 › 脚本 › 其他脚本”选择 JSX。
- 正式功能就绪后，可在动作面板通过“插入菜单项”记录脚本，再为动作设置快捷键；具体行为需宿主验收。

## 设置与日志（尚未实现）

原规范计划将 settings.json 和 log.txt 放在 Illustrator 的 Folder.userData/LogoGuides/ 下。具体设置字段和默认值见 DEV_PLAN.md 第 7 节；未放入对话框的设置未来通过此文件调整。M0 不创建用户设置或日志。

## 推送到自己的仓库

本次只初始化本地 main 并提交，不设置远程。拿到自己的仓库地址后，可自行执行：

```powershell
git remote add origin <你的仓库地址>
git push -u origin main
```

远程仓库若已包含提交，应先检查并整合历史，不强制推送。
