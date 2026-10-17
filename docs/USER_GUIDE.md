# 使用说明

当前为v0.2.0，M0–M7已通过验收，包含脚本与CEP面板。AI与ZXP随M8–M9实现，当前不可用。

## 安装与运行

先在项目根目录构建：

```powershell
npm ci
npm test
npm run build
npm run check:es3
```

需要Node20+和npm10；Illustrator运行构建后的JSX时不需要Node或依赖。六份脚本在`dist/scripts/`，可以直接从Illustrator“文件 › 脚本 › 其他脚本”选择运行。

若需要固定出现在菜单中，将六份JSX复制到以下目录并重启Illustrator：

- Windows：`C:\Program Files\Adobe\Adobe Illustrator 版本\Presets\zh_CN\脚本`。
- macOS：`/Applications/Adobe Illustrator 版本/Presets.localized/zh_CN/脚本`。

脚本装入菜单后，在动作面板中新建动作，使用面板菜单“插入菜单项”选择脚本，再为动作设置功能键。实际快捷键、撤销和吸附行为由宿主验收记录确认。

| 脚本 | 操作 |
| --- | --- |
| LogoGuides_Generate.jsx | 选中完整Logo，打开设置窗口并生成辅助线 |
| LogoGuides_Refresh.jsx | 微调后刷新全部带来源标签的对象，不弹设置窗口 |
| LogoGuides_Clear.jsx | 选择清除范围；取消不改变文档 |
| LogoGuides_SetBaseUnit.jsx | 用对象尺寸或两个选中锚点的距离设定并锁定a |
| LogoGuides_CircleFromSelection.jsx | 用至少3个选中锚点拟合圆，结果进入LG Manual |
| LogoGuides_DumpGeometry.jsx | 导出选区Geometry JSON用于复现和排错 |

P2可选的Measure脚本、比例关系报告尚未实现；不影响阶段1的P0/P1交付。

## 生成与微调

1. 选中Logo。支持路径、复合路径、编组和文字；文字只对临时副本转曲，原文字保留。剪切组的剪切路径不参与分析，其他不支持的对象会跳过并报告。
2. 运行Generate，选择自动a、候选a、上次锁定值或自定义正数pt。没有文档数据时默认自动；有锁定值时默认使用上次的值。建议保持“锁定a”。
3. 选择容差、显示精度、吸附步长、生成内容和输出样式。候选值在窗口打开时计算；修改容差不会刷新候选，选择自动时会按新容差重算。
4. 确认生成。辅助线在顶层Logo Guides中，原图层恢复为活动图层；默认锁定辅助层。可选背景放在独立的底层Logo Guides BG。
5. 调整原图形后运行Refresh。即使只选了一个锚点或部分路径，也会重新读取全部带当前runId来源标签的原始对象。锁定a保持数值和首次来源，倍率不会随微调漂移。

生成会重写LG_SOURCE标签并创建新runId；刷新沿用runId与来源标签，保留LG Manual。文档中的a未锁定时，刷新按照当前全局baseUnit重新计算并保持文档未锁定。来源标签丢失、辅助层改名或文档数据被删后，请重新运行Generate。

当前已实现：水平/竖直参考线与视觉对齐线、笔画/间距/可选高度与字怀、倍率/特殊比例与吸附偏差、圆拟合/环厚度/圆偏差、轴角/夹角/构造线/目标线、实际类别图例，以及默认关闭的可选安全区/背景。

吸附只计算目标与偏差并绘制目标线，不自动移动原图形。尺寸目标需打开尺寸吸附，角度目标需打开角度吸附；只有warn/bad的对应测量生成目标线，夹角和圆不画目标射线。

| 输出模式 | 结果 |
| --- | --- |
| styled（样式化） | 可编辑的描边图形 |
| guides（参考线） | 线、圆、圆弧设为Illustrator原生参考线；标签、方块与图例仍按样式绘制 |
| both（两者） | 同时输出样式版和参考线版 |

dark遵循原文深色底辅助线颜色，在白底上较浅。白色画板可选择light；背景板默认关闭，不会自动打开。

## 手动工具

CircleFromSelection：用直接选择工具选至少3个锚点，可跨路径。选中手柄不算选中锚点；相邻两端点都选中时才加入它们之间的曲线采样。输出圆、半径倍率（无文档a时显示pt）与“选中点最大偏差”，放在LG Manual。共线/重合点不足以拟合时会提示，原路径不会改动。刷新和“仅自动”清除保留手动结果；真实宿主行为待清单第7项确认。

SetBaseUnit：选一个对象，可选宽度、高度、较小值；若恰好有两个真正选中的锚点，则可选欧氏距离、水平距离、垂直距离。确认后文档a写为manual且锁定；已有来源标签时自动刷新一次。零值不可设为a，取消不写数据。

## 清除

| 选项 | 删除 | 保留 |
| --- | --- | --- |
| 仅自动辅助线 | 自动子层、背景层 | LG Manual、隐藏文档数据、来源标签 |
| 全部辅助线 | 自动子层、LG Manual、背景层 | 隐藏文档数据、来源标签 |
| 全部 + 文档数据 | 整个Logo Guides、背景层、所有LG_SOURCE标签 | 原图形、其他标签、全局settings.json |
| 取消 | 无 | 全部内容 |

前两种清除后仍可Refresh重建；第三种清除后需要重新Generate。异常会报告简短错误和行号，恢复仍存在图层的锁定状态及活动图层；已经绘制的部分辅助结果可用Clear移除。

## 全局设置与日志

所有文件位于Illustrator的`Folder.userData/LogoGuides/`。Windows通常是`%APPDATA%/LogoGuides/`；DumpGeometry成功弹窗显示本机实际路径。

| 文件 | 用途 |
| --- | --- |
| settings.json | UTF-8全局设置；每次生成窗口确认后保存，刷新读取当前值 |
| log.txt / log.previous.txt | 追加日志，超过1MB轮转；含runId、生成/刷新耗时、图元和警告数量 |
| geometry_dump.json | DumpGeometry或debug模式写出的原始Geometry JSON |
| analysis.json | debug=true时的真实分析结果 |

文档数据位于Logo Guides中隐藏路径__LG_DATA__的note，结构见主规范第6.4节。全局设置损坏时显示settings.json路径，修正JSON或移走该文件后重试；不会静默覆盖损坏文件。

窗口未显示的参数可编辑settings.json。未知键忽略，缺失键按默认值合并；字段和默认值以[DEV_PLAN第7节](DEV_PLAN.md#7-参数表唯一事实来源)为准。常用参数如下：

| 参数 | 默认 / 可选值 |
| --- | --- |
| mixedAsVisual | true；控制mixed水平线是否归为视觉线 |
| circleDisplay / circleExtendDeg | full / 30；可选extended、arc |
| circleLabels / maxCircles | false / 24 |
| maxAngles / maxConstructionLines | 12 / 40 |
| stemLabelStyle / labelDedup | lanes / false；可选squares |
| marginFactor / fontSize | 0.2 / 0；fontSize=0为自动 |
| angleLabelPrecision / signedAxisAngles | 1 / false；精度可选0.5、0.1 |
| legendLanguage / uiLanguage | both / zh；均可选en，图例也可选zh |
| features.background / clearSpaceFactor | false / 1；背景在窗口中不显示 |
| fontNames / cjkFontNames | 按顺序尝试的PostScript字体名数组，见第7.1节 |
| autoOutlineText / showSummary / debug | true / true / false |
| advanced | 第7.2/7.3节已定义数值覆盖，如maxLanes；不接受新参数 |

编辑设置后运行Refresh可应用。文档a已锁定时，全局baseUnit.value不会覆盖它；需SetBaseUnit更换锁定值，或重新Generate选择自动并取消锁定。刷新仅在有警告时弹摘要，生成摘要受showSummary控制。日志耗时包括读取、预分析、分析与绘制，排除用户停留在窗口中的时间。

## 开发预览与验证

```powershell
npm run fixture -- F1
npm run fixture -- tools/samples/illustrator-boatchin.geometry.json
npm run preview -- dist/previews/F1.geometry.json
npm run validate:geometry -- "导出的geometry_dump.json实际路径"
node tools/validate_milestone.js M6
```

fixture接受F1–F10（含F9b）或实际JSON/SVG，输出geometry.json、analysis.json与SVG。预览直接运行同一份core，原图形在lg-geometry，辅助图元在lg-guides；导入跳过辅助组，不会重复读取。SVG视口包含全部图元外界，不改变核心guideArea和裁剪规则。

SVG导入支持path、rect、circle、ellipse、polygon、polyline、line和transform；不展开文本、use、外部CSS、剪切或蒙版。无单位/px按1pt，显式物理单位换算；viewBox数值按pt使用，不按根width/height二次缩放，见D005。

当前Codex机器无全局npm，可使用已有入口，不修改全局配置：

```powershell
$pnpmPath = 'C:\Users\disen\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
& $pnpmPath dlx npm@10.9.4 test
& $pnpmPath dlx npm@10.9.4 run build
& $pnpmPath dlx npm@10.9.4 run check:es3
```

Chrome核对命令：

```powershell
$galleryUrl = ([Uri](Resolve-Path 'dist/validation/m6/gallery.html').Path).AbsoluteUri
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --headless --disable-gpu --no-first-run --hide-scrollbars --force-device-scale-factor=1 --window-size=1800,2500 --user-data-dir="$PWD/dist/chrome-profile" --screenshot="$PWD/dist/validation/m6/gallery.png" $galleryUrl
```

确认PNG已写入后再查看。复杂真实样本可能超过默认四条车道，输出LABEL_LANES_FULL且末车道允许重叠；可手动调整标签或编辑advanced.maxLanes。算法不会宣称所有任意Logo均无重叠。

## Git与后续阶段

Illustrator 30.0.0已完成RGB/CMYK原生DOM检查、中文设置窗口生成、单次撤销与用户拖动验收；Clear删除图层后的失效引用已修复。2000锚点真实生成实测约99.6秒，超过目标，当前脚本版不承诺15秒内完成，M7面板计算迁移时优化。用户确认原生参考线可吸附；本次Alt/直接选择拖动产生的副本无来源标签，需选择全部Logo重新生成才会纳入。详细证据见[M6验收页](acceptance/M6.md)。

仓库使用本地 `main`，已绑定私有 GitHub 仓库 `https://github.com/diseno1210/logo-guides-illustrator`；每个里程碑完成后提交并推送，`dist` 和 `node_modules` 不入 Git。其他 agent 可基于 GitHub `main` 的提交和 `docs/STATUS.md` 审查：

```powershell
git fetch origin
git checkout main
git pull --ff-only origin main
```

M6已完成第14.5节真实验收；M7已完成真实CEP和性能验收，交付v0.2。M8 AI、M9签名安装继续遵循原顺序。

## CEP面板

运行 `npm run build` 后，将 `dist/panel` 的内容复制到 `%APPDATA%/Adobe/CEP/extensions/local.logoguides.panel`。开发扩展需要按DEV_PLAN 11.5配置调试环境，此版本尚无签名安装包。重启Illustrator后，在“窗口 → 扩展 → Logo Guides”打开。

1. 选择Logo，点击“生成”。参数修改会在300ms后刷新现有来源；“刷新来源”依据来源标签读取，保留锁定a和手动层。
2. 候选按钮可设置a，也可输入数值或点击“读取选中宽高 / 候选”获得当前对象宽高、两个锚点的距离。常规刷新不重复扫描这些测量候选。
3. 特征勾选框控制显隐，刷新后按几何最近匹配保留；点击名称选中真实辅助对象。选中需要临时解锁对应辅助图层，下次面板操作或重新连接恢复锁定。隐藏项不能选中。
4. 可切换深浅样式、精选模式和按偏差排序视图；圆拟合滑杆覆盖当前预设，范围0.5%–6%。精选筛选现有结果，标签保持原布局。
5. “导出dump”写入用户目录 `LogoGuides/geometry_dump.json`；三种清除与脚本同义。切换Illustrator文档后点击“连接当前文档”，再刷新，避免旧参数的延时操作作用于错误文档。

本机Illustrator30/CEP12的2000锚点刷新实测约1.09秒；复杂Logo仍可能出现标签车道警告。面板截图及分段耗时见[M7验收](acceptance/M7.md)。P2自动轮询未启用。

[Notion工作日志](https://app.notion.com/p/3fce02e6228b816ea7abc73da5a388dd)在每个大阶段完成并推送GitHub后更新，包含提交、命令、实测结果和下一阶段前置条件。

## AI建议（M8开发版，待真实调用验收）

更新并重载CEP面板后，在“AI建议 → AI连接设置”选择OpenAI兼容接口或Anthropic。填写HTTPS baseUrl与模型名；OpenAI兼容baseUrl通常以`/v1`结尾，程序追加`/chat/completions`。Anthropic使用固定官方地址。密钥只在本机面板输入，点击“保存本机配置”。配置以明文保存在用户数据目录`LogoGuides/ai.json`，不写入Illustrator文档；不要分享该文件。模型没有默认值。

1. 先生成或刷新，再选择“展示”或“检查”；可展开“本次数值摘要”查看发送的数据。只发送a、S、行数、特征id/类别/倍率/角度等白名单数值，不发送来源图形或图像。
2. 点击“请求AI建议”，等待校验完成；每次请求最多60秒，JSON解析失败仅重试一次。失败或配置不可用时自动刷新为精选模式，状态栏显示原因。等待期间面板操作禁用。
3. 检查建议后点击“应用建议”。显示/隐藏保留未列出的状态；冲突时隐藏优先。未知id丢弃；尺寸目标相对实测倍率超过15%、角度偏差超过5°时丢弃。groups和notes只显示为文字。
4. 目标在同份core中计算标签、偏差和目标图元；仍尊重“生成内容”的类别及目标线开关。圆被指定目标时显示半径目标标签。建议只改变辅助图元，来源对象保持原样。
5. 来源、a、参数或文档已改变时，旧建议不能应用，需重新刷新及请求。生成/刷新、清除或切换文档会清除会话目标；AI隐藏状态沿用既有隐藏特征存储，刷新按几何匹配保留。目标和说明不写入Doc Data。

当前已完成模拟响应自动测试与真实CEP流程，真实服务调用待验收，不代表已发布v0.3。预览图上传、说明插入Labels及自动轮询未实现。
