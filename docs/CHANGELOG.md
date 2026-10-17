# 变更记录

## 未发布 — M9（进行中，2026-10-17）

- 增加Node内置签名发布工具、固定CEP发布清单、ZIP安全/CRC校验、版本与ES3/ASCII检查、签名验证报告和SHA256清单；不新增依赖。
- 核对Adobe ZXPSignCmd 4.1.3 Windows x64来源并完成独立自签名探针；项目ZXP尚待带时间戳打包及干净机器安装。
- 增加安装、升级、卸载、回退、脚本路径和故障说明。M9未验收，版本仍为0.3.0。

## v0.3.0 — M8（已验收，2026-10-17）

- 添加OpenAI兼容Chat Completions与Anthropic Messages；本机独立AI配置、数值摘要、60秒HTTPS请求、严格JSON重试一次和失败精选回退，无新增依赖。
- 过滤未知id和越界目标，先校验建议再显式应用；同一核心重新计算测量、目标标签、偏差和目标图元，来源几何不改。分组与说明以纯文本显示。
- 网络期间busy保护；应用前复核文档、runId、a、设置及来源Geometry；刷新清除会话目标，隐藏状态沿用既有Doc Data。
- 186项自动测试、9份ES3通过；6项真实CEP检查通过（远端响应模拟），原生目标圆/显隐/来源不变已确认。
- 使用用户保存的AtlasCloud OpenAI兼容接口与openai/gpt-6-luna完成一次真实请求及原生应用：显示3项、隐藏9项、分组2个、目标建议0项，应用后16图元，原生来源Geometry不变。独立测试文档关闭，设置与活动文档已恢复；AI配置和密钥未入库。Anthropic真实调用未测，不泛化此次结果。M9签名安装未开始。

## v0.2.0 — M7（已验收，2026-10-17）

- Added CEP11 panel manifest, official CSInterface v11 and SDK license provenance.
- Added V8 panel controller/model for real-time settings, locked base unit, generate/refresh/clear/dump, feature visibility/selection and curated mode.
- Added seven encoded `LGHost_*` bridge functions with stale-read and pre-draw validation.
- 171项自动测试、9份ES3产物通过；14项真实CEP检查通过，F9面板/原生图元误差≤3.56e-13，F10刷新1092.2ms（101图元）。
- 修复原生锁层取消选中、无变化选区重复赋值、busy期间设a和跨文档延迟操作；补齐真实CEP验收工具及截图。
- 纠正旧host-only探针的V8标注和选择结论；阶段源码同步GitHub，工作日志同步Notion。

## v0.1.0 — M6（已验收，本地交付，2026-10-16）

- 整合设置窗口、UTF-8全局设置、按来源标签刷新、三种清除、SetBaseUnit、双语摘要、debug数据和完整日志。
- 六个ES3入口实际构建；刷新保留锁定a、runId、来源标签和手动结果，取消与异常恢复有自动覆盖。
- 修正稀疏圆采样的端点切线判定、跨孤立路径手动锚点读取、预览视口裁切；未改原始规范/参数/依赖。
- 153项测试通过，F10约227ms，Chrome核对15个案例；补齐完整使用说明及第14.5节用户实测表。M6尚未最终验收，未发布v0.1。
- 原生验收发现并修复Clear恢复已删图层时的失效引用异常；154项自动测试、六份构建及ES3检查通过。新增独立原生DOM与真实ScriptUI验收探针，修复后18项RGB/CMYK检查通过。
- 真实生成窗口可操作；一次Ctrl+Z撤销整次生成。原生2000点生成99,609ms，超出15秒目标，列入M7优化。原生guide标志已验证；直接选择拖动/吸附与Alt拖动仍待完成，M6不提前验收。

- 后续阶段源码推送到私有 GitHub 仓库 `diseno1210/logo-guides-illustrator` 的 `main` 分支，供其他 agent 审查；不创建发布 tag。
- 用户完成直接选择拖动/吸附及Alt复制；原圆移动后Refresh图元13→20，锁定a=20和runId不变。交互副本本机未复制标签，如需加入来源应重新生成。原文12项完成，v0.1脚本本地交付，无远程推送或Git tag。

## 未发布 — M5（已自动验收，2026-10-16）

- 增加方向聚类、轴角/空白夹角、共线构造线及最终区域裁剪、真实吸附目标线。
- 图例按实际类别和语言生成；可选安全区/背景、有符号轴角已实现且保持原默认。
- 136项测试、构建/ES3和Chrome图库通过。下一步整合M6完整交互后提交用户第14.5节实测。

## 未发布 — M4（已自动验收，2026-10-16）

- 实现圆分段/拟合/合并/覆盖/环/分类与评分，加入环标注、圆弧显示与偏差标记。
- CircleFromSelection读取真实选中锚点及相邻曲线采样，绘制LG Manual，保留来源和数据。
- 完整F10分析约219ms；核心与宿主保持ES3，无新增依赖。Chrome已核对圆贴合与偏差；宿主真实手动拟合在M6总验收。

## 未发布 — M3（已自动验收，2026-10-16）

- M2 已经用户真实 Illustrator 绘制验收，继续到 M3。
- 实现笔画/间距/可选高度与字怀、自动 a、倍率与吸附、车道/模块方块；宿主及 SVG 接入真实标签与方块。
- 115 项测试、构建/ES3 与 F3/F4/F6/F8 Chrome 预览通过；复杂真实样本默认车道溢出会明确警告。M4 圆、M5 角度及 M6 完整交互继续依序实现。

## 未发布 — M2（自动验证通过，待 Illustrator 实测，2026-10-16）

- 添加一维/环形聚类、直线边合并、解析极值与墨迹外缘判定；实现按行水平/全局竖直线分类和优先级线注册表。
- 添加辅助区域和参考线基础跨度、附录 B 深浅样式、线/标签图元、阶段 analyze 流水线；后续尺寸、圆、角度结果未伪造。
- 添加 Illustrator 线与多行文字绘制、RGB/CMYK 转换、按需图层、文档数据与来源标签；临时 Generate 开始生成参考线。
- 预览接入真实 analyze，保持 lg-geometry/lg-guides 分组；run_fixture 支持真实文件，输出分析报告；增加可复现参考线验收图库。
- 105 项自动测试通过，包括 F3/F6/F8/F9/F9b、F11 往返和真实 BOATCHIN 回归。宿主调用以 DOM mock 验证；等待用户实际运行 Generate，不进入 M3。

## 未发布 — M1（已验收，2026-10-16）

- 添加 namespaced public-domain JSON2、ES3 工具函数、完整规范配置、向量与贝塞尔解析计算。
- 添加精确包围盒、S 相对直线判定、行聚类、小部件归属、弧长采样预算控制和 even-odd 墨迹测试。
- 补齐 F1–F10（含 F9b）几何夹具；添加解析几何和配置规范对照测试。
- 添加选区读取、复合路径去重、临时文字轮廓及异常清理、UTF-8 dump 和日志；构建 DumpGeometry.jsx。
- 添加 Node `validate:geometry` 入口和真实 Illustrator 验收清单；用户 BOATCHIN 真实导出经 Node 读取、Chrome 预览核对，达到 M1 门槛。

## 0.0.0-dev — M0（已验收，2026-10-16）

- 建立规范归档、开发流程、状态、决策与使用说明。
- 初始化本地 Git main；尚未连接远程。
- 完成按序拼接、IIFE、#target 和 Unicode 转义构建；ES3 AST 检查及禁用 API 规则已验证。
- 完成移除禁用 API 的 vm 测试框架、F1 四段贝塞尔夹具、SVG 导入与几何预览。
- 固定三项开发依赖与 npm 锁文件；全新 npm ci 后 48 项测试、构建、ES3 检查全部通过。
- JSON / SVG 两条预览路径输出 hash 一致；Chrome 无头截图已人工视觉核对。
- 此版本尚不具备 Illustrator 辅助线功能；M1–M9 未开始，未执行 Illustrator 实测。
