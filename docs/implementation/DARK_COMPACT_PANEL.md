# 暗色紧凑面板实施记录

日期：2026-10-17。依据用户确认的《Logo Guides 暗色紧凑面板开发安排》，以 `8693050` 为基线，在 `codex/dark-compact-panel` 本地开发。版本保持 v0.3.2；开发验收阶段未打包签名、推送或更新外部日志。用户随后追加授权将已验收改动同步 GitHub main；不制作新签名包或更新外部日志。原始审查计划文件保留原样。

## 面板与交互

- 操作按钮、状态、警告、标签栏固定；参数、标注、特征、AI 四页按会话切换。参数默认打开；特征数量和 AI 待应用提示由现有 state 更新。
- 标签通过 role、aria-controls、aria-labelledby、aria-selected、hidden 和 roving tabindex 关联。支持左右键循环及 Home/End；忙碌只禁用业务控件。导航在 CEP 初始化前注册，普通浏览器也可切换。
- 面板固定暗色 #535353，22px 控件，最低 11px 字号，自绘复选框和滑杆。辅助线 stylePreset 及整理展示保留原行为；不改变分析、绘制或持久化数据。
- 359px 以下标签移至控件上方，299px 以下参数单列、生成内容两列。320px 以上且高度不超过 480px 时缩减垂直间距；摘要最多显示 32px 后局部滚动，避免展开摘要导致双层滚动。一般摘要上限仍为 160px。
- 原生数字输入的 min/step/value 原样保留。部分既有默认值与 HTML step 基点不整除，因此不使用 number:invalid 着色，数值错误沿用现有 JS 校验和状态提示；URL 输入保留 :invalid 描边。

UI 修改仅涉及现有 index.html、panel.css、app.js；新增文件只有测试、验收工具及文档。core、host、model、AI 传输、manifest、构建/发布清单和依赖未修改；不新增公共 API 或配置字段。

## 独立缺陷修复

- F-1：在 app.js 中保留会话内的 OpenAI 兼容 baseUrl。Anthropic 显示固定只读地址，切回恢复原地址；以 Anthropic 启动且没有 OpenAI 会话地址时恢复空值，沿用现有 HTTPS 必填校验。不增加配置字段，不保存提供商切换历史。
- F-2：controller.select 保留宿主返回值。selected 非零为选中；matched 为零提示当前未绘制；存在图元但 selected 为零保留隐藏提示。列表测量、显隐、绘制及 host 接口均不变。

## 提交与回退

| 提交 | 内容 |
| --- | --- |
| 5bc71e7 | 基线与 DOM 契约测试 |
| 429b5e7 | 完整四标签 UI 与既有验收工具适配 |
| 0a2db29 | F-1 地址切换修复及 app 行为测试 |
| 64eb31b | F-2 定位提示修复及 controller 测试 |

后续验收提交包含短面板校准、验收工具及文档。回退使用本分支对应提交；本机开发面板需要重新构建复制并重载。原安装目录备份保存在 `dist/dark-compact/baseline/installed-panel`，不提交。

## 验证入口

见[验收记录](../acceptance/DARK_COMPACT_PANEL.md)。不实施 U5、F-3 至 F-7、算法优化或 M9 干净机器安装；CEP 11、macOS、物理停靠拖拽及 100%/150% 系统缩放仍需独立环境核验。
