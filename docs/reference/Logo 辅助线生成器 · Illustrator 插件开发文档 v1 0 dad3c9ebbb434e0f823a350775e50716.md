# Logo 辅助线生成器 · Illustrator 插件开发文档 v1.0

> 版本 v1.0 · 2026-10-16 · 读者：负责实现的开发 agent / 开发者
> 

## 0. 如何使用本文档

- 按第 15 节的里程碑顺序实施。每个里程碑通过验收后，再进入下一个。
- **唯一事实来源**：参数名和默认值以第 7 节为准，数据结构以第 6 节为准。其他章节引用参数时使用同名标识（反引号）。发现冲突时以第 6、7 节为准，并记录到 `docs/DECISIONS.md`。
- 优先级：**P0** = 本阶段必须完成；**P1** = 应该完成；**P2** = 可选或后续。
- 文档没有定义的行为：选择最简单、可预测的实现，并记录到 `docs/DECISIONS.md`。
- 开发环境通常无法运行 Illustrator。所以核心算法必须靠 Node 自动测试和 SVG 预览来验证；宿主层（调用 Illustrator DOM 的代码）要尽量薄，由用户按第 14.5 节清单手动验收。

## 1. 项目概述

### 1.1 目标

在 Adobe Illustrator 中，对用户选中的 logo 或字体设计（矢量路径）自动生成规范辅助线，包括：

- 基准线、视觉对齐线（视觉超出线）
- 拟合辅助圆（识别"接近某段局部曲率"的圆，允许误差）
- 角度、斜边延长线
- 笔画宽度、间距、高度的倍率标注（以基准单位 `a` 表示，例如 `0.96a`）

用户依据辅助线手动微调图形，然后刷新辅助线，直到符合规范。参考效果是用户提供的四张图：JXL 字标、CONSTRUCTION GROUP 字标、塔楼波浪图形、黄金分割 V 形图形。

### 1.2 核心工作流

1. 选中 logo，运行"生成辅助线"。
2. 确定基准单位 `a`：自动推荐、从候选列表选，或手动输入。
3. 插件把辅助线生成到独立图层，不修改原图形。
4. 用户根据辅助线、偏差提示和目标线微调图形。
5. 运行"刷新"（`a` 保持锁定），查看偏差是否消失。重复第 4、5 步。
6. 定稿后选择展示样式（深色或浅色），用于品牌规范展示。

### 1.3 设计原则

- **计算靠算法，取舍靠规则、人或 AI**：所有几何量由确定性算法计算；"显示哪些线"在阶段 1、2 由规则评分决定，阶段 3 可交给 AI。
- **允许误差**：所有识别都基于容差，同时输出偏差，用来指导微调。
- **永不修改用户图形**：v1 不做自动吸附或改形。唯一的写入是给来源对象添加不可见的标签（用于刷新，见 10.5）。
- **核心库与宿主解耦**：核心库是纯函数，可在 ExtendScript、CEP 面板、Node 以及将来的 UXP 中运行。
- **可复现**：任何问题都能通过"几何数据导出（dump）"在 Node 中复现。

### 1.4 范围

做：

- 水平、竖直参考线识别与分类（基准线 / 视觉对齐线）
- 直线笔画宽度、部件间距、高度测量与倍率标注
- 局部曲率拟合圆、同心环厚度、偏差标记
- 斜边角度、夹角、构造线
- 规范吸附目标、偏差显示、目标线
- 图层化输出、刷新、清除、手动拟合圆
- 阶段 2 的 CEP 面板，阶段 3 的 AI 筛选与建议

不做（v1）：

- 自动修改图形
- 椭圆、螺旋、样条拟合（只拟合圆和直线）
- 正负空间分析（参考图 3 的 Positive / Negative Space 图例）
- 字形语义识别（插件不知道"这是字母 R"）
- 位图输入、3D、透视

### 1.5 对参考图的预期

| 参考图 | 自动完成 | 需要人工 |
| --- | --- | --- |
| JXL 字标 | 基准线、视觉超出线、竖线、笔画倍率、斜边角度、构造线、拟合圆 | 决定保留哪些线、微调标签 |
| CONSTRUCTION GROUP | 两行基准线、笔画和间距倍率、O/C/S 拟合圆、红色视觉圆 | 少量 |
| 塔楼波浪图形 | 各弧段拟合圆、切口角度 | 大量筛选（候选圆很多） |
| 黄金分割 V 形 | 斜带宽度方块、夹角、安全区 `a` 方块（P2） | 1:1.618 比例条需手动（或后续版本） |

## 2. 术语与符号

| 术语 | 定义 |
| --- | --- |
| 部件（part） | 一个独立图形单元：一个 CompoundPathItem 或一个独立 PathItem。编组会被展开 |
| 轮廓（contour） | 部件中的一条子路径，可闭合或开放 |
| 行（row） | 垂直方向互相重叠的部件集合。多行字标有多行 |
| 小部件 | 高度明显小于其他部件的部件（如 i 的点），见 `smallPartRel` |
| `S` | 尺度基准，等于各行高度的最大值（不含小部件）。所有相对参数乘以 `S` 换算为 pt |
| `D` | 选区包围盒的对角线长度 |
| `a` | 基准单位（pt）。所有倍率 = 测量值 ÷ `a` |
| `tolPos` | 位置聚类容差 = `clusterTolRel` × `S` |
| 平直证据（flat） | 来自水平或竖直直线边的位置证据 |
| 曲线证据（round） | 来自曲线极值点（切线水平或竖直处）的位置证据 |
| 基准线 Baseline | 灰色虚线，结构性的水平或竖直参考线 |
| 视觉对齐线 Visual Alignment Line | 红色实线（浅色样式为棕色）：视觉超出线（overshoot），或曲线与直线对齐的线 |
| 构造线 | 斜边的延长线（细实线） |
| 目标线 | 开启吸附后，表示"边应该移到哪里"的线 |
| 偏差 | 实测值与目标值之差 |

## 3. 总体架构

```
┌──────────────────── UI 层 ────────────────────┐
│ 阶段1：ScriptUI 对话框 + 多个独立 .jsx 脚本        │
│ 阶段2：CEP 面板（HTML/JS）                        │
└──────────────────────┬────────────────────────┘
                       │ Settings JSON
┌──────────────────────▼────────────────────────┐
│ 核心库 core（纯函数，ES3 兼容，无宿主依赖）          │
│ normalize → sample → features → a → labels      │
│ → layout → primitives                            │
└────────▲─────────────────────────┬────────────┘
   Geometry JSON              Render JSON（图元）
┌────────┴─────────────────────────▼────────────┐
│ 宿主层 host（ExtendScript）：读选区/绘制/图层/存储 │
└───────────────────────────────────────────────┘
工具层 tools（Node）：构建、ES3 检查、测试、SVG 导入、SVG 预览
```

运行形态：

- **阶段 1（脚本版）**：核心库和宿主层打包成若干独立 .jsx，全部计算在 ExtendScript 中进行。
- **阶段 2（CEP 面板）**：计算移到面板（Chromium 的 V8 引擎，快得多），ExtendScript 只负责读取和绘制。核心库是同一份代码。
- **阶段 3（AI）**：面板调用大模型，对分析结果做筛选和规范化建议，不参与几何计算。

### 3.1 处理流水线（core/21_pipeline.js）

`analyze(geometry, settings)` 依次执行：

1. normalize：Geometry JSON → 内部部件、轮廓、段（8.1）
2. sample：按弧长采样，计算切线和曲率（8.2）
3. rows：部件包围盒、小部件、行、`S`、`D`（8.4）
4. edges：直线边、极值点（8.5）
5. lines：水平/竖直参考线聚类与分类（8.6）
6. stems：笔画、间距、高度、字怀（8.7）
7. circles：圆拟合、合并、同心环、分类、评分（8.8）
8. angles：方向簇、轴角、夹角、构造线（8.9）
9. baseunit：确定 `a`（8.10）
10. ratios：所有测量的倍率、吸附目标、偏差、标签文字（8.11）
11. layout：字号、线宽、车道、标签位置、辅助区域、线跨度（第 9 节）
12. primitives：生成图元列表，包括目标线、偏差标记、图例、安全区、背景（8.12、第 9 节）

`preAnalyze(geometry, settings)` 只执行第 1 到 6 步，返回 `a` 的候选列表，供对话框使用。`analyze` 可以接收 `preAnalyze` 返回的上下文对象：仅当两次解析后的 7.2、7.3 参数完全相同时，复用第 1–4 步的结果（第 5、6 步总是重算）；否则忽略上下文，从头计算。

第 7 步只在 `features.circles` 或 `features.ringThickness` 开启，或者 `a` 为自动模式且没有检测到笔画（需要用环厚度兜底）时执行。

## 4. 技术选型

- **宿主**：Illustrator 2021（25.0）及以上，Windows 和 macOS（含 Apple Silicon）。
- **阶段 1**：ExtendScript（ES3）脚本。
- **阶段 2**：CEP 11+ 面板 + ExtendScript 宿主脚本。
- **关于 UXP**：Adobe 在 2026 年 9 月公布的时间表中，Illustrator 的 UXP 插件预计 2027 年春季公测，并会用多年时间分阶段从 CEP 过渡。当前 Illustrator 第三方面板仍只能用 CEP（C++ SDK 插件开发和维护成本过高，不采用）。因此本项目选 CEP，同时让核心库与宿主解耦，将来迁移 UXP 时只需重写宿主层和 UI。
- **工具链**：Node 20+。devDependencies 只用：`acorn`（ES3 语法检查）、`svgpath`（SVG 路径规范化）、`@xmldom/xmldom`（SVG 解析）。核心库和宿主层没有运行时依赖（JSON 用内置的 json2）。
- **为什么核心库写 ES3 而不是 TypeScript**：同一份源码不经转译就能在 ExtendScript、Node、CEP 中运行，避免转译带来的差异。代价是语法受限（见第 16 节）。

## 5. 目录结构与构建

```
logo-guides/
├─ package.json
├─ docs/  DEV_PLAN.md  DECISIONS.md  CHANGELOG.md  USER_GUIDE.md
├─ src/
│  ├─ core/                 # ES3 纯函数，按文件名顺序拼接
│  │  ├─ 00_ns.js           # var LG = LG || {};
│  │  ├─ 01_json2.js        # json2.js（公有领域），改为挂到 LG.json，不创建全局 JSON
│  │  ├─ 02_util.js         # each/mapArr/filterArr/indexOf/clamp/hypot/deepMerge 等
│  │  ├─ 03_config.js       # 默认设置、容差预设、常量、resolve(settings)
│  │  ├─ 04_vec.js
│  │  ├─ 05_bezier.js       # 求值、导数、曲率、极值、直线判定、弧长表
│  │  ├─ 06_geometry.js     # normalize
│  │  ├─ 07_sample.js
│  │  ├─ 08_ink.js          # 点是否在墨迹内
│  │  ├─ 09_cluster.js      # 一维聚类、环形聚类
│  │  ├─ 10_rows.js
│  │  ├─ 11_edges.js
│  │  ├─ 12_lines.js        # 参考线 + 线注册表
│  │  ├─ 13_stems.js
│  │  ├─ 14_circles.js
│  │  ├─ 15_angles.js
│  │  ├─ 16_baseunit.js
│  │  ├─ 17_ratios.js
│  │  ├─ 18_layout.js
│  │  ├─ 19_styles.js       # 样式预设（纯数据）
│  │  ├─ 20_primitives.js
│  │  └─ 21_pipeline.js
│  ├─ host/                 # ExtendScript，依赖 Illustrator DOM
│  │  ├─ h01_env.js         # 文档检查、颜色、日志
│  │  ├─ h02_read.js        # 选区 → Geometry JSON
│  │  ├─ h03_store.js       # 全局设置文件、文档数据、来源标签
│  │  ├─ h04_draw.js        # 图元 → Illustrator 对象
│  │  ├─ h05_i18n.js        # 界面文案（中/英）
│  │  └─ h06_dialog.js      # ScriptUI 对话框
│  ├─ scripts/              # 阶段 1 入口，每个文件一个功能（见 11.1）
│  └─ panel/                # 阶段 2 CEP 面板
├─ tools/
│  ├─ build.js  check_es3.js  svg_import.js  preview.js  run_fixture.js
│  ├─ samples/              # 用户提供的真实 logo（SVG 或 dump JSON）
│  └─ test/  fixtures.js  *.test.js
└─ dist/
```

npm 脚本：`npm run build`、`npm test`、`npm run preview -- <输入文件>`。

**构建（tools/build.js，P0）**：

1. 按文件名顺序拼接 core → host → 入口脚本，外层包一个 IIFE，文件头写 `#target illustrator`。
2. 把所有非 ASCII 字符转为 `\uXXXX`。ExtendScript 读取不带 BOM 的 UTF-8 文件时，中文可能乱码。
3. 输出 `dist/scripts/LogoGuides_*.jsx`。阶段 2 另外输出 `dist/panel/js/core.js`（只含 core）和 `dist/panel/host/host.jsx`（完整 core + host + 宿主暴露函数，便于必要时回退到宿主计算）。
4. 对每个产物运行 ES3 检查（16.2），失败则构建失败。

## 6. 数据契约

### 6.1 坐标约定

- 单位 pt。y 轴向上，与 Illustrator 脚本坐标一致。
- Illustrator 的 `geometricBounds` 顺序是 [left, top, right, bottom]，且 top 大于 bottom。所有矩形字段都沿用这个顺序。
- 接口中的角度用度，逆时针为正，0° 指向 +x。无向直线的方向角取值范围 [0°, 180°)。内部可以用弧度。
- 文字旋转：Illustrator 的 `rotate(θ)` 正值为逆时针。竖排标注使用 -90（顺时针 90°，从上往下读）。

### 6.2 Geometry JSON（宿主 → 核心）

```json
{
  "version": 1,
  "units": "pt",
  "colorSpace": "RGB",
  "artboard": [0, 0, 800, -600],
  "parts": [
    {
      "id": "p0",
      "sourceIndex": 0,
      "kind": "compound",
      "filled": true,
      "stroked": false,
      "strokeWidth": 0,
      "contours": [
        {
          "id": "p0c0",
          "closed": true,
          "points": [
            { "a": [100, -200], "l": [100, -200], "r": [130, -200] }
          ]
        }
      ]
    }
  ],
  "warnings": []
}
```

- `points` 按路径顺序排列。`a` = anchor，`l` = leftDirection（进入手柄），`r` = rightDirection（离开手柄）。
- 第 i 段（Pi → Pi+1）的三次贝塞尔控制点依次为 Pi.a、Pi.r、Pi+1.l、Pi+1.a。闭合路径还包括最后一点 → 第一点这一段。
- `kind`："path"、"compound" 或 "textOutline"（来自文字的临时轮廓）。
- `sourceIndex`：所属顶层选区对象的序号，用于写回来源标签。
- `artboard`：选区中心所在画板的矩形；没有画板包含选区中心时，用当前画板。
- `colorSpace`："RGB" 或 "CMYK"，仅供参考，核心库不使用。

### 6.3 Settings JSON

完整字段见 7.1。读取时与默认值深合并：缺失的键用默认值，未知的键忽略。`advanced` 中的键覆盖 7.2、7.3 的同名参数。

### 6.4 文档数据（Doc Data）

存放在辅助图层里一个名为 `__LG_DATA__` 的隐藏路径对象的 `note` 属性中（JSON 字符串）：

```json
{
  "schemaVersion": 1,
  "runId": "lg_mf3k2a_x7",
  "baseUnit": { "value": 12.4, "source": "auto-stem", "locked": true },
  "hiddenFeatures": [],
  "createdAt": "2026-10-16T08:45:00",
  "updatedAt": "2026-10-16T09:10:00"
}
```

- `hiddenFeatures`：阶段 2 使用（用户隐藏的特征），每项为 `{ "id": "C3", "type": "circle", "key": {...} }`，key 保存用于刷新后匹配的参数（见 11.4）。阶段 1 写空数组。

### 6.5 分析结果（core 输出之一）

```json
{
  "version": 1,
  "S": 180,
  "D": 920,
  "bbox": [0, 0, 0, 0],
  "rows": [{ "id": "r0", "bbox": [0, 0, 0, 0], "partIds": ["p0", "p1"], "height": 180 }],
  "baseUnit": {
    "value": 12.4,
    "source": "auto-stem",
    "candidates": [{ "value": 12.4, "count": 7, "totalLength": 980, "kind": "vertical" }]
  },
  "lines": [{ "id": "L1", "orient": "h", "pos": 0, "category": "baseline", "subtype": "flat",
              "support": { "flatLen": 0, "roundCount": 0, "partIds": [], "contourIds": [] }, "span": [0, 0] }],
  "stems": [{ "id": "S1", "partId": "p0", "kind": "vertical", "width": 12.4, "angleDeg": 90,
              "edgeA": [[0, 0], [0, 0]], "edgeB": [[0, 0], [0, 0]], "overlapLen": 0, "mid": [0, 0], "measure": {} }],
  "gaps": [{ "id": "G1", "rowId": "r0", "leftPartId": "p0", "rightPartId": "p1", "x1": 0, "x2": 0, "width": 0, "measure": {} }],
  "heights": [],
  "counters": [],
  "circles": [{ "id": "C1", "cx": 0, "cy": 0, "r": 0, "maxErr": 0, "rmsErr": 0, "tolAbs": 0,
                "coverageDeg": 0, "arcStartDeg": 0, "arcEndDeg": 0,
                "maxErrPoint": [0, 0], "maxErrSigned": 0, "partIds": [], "contourIds": [],
                "category": "fitted", "score": 0, "measureR": {} }],
  "rings": [{ "id": "R1", "outerId": "C1", "innerId": "C2", "thickness": 0, "angleDeg": 45, "measure": {} }],
  "angles": [{ "id": "A1", "kind": "axis", "center": [0, 0], "ray1Deg": 90, "ray2Deg": 112.1, "measure": {} }],
  "constructionLines": [{ "id": "K1", "p0": [0, 0], "p1": [0, 0], "edgeCount": 2 }],
  "ratioFindings": [],
  "warnings": []
}
```

所有尺寸和角度测量都用统一的 `measure` 结构：

```json
{
  "value": 11.9,
  "ratio": 0.9597,
  "display": "0.96a",
  "target": 0.95,
  "targetDisplay": "0.95a",
  "special": null,
  "dev": 0.0102,
  "devAbs": 0.12,
  "severity": "warn"
}
```

- 尺寸类：`value` 单位 pt；`ratio` = value ÷ a；`dev` = (ratio − target) ÷ target；`devAbs` = value − target × a（pt，正数表示偏大）。
- 角度类：`value` 单位度；`ratio`、`special` 为 null；`target` 为目标角度；`dev` = value − target（度）；`devAbs` 等于 `dev`。
- 未开启吸附时，`target`、`targetDisplay`、`dev`、`devAbs` 为 null，`severity` 为 "none"。
- `severity` 取值："none"、"ok"、"warn"、"bad"。
- 圆的 `measureR` 是半径的测量（用于可选的 "R 1.15a" 标注）。
- `heights` 每项为 `{ id, rowId, y1, y2, measure }`；`counters` 每项结构同 `stems`（kind 为 "counter"）；`ratioFindings` 每项为 `{ lhs, rhs, ratio, special }`（lhs、rhs 是被比较量的描述，如 "row0.height"）。
- `warnings`（6.2 与此处相同）：每项为 `{ "code": "SAMPLES_CAPPED", "message": "..." }`。message 是英文默认文案；宿主按 code 本地化（h05_i18n），未知 code 直接显示 message。

### 6.6 渲染结果与图元（core 输出之二）

`analyze` 返回 `{ analysis, render }`。`render` 结构：

```json
{
  "fontSize": 12,
  "strokeUnit": 0.45,
  "guideArea": [0, 0, 0, 0],
  "primitives": []
}
```

图元类型：

```json
{ "type": "line", "p0": [0, 0], "p1": [0, 0], "style": "baseline", "layer": "baselines", "featureId": "L1" }
{ "type": "circle", "c": [0, 0], "r": 10, "style": "circleFitted", "layer": "circles", "featureId": "C1" }
{ "type": "arc", "c": [0, 0], "r": 10, "startDeg": 0, "endDeg": 90, "style": "angleArc", "layer": "angles", "featureId": "A1" }
{ "type": "polygon", "points": [[0, 0], [1, 0], [1, 1]], "closed": true, "style": "moduleSquare", "layer": "dimensions", "featureId": "S3" }
{ "type": "label", "pos": [0, 0], "rotation": 0,
  "lines": [{ "text": "0.95a", "sizeFactor": 1, "style": "text" },
            { "text": "实测 0.958a · +0.12pt", "sizeFactor": 0.75, "style": "textWarn" }],
  "layer": "labels", "featureId": "S3" }
```

- `arc`：从 `startDeg` 逆时针画到 `endDeg`；`endDeg` 可以大于 360，表示跨过 0°。
- `label.pos`：标签整体（所有行）包围盒的中心。`rotation` 单位度，逆时针为正；车道标签只用 0 或 -90，模块方块内的标签可以是任意角度。行从上到下排列，每行字号 = `fontSize` × `sizeFactor`。
- `style` 的取值见附录 B；`layer` 的取值见 10.1。
- `featureId`：对应分析结果中的特征 id；图例、背景等非特征图元用 "legend"、"background"、"clearSpace"。

## 7. 参数表（唯一事实来源）

### 7.1 用户设置（Settings）

| 键 | 取值 | 默认 | 说明 | 优先级 |
| --- | --- | --- | --- | --- |
| `baseUnit.mode` | "auto" / "value" | "auto" | `a` 的来源 | P0 |
| `baseUnit.value` | 数字（pt）或 null | null | mode 为 "value" 时使用 | P0 |
| `baseUnit.locked` | 布尔 | true | 生成后锁定 `a` 的数值，刷新时不重算 | P0 |
| `tolerancePreset` | "loose" / "standard" / "strict" | "standard" | 容差预设，见 7.2 | P0 |
| `labelPrecision` | 0.01 / 0.05 / 0.1 | 0.01 | 倍率显示精度 | P0 |
| `snapMode` | "off" / "step" | "off" | 是否计算规范目标和偏差 | P0 |
| `snapStep` | 0.05 / 0.1 / 0.25 / 0.5 | 0.05 | 吸附步长（单位 a） | P0 |
| `detectSpecialRatios` | 布尔 | true | 吸附时识别 φ、√2 等特殊比例 | P1 |
| `angleLabelPrecision` | 1 / 0.5 / 0.1 | 1 | 角度显示精度（°） | P1 |
| `angleSnapStep` | 0 / 1 / 5 / 15 | 0 | 角度吸附步长，0 表示不吸附 | P1 |
| `signedAxisAngles` | 布尔 | false | 轴角带正负号 | P2 |
| `mixedAsVisual` | 布尔 | true | 曲线与直线对齐的线标为视觉对齐线（红） | P0 |
| `features.baselines` | 布尔 | true | 水平基准线 | P0 |
| `features.overshoot` | 布尔 | true | 视觉超出线 | P0 |
| `features.verticals` | 布尔 | true | 全局竖向参考线 | P0 |
| `features.stemWidths` | 布尔 | true | 笔画宽度 | P0 |
| `features.gaps` | 布尔 | true | 部件间距 | P0 |
| `features.heights` | 布尔 | false | 水平线之间的高度 | P2 |
| `features.counters` | 布尔 | false | 字怀宽度 | P2 |
| `features.circles` | 布尔 | true | 辅助圆 | P0 |
| `features.ringThickness` | 布尔 | true | 同心环厚度 | P1 |
| `features.angles` | 布尔 | true | 角度 | P1 |
| `features.constructionLines` | 布尔 | true | 斜边延长线 | P1 |
| `features.targetLines` | 布尔 | true | 目标线（需开启吸附） | P1 |
| `features.deviationMarkers` | 布尔 | true | 圆的偏差标记 | P1 |
| `features.clearSpace` | 布尔 | false | 安全区 | P2 |
| `features.legend` | 布尔 | true | 图例 | P1 |
| `features.background` | 布尔 | false | 背景板 | P2 |
| `circleDisplay` | "full" / "extended" / "arc" | "full" | 圆的显示方式 | P1 |
| `circleExtendDeg` | 数字 | 30 | extended 模式下覆盖弧两端各延长的角度 | P1 |
| `circleLabels` | 布尔 | false | 圆旁标注 "R 1.15a" | P2 |
| `maxCircles` | 整数 | 24 | 圆的数量上限 | P1 |
| `maxAngles` | 整数 | 12 | 角度标注数量上限 | P1 |
| `maxConstructionLines` | 整数 | 40 | 构造线数量上限 | P1 |
| `stemLabelStyle` | "lanes" / "squares" | "lanes" | 竖/横笔画的标注方式，见 9.3 | P1 |
| `labelDedup` | 布尔 | false | 同一行内相同显示值只标一次 | P2 |
| `output` | "styled" / "guides" / "both" | "styled" | 输出样式化图形、Illustrator 参考线，或两者 | P1 |
| `lockLayer` | 布尔 | true | 生成后锁定辅助图层 | P0 |
| `stylePreset` | "dark" / "light" | "dark" | 样式预设，见附录 B | P1 |
| `extendTo` | "margin" / "artboard" | "margin" | 参考线延伸范围 | P1 |
| `marginFactor` | 数字 | 0.2 | 辅助区域外扩量（单位 D） | P1 |
| `clearSpaceFactor` | 数字 | 1 | 安全区宽度（单位 a） | P2 |
| `legendLanguage` | "zh" / "en" / "both" | "both" | 图例语言 | P1 |
| `uiLanguage` | "zh" / "en" | "zh" | 界面与偏差文字语言 | P1 |
| `fontSize` | 数字 | 0 | 标注字号（pt），0 表示自动 | P1 |
| `fontNames` | 字符串数组 | ["Roboto-Regular", "ArialMT", "Helvetica", "MyriadPro-Regular"] | 拉丁字体候选（PostScript 名） | P1 |
| `cjkFontNames` | 字符串数组 | ["SourceHanSansSC-Regular", "AdobeHeitiStd-Regular", "PingFangSC-Regular", "MicrosoftYaHei"] | 含中文文字使用的字体候选 | P1 |
| `autoOutlineText` | 布尔 | true | 自动对文字做临时轮廓化后分析 | P1 |
| `showSummary` | 布尔 | true | 生成后弹出摘要 | P1 |
| `debug` | 布尔 | false | 写入几何与分析 dump | P0 |
| `advanced` | 对象 | {} | 覆盖 7.2、7.3 中的任意参数 | P1 |

### 7.2 容差预设

| 参数 | 含义 | loose（宽松） | standard（标准） | strict（严格） |
| --- | --- | --- | --- | --- |
| `circleFitTol` | 圆拟合最大偏差 ÷ 半径 | 0.04 | 0.02 | 0.01 |
| `circleAbsCapRel` | 圆拟合最大偏差的绝对上限（单位 S） | 0.02 | 0.01 | 0.005 |
| `circleMergeTol` | 圆合并：圆心距、半径差 ÷ 半径 | 0.04 | 0.02 | 0.01 |
| `clusterTolRel` | 位置聚类容差（单位 S） | 0.008 | 0.004 | 0.002 |
| `widthClusterTol` | 宽度聚类相对容差 | 0.05 | 0.03 | 0.015 |
| `parallelAngleTol` | 平行判定（°） | 1.5 | 0.5 | 0.25 |
| `axisAngleTol` | 水平/竖直判定（°） | 2 | 1 | 0.5 |
| `lineStraightTol` | 曲线段视为直线：控制点到弦的距离（单位 S） | 0.004 | 0.002 | 0.001 |

### 7.3 常量（可在 `advanced` 中覆盖）

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `circleMinArcDeg` | 20 | 拟合区域最小转角（°） |
| `circleMinSamples` | 6 | 拟合区域最少采样数 |
| `circleMaxRadiusFactor` | 3 | 最大半径（单位 D） |
| `minEdgeLenRel` | 0.05 | 有效直线边最短长度（单位 S） |
| `minDiagLenRel` | 0.1 | 参与角度和构造线的斜边最短长度（单位 S） |
| `minStemWidthRel` | 0.01 | 笔画最小宽度（单位 S） |
| `maxStemWidthRel` | 0.8 | 笔画最大宽度（单位 S） |
| `stemOverlapMin` | 0.3 | 笔画两边投影重叠的最小比例 |
| `sampleSpacingRel` | 0.005 | 采样间距（单位 S，下限 0.05pt） |
| `maxSamples` | 20000 | 采样总数上限 |
| `overshootMaxRel` | 0.03 | 视觉超出的最大距离（单位行高） |
| `smallPartRel` | 0.3 | 小部件阈值（单位部件高度中位数） |
| `rowOverlapMin` | 0.5 | 同行判定：垂直重叠 ÷ 较小高度 |
| `gapOverlapMin` | 0.3 | 间距判定：垂直重叠 ÷ 较小高度 |
| `cornerAngleDeg` | 15 | 段连接处切线跳变超过此值视为尖角 |
| `silhouetteEpsRel` | 0.01 | 外缘判定的探测距离（单位 S） |
| `lineKeepFlatRel` | 0.3 | 参考线保留条件：平直证据总长（单位 S） |
| `pairAngleMinDeg` | 10 | 夹角的最小方向差（°） |
| `pairIntersectExpand` | 0.1 | 夹角交点允许超出部件包围盒的比例 |
| `specialRatioTol` | 0.01 | 特殊比例识别的相对容差 |
| `devOk` | 0.005 | 偏差 ≤ 此值为 ok（相对） |
| `devWarn` | 0.02 | 偏差 ≤ 此值为 warn，超过为 bad（相对） |
| `angleDevOk` | 0.1 | 角度偏差 ok 阈值（°） |
| `angleDevWarn` | 0.5 | 角度偏差 warn 阈值（°） |
| `maxLanes` | 4 | 每侧标注车道数上限 |
| `fontSizeRel` | 0.07 | 自动字号（单位 S），限制在 6–36pt |
| `strokeUnitRel` | 0.0025 | 线宽单位 u（单位 S），限制在 0.25–2pt |
| `arcRadiusRel` | 0.15 | 角度圆弧半径（单位 S） |
| `curatedMaxLines` | 20 | 阶段 2 精选模式：线数量上限 |
| `curatedMaxCircles` | 12 | 阶段 2 精选模式：圆数量上限 |
| `curatedMaxAngles` | 6 | 阶段 2 精选模式：角度数量上限 |

### 7.4 派生量

```
S        = 各行高度最大值（不含小部件）
D        = 选区包围盒对角线
tolPos   = clusterTolRel × S
minEdgeLen = minEdgeLenRel × S
minDiagLen = minDiagLenRel × S
h        = max(0.05, sampleSpacingRel × S)        采样间距
κmin     = 1 / (circleMaxRadiusFactor × D)        小于此曲率视为近似直线
fs       = fontSize > 0 ? fontSize : clamp(fontSizeRel × S, 6, 36)
u        = clamp(strokeUnitRel × S, 0.25, 2)
ra       = arcRadiusRel × S                        角度圆弧半径
ε        = silhouetteEpsRel × S                    外缘判定探测距离
```

## 8. 算法详细设计

### 8.1 读取与归一化（host/h02_read + core/06_geometry）

宿主读取：

- 遍历 `doc.selection`，跳过位于 "Logo Guides" 和 "Logo Guides BG" 图层（含子图层）中的对象。
- 用直接选择工具选中复合路径的子路径时，selection 中会出现 parent 为 CompoundPathItem 的 PathItem：改用其 parent，并按对象去重。
- 递归展开：
    - GroupItem：跳过 hidden 子项；`clipped` 为真的编组跳过 `clipping` 为真的蒙版路径。
    - CompoundPathItem：作为一个部件，其 `pathItems` 是轮廓。
    - PathItem：作为一个部件。
    - TextFrame：`autoOutlineText` 为真时，执行 `duplicate()` → `createOutline()`，读取后删除副本（必须放在 try/finally 中）；否则跳过并警告。
- 不支持的类型（PlacedItem、RasterItem、SymbolItem、MeshItem、PluginItem、GraphItem、LegacyTextItem、NonNativeItem）跳过，按类型计数写入警告。
- 少于 2 个锚点或长度为 0 的路径跳过。
- 读取时缓存 `pathPoints` 集合和长度，避免在循环中重复访问 DOM。
- 选区处于文字编辑状态（selection 是 TextRange）时，提示用户先退出文字编辑。

核心归一化：

- 段类型：两个手柄都与锚点重合（距离 ≤ 1e-6）→ line；否则为 cubic。cubic 若满足直线判定，也转为 line。
- 直线判定：P1、P2 到弦 P0P3 的距离都 ≤ `lineStraightTol` × S，且 P1、P2 在弦上的投影参数都在 [−0.01, 1.01] 之内（防止回折）。弦长 ≤ 1e-6 的段丢弃。
- 计算每个部件的精确包围盒（锚点 + 段内极值点）。
- `filled` 为假且 `stroked` 为真的部件（纯描边），或含开放轮廓的部件：参与直线边和圆的检测，但不参与墨迹测试和笔画宽度。写入警告"建议先轮廓化描边"。

### 8.2 采样（core/07_sample）

- 每个 cubic 段：用 64 等分 t 建立弧长表，得到段长 L。采样数 n = clamp(ceil(L ÷ h), 4, 200)。第 j 个采样的目标弧长 = (j + 0.5) ÷ n × L，用弧长表线性插值反求 t。这样采样点不会落在 t = 0 或 1 的奇异位置。
- 每个采样记录：位置 p、单位切线 T、有符号曲率 κ、所属部件/轮廓/段、累计弧长。B′ 长度过小时，切线用 B″ 方向或弦方向代替。
- line 段不采样。
- 每条闭合轮廓的墨迹多边形 = 按路径顺序排列的锚点和 cubic 采样点。
- 采样总数超过 `maxSamples` 时，按比例放大 h 后重新采样，并写入警告。
- 公式见附录 A。

### 8.3 墨迹测试（core/08_ink）

- `inkAt(x, y, partId)`：在指定部件的闭合轮廓多边形上用 even-odd 射线法测试；省略 partId 时测试全部部件，任一部件为真即为真。先用部件和轮廓的包围盒过滤。
- 墨迹 = 任一填充部件的内部。纯描边部件不算墨迹。

### 8.4 行、S、D（core/10_rows）

- 小部件：高度 ＜ `smallPartRel` × 全部部件高度中位数，标记为 small（如 i 的点）。
- 行聚类：非小部件两两比较，垂直重叠 ≥ `rowOverlapMin` × 较小高度，归为同一行（并查集）。行按顶边从高到低排序，id 依次为 r0、r1……
- 小部件归入与其水平重叠、且垂直距离最近的行；没有水平重叠的行时，归入中心距离最近的行。小部件不参与行高和间距计算。
- 行包围盒 = 该行非小部件包围盒的并集；行高 = 行包围盒高度。
- `S` = 各行高度的最大值；`D` = 全部部件包围盒的对角线。

### 8.5 直线边与极值点（core/11_edges）

- 直线边：所有 line 段（含转为直线的 cubic）。同一轮廓内首尾相连、方向差 ≤ `parallelAngleTol` 的相邻边合并为一条。
- 长度 ＜ minEdgeLen 的边标记为 short，不参与笔画、参考线证据和角度。
- 方向分类：与水平夹角 ≤ `axisAngleTol` → "h"；与竖直夹角 ≤ `axisAngleTol` → "v"；其余为 "d"（斜边）。
- 极值点：在每个 cubic 段内解 x′(t) = 0（左右极值）和 y′(t) = 0（上下极值），t ∈ (0, 1)。另外检查每个 cubic 段端点处的切线是否水平或竖直（偏差 ≤ `axisAngleTol`），因为设计师常把锚点放在极值处。距离 ≤ tolPos ÷ 2 的重复极值只保留一个。要求该处 |κ| ≥ κmin（端点处的曲率取最近采样点的 κ）。
- 极值类型：上下极值分为 top / bottom，左右极值分为 left / right。
- 外缘判定（silhouette）：对 top 极值，若 `inkAt(x, y + ε)` 为假且 `inkAt(x, y − ε)` 为真，则为外缘；bottom、left、right 同理（方向相应改变）。

### 8.6 水平、竖直参考线（core/12_lines）

水平线按行分别聚类 y 值；竖线对全部部件聚类 x 值。

**证据**

- 平直证据：方向为 "h" 且非 short 的边，取边中点的 y，权重 = 边长。竖线用 "v" 边的 x。
- 曲线证据：外缘的 top / bottom 极值取 y，left / right 极值取 x。权重为 0，只计数。

**聚类**：一维聚类（8.13），容差 tolPos。

**簇的位置**：有平直证据时取平直证据的加权平均，否则取曲线证据的平均。

**保留条件**（满足任一即可）：平直证据总长 ≥ `lineKeepFlatRel` × S；涉及 ≥ 2 个部件；（水平线）是该行最上或最下的簇；（竖线）是选区最左或最右的簇。

**水平线分类**

1. 只有平直证据 → category "baseline"，subtype "flat"。
2. 平直 + 曲线证据，且存在来自与平直证据不同轮廓的曲线证据 → `mixedAsVisual` 为真时为 "visual" / "mixed"，否则为 "baseline" / "mixed"。曲线证据与平直证据来自同一轮廓（例如 D 的顶边与弧顶相切延续）时，视为只有平直证据。
3. 只有曲线证据：找同一行中最近的平直簇 F，距离 δ。若 tolPos ＜ δ ≤ `overshootMaxRel` × 行高，且方向向外（top 类在 F 上方，bottom 类在 F 下方；簇的类型取其曲线证据中占多数的极值类型）→ "visual" / "overshoot"。否则，若涉及 ≥ 2 个部件，或是该行最上或最下的簇 → "baseline" / "round"（例如单个圆形 logo 的上下边）；再否则丢弃。

**竖线分类**：同水平线的第 1、2 条，但不做视觉超出判定。只有曲线证据时：涉及 ≥ 2 个轮廓，或是选区最左或最右的簇 → "baseline" / "round"，否则丢弃。

**开关**（只在输出时过滤；被过滤的线不登记到注册表，但仍参与 8.8.8 的圆分类）：`features.baselines` 关闭时不输出 subtype 为 flat、round、mixed 的水平线（mixed 线无论被分为哪个 category）；`features.overshoot` 关闭时不输出 overshoot 线；`features.verticals` 关闭时不输出全局竖线，但笔画、间距的尺寸引线照常输出（9.4）。

**线注册表（LineRegistry）**

- 所有水平和竖直线（参考线、尺寸引线）都通过 `register(orient, pos, span, category)` 登记。
- 同方向、位置差 ≤ tolPos ÷ 2 的线合并：span 取并集，category 取优先级最高者（visual ＞ baseline ＞ dimension）。
- 最终跨度：水平线横跨整个辅助区域；竖线见 9.4。

### 8.7 笔画、间距、高度、字怀（core/13_stems）

**笔画**（`features.stemWidths`）：同一部件内两条非 short 直线边 e1、e2，满足以下全部条件即为候选：

1. 平行：方向差 ≤ `parallelAngleTol`（模 180°）。
2. 宽度 d = （e2 中点到 e1 所在直线的距离 + e1 中点到 e2 所在直线的距离）÷ 2，且 `minStemWidthRel` × S ≤ d ≤ `maxStemWidthRel` × S。
3. 沿 e1 方向的投影区间重叠长度 ≥ `stemOverlapMin` × min(e1 长度, e2 长度)。
4. 在重叠区间中线的 25%、50%、75% 处取三个点，`inkAt(点, partId)` 都为真。

处理：

- 每条边只与满足条件且 d 最小的对边配对；成对去重。
- `mid` = 重叠区间中点在两边中线上的位置。
- 两个笔画的两条边分别共线（方向差 ≤ `parallelAngleTol`、法向偏移 ≤ tolPos）时合并为一个笔画，例如 X 中被交叉打断的笔画。合并后 `overlapLen` 取总和，`mid` 取最长一段重叠区间的中点（不要落在交叉处）。
- kind：两边都是 "v" → "vertical"；都是 "h" → "horizontal"；其余 → "diagonal"。

**字怀**（`features.counters`，P2）：条件同笔画，但第 4 条改为三个点都不在墨迹内，且都位于该部件的外轮廓内部。

**间距**（`features.gaps`）：每行内的非小部件按包围盒 left 排序，取相邻两个部件：

- 垂直重叠 ≥ `gapOverlapMin` × 较小高度，且 gap = 右部件 left − 左部件 right ＞ 0，则记录；x1 = 左部件 right，x2 = 右部件 left。
- v1 只测包围盒间距。已知限制：对 A、V、T 等字形，它不等于视觉间距。

**高度**（`features.heights`，P2）：同一行内，位于行包围盒上下 `overshootMaxRel` × 行高范围内的水平参考线，相邻两条之间的距离。若与某个 horizontal 笔画的两条边位置相同（差 ≤ tolPos），不重复记录。

### 8.8 辅助圆（core/14_circles）

这是核心功能：识别"接近某段局部曲率"的圆，允许误差，并给出偏差。

**8.8.1 分段（run）**

- 每条轮廓按顺序遍历采样，连续的 cubic 采样组成一个 run。遇到 line 段、|κ| ＜ κmin 的采样，或段连接处切线方向跳变 ＞ `cornerAngleDeg` 时断开。
- 闭合轮廓：如果首尾连接处不是断点，把最后一个 run 和第一个 run 连成一个。
- run 内在曲率符号改变处继续拆分。

**8.8.2 递归拟合**

`fitRegion(samples)`：

1. 区域转角 = 相邻采样切线方向变化量（解卷绕后）之和的绝对值。若采样数 ＜ `circleMinSamples`，或转角 ＜ `circleMinArcDeg`，丢弃。
2. 拟合圆（8.8.3），计算 maxErr = max |dist(p, c) − r|。
3. 容差 tolAbs = min(`circleFitTol` × r, `circleAbsCapRel` × S)。
4. 若 maxErr ≤ tolAbs 且 r ≤ `circleMaxRadiusFactor` × D，接受。
5. 否则，若转角 ≥ 2 × `circleMinArcDeg`，按弧长从中间一分为二，分别递归；否则丢弃。

**8.8.3 拟合算法**

- 初值：Kåsa 代数拟合（数据先减去均值）。行列式 Suu·Svv − Suv² ≤ 1e-12 × (Suu + Svv)² 时视为共线，丢弃。
- 精化：Levenberg–Marquardt 几何拟合，最小化 Σ(|pi − c| − r)²，最多 20 次迭代；步长 ＜ 1e-6 × r 时停止。
- 输出：圆心 c、半径 r、maxErr、rmsErr、误差最大的采样点 maxErrPoint 及其有符号误差 maxErrSigned（dist − r，正数表示轮廓在圆外）。
- 公式见附录 A。

**8.8.4 合并相邻区域**：同一 run 内相邻的已接受区域，尝试用并集重新拟合，若通过 8.8.2 第 3、4 步则合并；重复直到不再变化。

**8.8.5 跨区域合并**：任意两个圆 A、B（可来自不同 run、轮廓或部件），若圆心距 ≤ `circleMergeTol` × max(rA, rB) 且半径差 ≤ `circleMergeTol` × max(rA, rB)，归为同一组（并查集）。每组用全部成员采样重新拟合；通过 8.8.2 第 3、4 步的检验则合并为一个圆，否则各自保留。例如一个圆被直线切口或尖角分成几段弧，或两个部件上的弧属于同一个圆，都在这一步合并为一个。

**8.8.6 覆盖范围**：把圆的全部成员采样按极角排序，找到最大空隙 gap。coverageDeg = 360 − gap；arcStartDeg = 空隙终点，arcEndDeg = 空隙起点（需要时加 360）。

**8.8.7 同心环**（`features.ringThickness`）：两个圆的圆心距 ≤ `circleMergeTol` × max(r1, r2)，属于同一部件，并且在两者共同覆盖范围的 25%、50%、75% 处取 3 个角度，半径 (r1 + r2) ÷ 2 处的点 `inkAt` 都为真 → 记为环，thickness = |r1 − r2|。测量角 angleDeg 依次尝试 45、135、315、225、90、0、270、180，取第一个落在共同覆盖范围内且环中点在墨迹内的角度。

**8.8.8 分类**：圆的最高点 cy + r 或最低点 cy − r 与某条 visual 水平线的距离 ≤ tolPos → category "visual"（红色实线），否则为 "fitted"（灰色虚线）。

**8.8.9 评分与数量上限**

- score = coverageDeg × (1 − 0.5 × maxErr ÷ tolAbs) × (1 + 0.25 × (成员轮廓数 − 1))。
- 先保留所有属于环或 category 为 visual 的圆，再按 score 从高到低补足到 `maxCircles` 个。如果前者本身就超过 `maxCircles`，只保留其中 score 最高的 `maxCircles` 个。
- `features.circles` 只控制是否绘制圆；被保留的圆仍用于环厚度标注。偏差标记随圆一起关闭（9.10）。

**8.8.10 手动拟合圆**（脚本 CircleFromSelection，P1）

- 用直接选择工具选中 3 个以上锚点（可以跨路径）。
- 取所有选中锚点；若同一路径中相邻两点都被选中，加入两点之间那段的采样点。
- 用 8.8.3 拟合，绘制到 manual 子图层（刷新不会删除），标注 "R 1.15a"（文档中没有 `a` 时标注半径 pt 值）和"选中点最大偏差"。

### 8.9 角度与构造线（core/15_angles）

- 斜边集合：方向为 "d" 且长度 ≥ minDiagLen 的边。
- 方向簇：对方向角（模 180°）做环形一维聚类，容差 `parallelAngleTol`。

**轴角**（axis，`features.angles`）：每个方向簇取最长的边 e，端点 P、Q（Q 的 y 较大），方向角 α。

- 若 |α − 90| ≤ 45，参考竖直：顶点 = Q，ray1 = 90°（向上），ray2 = 向量 Q − P 的方向；数值 = |α − 90|。
- 否则参考水平：顶点 = e 中 x 较小的端点 L（另一端为 R），ray1 = 180°（向左），ray2 = 向量 L − R 的方向；数值 = min(α, 180 − α)。
- 数值 ≤ `axisAngleTol` 的不输出（这类边已算作轴向边）。
- `signedAxisAngles`（P2）：参考竖直时，向右倾为正、向左倾为负；参考水平时，从左到右上升为正。

**夹角**（pair）：

- 对两个方向簇 c1、c2（方向差在 [`pairAngleMinDeg`, 180 − `pairAngleMinDeg`] 内），在同一部件中取 e1 ∈ c1、e2 ∈ c2，求两条直线的交点 I。I 必须位于该部件包围盒按宽高各外扩 `pairIntersectExpand` 的范围内。
- I 处有 4 个扇区，只考虑包含 +y（向上）和包含 −y（向下）方向的两个扇区。沿扇区角平分线，在距离 0.5 × ra 和 ra 处各取一点，两点都不在墨迹内（全部部件）时成为候选。
- 去重：同一簇对、同一显示角度（按 `angleLabelPrecision` 取整）只保留 e1、e2 长度和最大的候选。

**数量上限**：先放夹角，再放轴角，各自按边长（夹角用两边长度和）从大到小，总数不超过 `maxAngles`。

**显示**：以顶点为圆心、半径 ra 画圆弧（style angleArc；轴角取两条射线之间小于 180° 的一侧，夹角取上面选中的扇区）；轴角另画一条长 2 × ra 的参考射线（style angleRef）；标签放在角平分线方向、距顶点 ra + 0.9 × fs 处。

**构造线**（`features.constructionLines`）：把共线的斜边（方向差 ≤ `parallelAngleTol`、法向偏移 ≤ tolPos）归为同一条直线；每条直线用 Liang–Barsky 算法裁剪到最终辅助区域（裁剪在流水线第 12 步进行）；按直线上的边长总和从大到小，最多保留 `maxConstructionLines` 条。

### 8.10 基准单位 a（core/16_baseunit）

- `baseUnit.mode` 为 "value"：a = `baseUnit.value`（必须是正数），source = "manual"。
- `baseUnit.mode` 为 "auto"：
    1. 候选来源依次为：vertical 笔画 → 全部笔画 → 环厚度 → S。使用第一个非空的来源。
    2. 对宽度做相对容差为 `widthClusterTol` 的聚类（8.13），簇得分 = 簇内各笔画 `overlapLen` 之和（来源为环厚度时，得分 = 环的数量）。
    3. a = 得分最高的簇的加权中位数（权重为 `overlapLen`；来源为环厚度时权重为 1）。来源为 S 时 a = S。
    4. source："auto-stem"（笔画）、"fallback-ring"（环厚度）、"fallback-height"（S）。
- candidates（供界面列表）：先列 vertical 笔画的簇（kind "vertical"），再列其余笔画的簇（kind "other"），各自按得分从高到低，合计最多 6 个；没有笔画时列环厚度的簇（kind "ring"）。每项含 value、count、totalLength、kind。
- **锁定**：`baseUnit.locked` 为真（默认）时，生成后把 `a` 的数值写入文档数据，刷新时直接使用，不再自动计算。否则微调过程中，所有倍率都会随 `a` 一起漂移。

### 8.11 倍率、吸附与格式化（core/17_ratios）

- ratio = value ÷ a。
- 显示值：rDisp = round(ratio ÷ `labelPrecision`) × `labelPrecision`，去掉末尾多余的 0。rDisp 等于 1 显示 "a"；为整数 n 时显示 "na"（如 "2a"）；其余如 "0.96a"、"1.2a"。

**吸附**（`snapMode` 为 "step"）：

- target = round(ratio ÷ `snapStep`) × `snapStep`，且不小于 `snapStep`。
- `detectSpecialRatios` 为真时，若 |ratio − s| ÷ s ≤ `specialRatioTol`（s ∈ {0.382, 0.618, 0.707, 1.414, 1.618, 2.618}），则 target = s，special = 对应名称（"1/φ²"、"1/φ"、"1/√2"、"√2"、"φ"、"φ²"），targetDisplay 显示三位小数（如 "1.618a"）。
- dev、devAbs 按 6.5 计算；severity：|dev| ≤ `devOk` → "ok"；≤ `devWarn` → "warn"；否则 "bad"。

**标签文字**：

- 未开启吸附：一行，显示 display。
- 开启吸附且 severity 为 ok：一行，显示 targetDisplay。
- 开启吸附且 severity 为 warn 或 bad：两行。第一行 targetDisplay；第二行 "实测 0.958a · +0.12pt"（实测倍率三位小数，偏差 pt 两位小数，带正负号，用 ASCII 的 + 和 -），style 为 textWarn 或 textBad。`uiLanguage` 为 "en" 时写 "meas. 0.958a · +0.12pt"。

**角度**：

- 显示值 = round(value ÷ `angleLabelPrecision`) × `angleLabelPrecision`，加 "°"。
- `angleSnapStep` ＞ 0 时，target = round(value ÷ `angleSnapStep`) × `angleSnapStep`，dev = value − target；severity：|dev| ≤ `angleDevOk` → ok；≤ `angleDevWarn` → warn；否则 bad。标签规则同上（第二行写 "实测 22.4° · +0.4°"）。

**比例关系发现**（ratioFindings，P2，只写入报告，不绘制）：整体宽高、各行高、各类宽度两两之比，接近特殊比例（`specialRatioTol`）时记录。

### 8.12 目标线（`features.targetLines`，P1）

目标线告诉用户"边应该移到哪里"。只在对应测量开启吸附、且 severity 为 warn 或 bad 时生成。尺寸类需要 `snapMode` 为 "step"，角度类需要 `angleSnapStep` ＞ 0。

- vertical 笔画：保持中心不动，两边对称调整。目标 x = 中心 ± target × a ÷ 2，画两条短竖线，长度 = 笔画重叠区间（合并笔画取各段的总范围）+ 上下各 0.5 × fs。
- horizontal 笔画：同理，画两条短水平线。
- diagonal 笔画：中线不动，在中线两侧距离 target × a ÷ 2 处画两条平行短线，长度 = 重叠长度。
- 间距：左部件不动，目标 x = x1 + target × a，画一条竖线，长度 = 该行高度。
- 轴角：以顶点为轴，沿目标角度画一条射线，长度 = 原边长。
- 夹角和圆不生成目标线（圆本身就是目标）。
- style 为 target，放在 targets 子图层。

### 8.13 一维聚类（core/09_cluster）

```
cluster1D(values, weights, tol, relative):
  按值升序排序
  当前簇 = [第一个值]
  对之后的每个值 v：
    m = 当前簇的加权平均（权重全为 0 时用算术平均）
    差 = relative ? |v − m| / m : |v − m|
    差 ≤ tol → 加入当前簇；否则开始新簇
  返回簇列表（位置、成员、权重和）

环形聚类（方向角，周期 180°）：
  先按上面的方法聚类；若第一个簇与最后一个簇跨越 0°/180° 的距离 ≤ tol，合并二者
```

与"和上一个值比较"不同，这里和簇的平均值比较，避免链式漂移。

### 8.14 数值稳健性

- EPS = 1e-9，所有除法前检查分母。
- 所有输出数值做 isFinite 检查；含非有限值的特征丢弃，并写入警告。
- 所有迭代都有次数上限。

## 9. 标注与布局（core/18_layout）

### 9.1 字号与线宽

fs、u 见 7.4。所有图元的线宽 = 样式宽度 × u，虚线长度 = 样式虚线 × u。

### 9.2 文字尺寸估算

核心库没有字体度量，按字符估算：宽度 = fs × sizeFactor × Σ 字符系数（数字 0.56，"." 0.28，"a" 0.55，"°" 0.40，"+" 和 "-" 0.58，空格 0.28，中文 1.0，其他 0.6）；行高 = 1.2 × fs × sizeFactor。宿主绘制后会按实际尺寸重新居中（10.4）。

### 9.3 标注分组

- 横向尺寸（vertical 笔画、间距、字怀）：放在所在行上方的车道。若该行是最后一行且行数 ≥ 2，放在下方车道。
- 纵向尺寸（horizontal 笔画、高度）：放在选区右侧的车道，垂直方向居中于两条边之间，文字不旋转。
- diagonal 笔画：始终用模块方块（9.5）。
- `stemLabelStyle` 为 "squares" 时，vertical 和 horizontal 笔画也改用模块方块，不进入车道。
- 环厚度：径向标注（9.6）。
- 角度：见 8.9。

### 9.4 车道算法

- 上方第 k 条车道：起点为行顶 + 1.5 × fs，之后每条车道依次加上前一条车道的高度和 0.5 × fs 的间距。下方车道同理向下；右侧车道从选区右边 + 1.5 × fs 开始向右。
- 标签框：未旋转时宽 w、高 h。若 w ＞ 0.9 × (x2 − x1)，旋转 -90°，框的宽高互换。
- 贪心排布：标签按中心坐标排序，依次放入第一条不与已有标签重叠（含 0.3 × fs 间距）的车道。车道数达到 `maxLanes` 后放入最后一条，并写入警告。
- 尺寸引线：登记 category 为 dimension 的线。
    - 上/下车道：在 x1、x2 处画竖向引线，从测量对象所在行的另一侧（行底或行顶）外 0.5 × fs 开始，延伸到标签所在车道外侧 + 0.5 × fs。
    - 右侧车道：在 y1、y2 处画水平引线，从测量对象左端外 0.5 × fs 开始，向右延伸到标签所在车道外侧 + 0.5 × fs。
- `labelDedup` 为真时：同一行、同一侧车道中显示文字相同的标签只保留最左（右侧车道为最上）的一个，引线照常登记。
- 竖线最终跨度：
    - dimension 线：按登记的跨度。
    - baseline / visual 竖线：覆盖支撑部件所在的各行，上下各延伸到这些行的车道外侧 + fs。
    - 选区最左、最右的竖线：覆盖辅助区域全高。
    - 注册表合并时取并集。

### 9.5 模块方块

- 在笔画的 `mid`（8.7）处，以中线为中心画正方形，边长 = 笔画宽度，两条边分别落在笔画两侧边上（style moduleSquare，图层 dimensions）。
- 标签放在方块中心，旋转到与笔画方向一致（角度归一化到 (−90°, 90°]），字号 = min(fs, 0.5 × 笔画宽度)。
- 计算出的字号 ＜ 4pt 时，标签改放在方块外侧（沿法线方向 0.8 × fs 处），字号为 fs。

### 9.6 环厚度与圆半径标注

- 环厚度：在 angleDeg 方向，从内圆到外圆画一条径向短线（style measureBar，图层 dimensions），标签放在外圆外侧 0.8 × fs 处，不旋转。
- 圆半径（`circleLabels`，P2）：在圆的 45° 方向、圆外 0.8 × fs 处标注 "R " + measureR 的显示值（如 "R 1.15a"），不旋转。

### 9.7 辅助区域与圆的显示

- `extendTo` 为 "margin"：选区包围盒四边各外扩 `marginFactor` × D。
- `extendTo` 为 "artboard"：使用 Geometry JSON 的 `artboard` 矩形。
- A0 = 上述矩形 ∪ 所有标签框（外扩 fs）。图例按 9.8 相对 A0 放置，最终辅助区域 = A0 ∪ 图例框。
- `circleDisplay` 为 "full"：画整圆；但若圆的包围盒超出"辅助区域各边外扩 50%"的范围，自动改为 extended。
- "extended"：覆盖弧两端各延长 `circleExtendDeg`；"arc"：只画覆盖弧。

### 9.8 图例（`features.legend`）

放在 A0（9.7）左下角内侧，从下往上排列；若与选区包围盒或任何标签框重叠，改放到 A0 下方外侧。只列出实际出现的类别：

| 类别 | 出现条件 | en / zh |
| --- | --- | --- |
| baseline 样式示例 | 有 baseline 或 dimension 线 | Baseline / 基准线 |
| visual 样式示例 | 有 visual 线或圆 | Visual Alignment Line / 视觉对齐线 |
| construction 样式示例 | 有构造线 | Construction Line / 构造线 |
| target 样式示例 | 有目标线 | Target / 目标线 |
| devMarker 样式示例 | 有偏差标记 | Deviation / 偏差 |

每项是一条长 4 × fs 的示例线（偏差用一个示例小三角）加文字；`legendLanguage` 为 "both" 时写 "Baseline 基准线"。

### 9.9 安全区（`features.clearSpace`，P2）

外框 = 选区包围盒外扩 `clearSpaceFactor` × a（style clearFrame）。四个角各画一个边长为 `clearSpaceFactor` × a 的方块（style clearSquare），并标注倍率（如 "a"、"2a"）。

### 9.10 偏差标记（`features.deviationMarkers`）

`features.circles` 关闭时不画。对每个被保留的圆，若 |maxErrSigned| ＞ max(`devOk` × r, 0.1pt)：在 maxErrPoint 处画一个边长 0.6 × fs 的小三角，尖端指向圆周（提示调整方向）；在外侧标注 "+0.42pt"（style devMarker 与 textWarn，图层 deviation）。

### 9.11 背景（`features.background`，P2）

画一个比辅助区域各边大 fs 的矩形（style background），放在独立的顶层图层 "Logo Guides BG" 中，并把该图层移到最底层。

## 10. 输出到 Illustrator（host/h04_draw、host/h03_store）

### 10.1 图层结构

```
Logo Guides               顶层图层，置于最上
├─ LG Labels              labels
├─ LG Deviation           deviation
├─ LG Targets             targets
├─ LG Angles              angles
├─ LG Dimensions          dimensions
├─ LG Circles             circles
├─ LG Visual Lines        visualLines
├─ LG Baselines           baselines
├─ LG Construction        construction
├─ LG Clear Space         clearSpace
├─ LG Legend              legend
├─ LG Snap Guides         snapGuides（output 为 guides 或 both 时）
├─ LG Manual              manual（手动工具的结果，刷新不删除）
└─ __LG_DATA__            隐藏路径，note 存文档数据
Logo Guides BG            可选背景，置于最底
```

线图元的图层：category 为 visual → visualLines；baseline → baselines；dimension → dimensions；构造线 → construction；目标线 → targets；角度参考射线 → angles。

### 10.2 绘制规则

- line：`pathItems.add()` 后 `setEntirePath([p0, p1])`。
- circle：`pathItems.ellipse(top, left, width, height)`，其中 top = cy + r，left = cx − r，width = height = 2r。
- arc：拆成每段不超过 90° 的三次贝塞尔，手柄长度 k = 4/3 × tan(φ/4) × r。逐点设置 anchor、leftDirection、rightDirection：离开当前点的手柄写 rightDirection，进入下一点的手柄写 leftDirection。
- polygon：`setEntirePath(points)`，按字段设置 closed。
- label：每行创建一个点文字（`textFrames.add()`），设置内容、字号、字体、颜色；各行从上到下排好后编组；读取编组的 `geometricBounds`，平移使中心等于 pos，再 `rotate(rotation)`（绕中心）。
- 样式：线类 filled = false、stroked = true；strokeWidth = 样式宽度 × u；strokeDashes = 样式虚线 × u（实线为空数组）；strokeCap = BUTTENDCAP；opacity 按样式。填充类（附录 B 中描边为"无"的样式）：filled = true、stroked = false，fillColor 用样式的填充色。
- 颜色：RGB 文档用 RGBColor；CMYK 文档用简单公式把 RGB 转成 CMYKColor（辅助线颜色不需要精确）。
- 字体：文字含中文时按 `cjkFontNames`，否则按 `fontNames`，依次 `app.textFonts.getByName()`（try/catch），都找不到就不设置字体。
- 每个绘制对象的 `name` = featureId（标签编组为 featureId + ":label"），供阶段 2 按特征选中或隐藏。注册表合并后的线只保留优先级最高的那条线的 featureId。
- `output` 为 "guides"：line、circle、arc 画到 snapGuides 子图层，设置 `guides = true`，不套样式；label、polygon、图例仍按样式绘制到各自子图层。`output` 为 "both"：样式版和参考线版都画。

### 10.3 生成和刷新流程（宿主）

1. 记录当前的 `doc.activeLayer`。
2. 获取或创建 "Logo Guides" 图层并置于最上；若已锁定，临时解锁。
3. 删除所有自动子图层（LG Manual 和 `__LG_DATA__` 除外）以及 "Logo Guides BG" 图层（如存在），按需重建。
4. 按图元绘制。
5. 写入文档数据。只有"生成"会创建新的 runId 并按 10.5 重写来源标签；"刷新"沿用原 runId，不改标签。
6. `lockLayer` 为真时锁定 "Logo Guides" 和 "Logo Guides BG" 图层。
7. 恢复 `doc.activeLayer`。否则用户之后画的图会进入辅助图层。
8. 把选区恢复为来源对象。

第 2 步之后的所有步骤放在 try/finally 中，确保异常时也恢复图层锁定状态和 activeLayer。

### 10.4 文字精确居中

宿主创建文字后，用实际的 `geometricBounds` 居中，不依赖核心库的估算。

### 10.5 来源标签（用于刷新）

- 生成时：先清除文档中所有名为 `LG_SOURCE` 的标签，再给每个顶层来源对象添加 tag（name = `LG_SOURCE`，value = runId）。
- 刷新时：遍历 `doc.pageItems`，找出 `LG_SOURCE` 等于当前 runId 的对象作为来源，**忽略当前选区**（微调时选区往往只有部分路径）。找不到时提示重新运行"生成"。
- 文字来源：标签打在原 TextFrame 上，刷新时重新做临时轮廓化。

### 10.6 设置存储

- 全局设置：`Folder.userData` 下的 `LogoGuides/settings.json`（UTF-8）。对话框每次确认后写入。
- 文档数据：见 6.4。
- `a` 的优先级：生成时以对话框的选择为准；刷新时，文档数据中 `locked` 为真的值优先，否则按全局设置的 `baseUnit` 计算。
- 宿主使用锁定的 `a` 时，在调用 `analyze` 前把设置改写为 `baseUnit.mode` = "value"、`baseUnit.value` = 该值。
- 此时分析结果的 source 为 "manual"，但刷新不改写文档数据中的 `baseUnit`（保留首次的 source）；摘要显示"已锁定：12.40 pt（auto-stem）"。
- 刷新使用当前的全局设置 + 上述 `a`。

### 10.7 清除

弹出对话框四选一：仅自动辅助线（含 "Logo Guides BG" 图层）/ 全部辅助线（含手动）/ 全部 + 文档数据（删除整个 "Logo Guides" 图层、"Logo Guides BG" 图层，并清除 `LG_SOURCE` 标签）/ 取消。

## 11. 用户界面

### 11.1 阶段 1 脚本清单（dist/scripts）

| 文件 | 功能 | 优先级 |
| --- | --- | --- |
| LogoGuides_Generate.jsx | 选中 logo → 对话框 → 生成 | P0 |
| LogoGuides_Refresh.jsx | 不弹对话框，按上次的来源和设置重新生成 | P0 |
| LogoGuides_Clear.jsx | 清除（10.7） | P0 |
| LogoGuides_DumpGeometry.jsx | 把选区的 Geometry JSON 导出到日志目录（排错用） | P0 |
| LogoGuides_SetBaseUnit.jsx | 选一个对象（取宽、高或较小值）或两个锚点（取距离、水平距离或垂直距离），设为 `a` 并锁定：写入文档数据（source 为 "manual"，locked 为 true）；文档中已有来源标签时自动刷新一次 | P1 |
| LogoGuides_CircleFromSelection.jsx | 手动拟合圆（8.8.10） | P1 |
| LogoGuides_Measure.jsx | 选两个锚点，把距离的倍率标注到 LG Manual | P2 |

### 11.2 生成对话框（ScriptUI，类型 "dialog"）

- **基准单位 a**：下拉框，选项依次为：
    - "自动：12.40 pt（竖笔画，7 处）"（没有文档数据时默认选中）
    - 各候选值："12.40 pt（7 处）"
    - "上次的值：12.40 pt"（文档数据中有锁定的 `a` 时出现并默认选中）
    - "自定义…"（选中后启用数值输入框，单位 pt）
    - 没有检测到笔画时，自动项写"自动：将使用环厚度或字高"
    - 复选框"锁定 a（推荐：微调期间保持不变）"，默认勾选
    - 候选列表在对话框打开时按当前全局设置计算。在对话框中修改容差不会刷新列表（v1 简化）；选择"自动"时，生成阶段会按新容差重新计算。
- **容差**（`tolerancePreset`）：单选 宽松 / 标准 / 严格。
- **标注**：精度下拉 0.01 / 0.05 / 0.1；吸附下拉 关 / 0.05a / 0.1a / 0.25a / 0.5a；复选"识别特殊比例（φ、√2）"；角度吸附下拉 关 / 1° / 5° / 15°。
- **生成内容**：复选框，列出除 `features.background` 外的全部 features 项（尚未实现的 P2 项不显示），初始值来自全局设置。
- **输出**：样式 深色 / 浅色；模式 样式化 / 参考线 / 两者；复选"锁定辅助图层"；延伸 边距 / 画板。
- **按钮**：生成（默认按钮）/ 取消。
- 没有放进对话框的参数，通过编辑 settings.json 修改（写进 USER_[GUIDE.md](http://GUIDE.md)）。

### 11.3 摘要（`showSummary`）

生成后弹出：`a` 的值和来源、各类特征数量、偏差最大的 5 项、警告。刷新时只在有警告时弹出。

### 11.4 阶段 2 面板功能

| 功能 | 优先级 |
| --- | --- |
| 与阶段 1 对话框功能对等，参数实时可调，不用每次弹窗 | P0 |
| 基准 a：候选列表点击即设为 a；"使用选中对象的宽/高"；数值输入；锁定开关 | P0 |
| 按钮：生成、刷新、清除、导出 dump | P0 |
| 计算放在面板 JS 中执行，宿主只负责读取和绘制 | P0 |
| 容差滑杆：`circleFitTol` 在 0.5%–6% 之间连续可调（覆盖预设） | P1 |
| 特征列表：按类别列出所有特征（id、显示值、偏差），每项可勾选显示/隐藏；点击后在 Illustrator 中选中对应的辅助对象 | P1 |
| 规范检查视图：按 severity 排序的偏差列表 | P1 |
| 刷新后保持隐藏状态：按类型和参数最近匹配旧特征（圆：圆心距与半径差 ≤ `circleMergeTol` × r；线：位置差 ≤ tolPos；笔画和间距：同一部件且位置差 ≤ tolPos；角度：顶点距离 ≤ tolPos 且角度差 ≤ 1°） | P1 |
| 精选模式（规则评分，不用 AI）：线、圆、角度分别最多 `curatedMaxLines`、`curatedMaxCircles`、`curatedMaxAngles` 个，笔画和间距全部保留 | P1 |
| 样式预设切换 | P1 |
| 自动刷新（实验，默认关）：每 2 秒读取一次来源对象的轻量签名（锚点数 + 包围盒），变化后自动刷新 | P2 |

### 11.5 CEP 技术要点

- manifest 要点：Host Name 为 "ILST"，版本范围 [25.0, 99.9]；RequiredRuntime CSXS 11.0；ScriptPath 指向 host/host.jsx；CEFCommandLine 加入 `--enable-nodejs` 和 `--mixed-context`（阶段 3 用 Node 发网络请求）。以 Adobe 官方 CEP 样例（GitHub 上的 Adobe-CEP/Samples 与 CEP-Resources）为准核对格式，CSInterface.js 使用对应 CEP 版本。
- 通信：`evalScript` 的参数先用 `encodeURIComponent` 编码，宿主用 `decodeURIComponent` + `LG.json.parse` 解码，避免引号转义问题。宿主返回 JSON 字符串：成功为 `{"ok":true,"data":...}`，失败为 `{"ok":false,"error":"..."}`。
- 宿主暴露的全局函数：`LGHost_read(mode)`（mode 为 "selection" 或 "sources"）、`LGHost_draw(enc)`、`LGHost_clear(mode)`、`LGHost_getDocData()`、`LGHost_setDocData(enc)`、`LGHost_selectFeature(id)`、`LGHost_setFeatureVisible(enc)`。
- 一次刷新调用一次 `LGHost_read` 和一次 `LGHost_draw`，绘制不拆成多次调用，减少开销和撤销步骤。
- 调试：开启 PlayerDebugMode（macOS：`defaults write com.adobe.CSXS.11 PlayerDebugMode 1`；Windows：注册表 `HKEY_CURRENT_USER\Software\Adobe\CSXS.11` 下新建字符串值 `PlayerDebugMode` = 1；CSXS.12 同样设置）。扩展目录：macOS `~/Library/Application Support/Adobe/CEP/extensions/`，Windows `%APPDATA%\Adobe\CEP\extensions\`。用 `.debug` 文件配置远程调试端口。
- 发布：用 ZXPSignCmd 和自签名证书打包 .zxp；用户用 ExManCmd 或第三方安装器安装。

## 12. AI 集成（阶段 3）

### 12.1 用途与边界

AI 只负责三件事：筛选（决定显示哪些特征）、规范化建议（例如把 21.6° 和 22.3° 统一为 22°）、生成规范说明文字。AI 不做几何计算，不修改图形。

### 12.2 没有 AI 时

阶段 2 的精选模式（11.4）就是基线。AI 不可用或调用失败时自动回退到精选模式。

### 12.3 输入（只发送数值摘要，不发送图像）

```json
{
  "a": 12.4,
  "S": 180,
  "rowCount": 2,
  "goal": "presentation",
  "features": [
    { "id": "S3", "type": "stem", "kind": "vertical", "ratio": 0.958, "target": 0.95, "devPct": 0.8 },
    { "id": "C1", "type": "circle", "rRatio": 4.6, "coverageDeg": 330, "fitErrPct": 0.6, "category": "visual" },
    { "id": "A2", "type": "angle", "kind": "pair", "deg": 70.4 }
  ]
}
```

`goal` 取值："presentation"（展示，精简）或 "check"（校验，全面）。

### 12.4 输出（严格 JSON）

```json
{
  "show": ["S3", "C1"],
  "hide": ["C7"],
  "targets": [{ "id": "A2", "target": 70, "reason": "与 A5 统一为 70°" }],
  "groups": [{ "title": "统一斜角 22°", "ids": ["A1", "A4"] }],
  "notes": "规范说明文字……"
}
```

### 12.5 校验

- 未知 id 丢弃。
- target 必须是有限数；尺寸类与实测倍率相差不超过 15%，角度类相差不超过 5°，否则丢弃。
- JSON 解析失败时重试 1 次，仍失败则回退到精选模式。

### 12.6 应用

- show / hide → 特征可见性。
- targets → 该特征的吸附目标覆盖：标签显示目标和偏差，并生成目标线。
- groups 与 notes → 在面板中显示；notes 可选择插入为 LG Labels 中的文字（P2）。

### 12.7 接口

- 支持 OpenAI 兼容接口（POST `{baseUrl}/chat/completions`）和 Anthropic 接口（POST `https://api.anthropic.com/v1/messages`，请求头 `x-api-key` 与 `anthropic-version: 2023-06-01`）。
- 在 CEP 中用 Node 的 https 模块发请求（manifest 已开启 Node），避免浏览器 CORS 限制。
- 超时 60 秒。

### 12.8 密钥与隐私

- API key 只保存在本机用户目录（明文保存，需在界面中提示用户），不写入文档。
- 默认只发送数值摘要。"附带预览图"是可选项，默认关闭（P2）。

## 13. 错误处理与边界情况

| 情况 | 行为 |
| --- | --- |
| 没有打开文档 | 提示"请先打开文档" |
| 选区为空 | 提示"请先选中 logo" |
| 选区中只有不支持的对象 | 提示，并列出跳过的类型和数量 |
| 处于文字编辑状态 | 提示按 Esc 退出文字编辑 |
| 纯描边或开放路径 | 参与直线边和圆检测，不参与笔画宽度；写入警告 |
| 锚点总数超过 20000 | 弹出确认框（可能很慢） |
| 没有检测到任何特征 | 提示尝试"宽松"容差 |
| `a` 无效（≤ 0 或非数字） | 回到对话框重新输入 |
| 辅助图层被删除或改名 | 重新创建；`__LG_DATA__` 丢失时视为首次生成 |
| 来源对象被删除或取消编组（标签丢失） | 刷新时提示重新运行"生成" |
| 对象在画板外 | 正常处理；`extendTo` 为 "artboard" 时线可能覆盖不到对象，写入警告 |
| 尺寸极小或极大（S ＜ 5pt 或 S ＞ 5000pt） | 正常计算，字号和线宽受上下限约束，写入警告 |
| 运行异常 | try/catch 后弹出简短信息和行号（`e.line`），完整信息写入日志；finally 中删除临时轮廓副本，恢复图层锁定状态和 activeLayer |

日志：`Folder.userData` 下的 `LogoGuides/log.txt`（追加写入，超过 1MB 时轮转）。`debug` 为真时另外写入 `geometry_dump.json` 和 `analysis.json`，可直接放进 tools/samples 在 Node 中复现。

## 14. 测试与验收

### 14.1 自动测试（Node，`node --test`）

- **加载方式**：在 `vm` 上下文中执行拼接后的 core 代码（与 ExtendScript 运行的是同一份源码）。执行前在该上下文中删除 16.1 列出的全部禁用 API（包括 JSON），这样测试中误用这些 API 会直接报错。从上下文取回的结果，先用外层的 `JSON.stringify` / `JSON.parse` 转成当前 realm 的对象再断言（跨 realm 对象的原型不同，`deepStrictEqual` 会误判）。
- **夹具**（tools/test/fixtures.js）：用代码生成 Geometry JSON。圆用 4 段三次贝塞尔表示（手柄系数 0.5522847498）。
- **ES3 检查**：对 dist 产物运行 check_es3.js（16.2）。
- **性能**：F10 在 Node 中 `analyze` 耗时 ＜ 300ms。

### 14.2 夹具与期望值（未注明时容差为 standard，其余设置为默认值）

| 编号 | 图形 | 期望 |
| --- | --- | --- |
| F1 | 圆，圆心 (0, 0)，r = 100 | 1 个圆；圆心误差 ≤ 0.1；半径误差 ≤ 0.1；coverageDeg ≥ 350 |
| F2 | 圆环，外 r = 100，内 r = 60，同心，复合路径 | 2 个同心圆；1 个环，thickness = 40 ± 0.1；没有笔画，所以 `a` 来源为 "fallback-ring"，a = 40；环标签 "a" |
| F3 | 三个矩形：x = 0、宽 20；x = 40、宽 20；x = 80.8、宽 19.2；y 均为 0 到 100 | a = 20（"auto-stem"）；笔画标签 "a"、"a"、"0.96a"；间距 20、20.8，标签 "a"、"1.04a"；水平线 y = 0、y = 100 为 baseline/flat。开启 `snapMode` = "step"、`snapStep` = 0.05 后：第三个笔画目标 "0.95a"，dev ≈ +1.05%（warn）；第二个间距目标 "1.05a"，dev ≈ −0.95%（warn） |
| F4 | X：两条宽 20 的笔画，方向 55° 和 125°，交叉于 (50, 50)，上下两端水平切齐在 y = 0 和 y = 100，合成一个轮廓（12 个顶点的多边形，由夹具解析计算） | 2 个 diagonal 笔画，宽 20 ± 0.1；2 个轴角，均为 35°；1 个夹角 70° |
| F5 | 椭圆，rx = 50，ry = 40 | 不出现 coverageDeg ＞ 180 的圆 |
| F6 | D：竖干 x 0–20，外弧 r = 50、内弧 r = 30（圆心 (20, 50)），y 0–100 | 竖笔画 20（"a"）；r = 50 与 r = 30 两圆同心，环厚 20（"a"）；y = 0 与 y = 100 为 baseline/flat（同一轮廓上的曲线证据不构成 mixed） |
| F7 | F1 的锚点沿径向交替偏移 ±0.8pt（手柄随锚点平移） | loose：1 个圆，半径误差 ≤ 1；strict：允许拆分或不识别，但不能报错 |
| F8 | 两行：上行 5 个矩形（宽 20、间距 20，y 0–100），下行 4 个矩形（宽 20、间距 20，y −150 到 −50） | 识别为 2 行；上行横向标签在上方车道，下行在下方车道 |
| F9 | I（x 0–20，y 0–100）+ O（外 r = 52、内 r = 32，圆心 (80, 50)） | y = 0、100 为 baseline/flat；y = 102、−2 为 visual/overshoot；O 的外圆 category 为 visual，内圆为 fitted；环厚 20（"a"） |
| F9b | I（同上）+ O（外 r = 50、内 r = 30，圆心 (80, 50)，无超出） | `mixedAsVisual` 为真时 y = 0、100 为 visual/mixed，O 的外圆为 visual；为假时为 baseline/mixed |
| F10 | 50 个部件，每个是 r = 20、由 40 段三次贝塞尔组成的圆，圆心间距 50，排成 5 行 × 10 列，共 2000 个锚点 | Node 中 `analyze` ＜ 300ms；无异常（允许出现采样数超限的警告） |
| F11 | 用 preview.js 把 F3 渲染成 SVG，再用 svg_import.js 导入（跳过 `lg-guides` 组） | 分析结果与 F3 一致 |

### 14.3 SVG 预览（tools/preview.js，P0）

- 输入 Geometry JSON 或 SVG，运行 `analyze`，输出 SVG：图形用浅灰色填充，叠加全部图元，颜色按 `stylePreset`。
- 坐标转换：SVG 的 y 向下，所以 Y = −y；文字旋转角取反。
- 输出结构：图形放在 id 为 `lg-geometry` 的组，图元放在 id 为 `lg-guides` 的组。svg_import.js 遇到 `lg-guides` 组时跳过。
- 开发中用 `chromium --headless --screenshot` 转成 PNG 检查：标签不重叠、线不缺失、圆贴合轮廓。

### 14.4 真实样例

用户可以把 logo 导出为 SVG，或用 LogoGuides_DumpGeometry.jsx 导出 JSON，放进 tools/samples/；用 run_fixture.js 生成预览。svg_import.js 需支持 path、rect、circle、ellipse、polygon、polyline、line 元素和 transform 属性（借助 svgpath 的 abs、unshort、unarc 处理绝对坐标、简写命令和弧线；二次贝塞尔按 C1 = P0 + 2/3·(Q1 − P0)、C2 = P2 + 2/3·(Q1 − P2) 升阶为三次）。

### 14.5 Illustrator 手动验收清单（用户执行）

1. RGB 和 CMYK 文档各运行一次"生成"，颜色正确。
2. 选中包含编组、复合路径、未轮廓化文字的 logo：生成成功，没有残留的临时轮廓副本。
3. 图层结构符合 10.1；辅助图层已锁定；activeLayer 仍是原来的图层。
4. 用直接选择工具移动一个锚点后运行"刷新"：辅助线更新，`a` 不变。
5. 只选中部分路径时运行"刷新"：仍然针对全部来源对象。
6. "清除"的三种模式结果正确。
7. CircleFromSelection：选 3 个以上锚点，圆生成在 LG Manual 中，刷新后仍然存在。
8. 中文界面和标注没有乱码。
9. 记录中等规模 logo（约 2000 个锚点）的生成耗时（目标 ≤ 15 秒；超出则列入阶段 2 的优化）。
10. `output` 为 "guides"：生成的是 Illustrator 参考线；记录拖动锚点时能否吸附到参考线。
11. 生成后按一次撤销（Ctrl/Cmd+Z），记录撤销的范围（整次生成还是单个对象），写入 [DECISIONS.md](http://DECISIONS.md)。
12. 复制（Alt/Option 拖动）一个来源对象后运行"刷新"，记录副本是否也被当作来源（标签是否随对象复制），写入 [DECISIONS.md](http://DECISIONS.md)。

## 15. 里程碑与任务

| 里程碑 | 内容 | 验收 |
| --- | --- | --- |
| M0 骨架与工具链（P0） | 目录结构、package.json、build.js、check_es3.js、node:test 框架（vm 加载 + 删除 ES5 API）、fixtures.js、preview.js、svg_import.js、[DECISIONS.md](http://DECISIONS.md) | `npm test` 通过（可先只有占位测试）；构建产物通过 ES3 检查；preview 能渲染 F1 的几何 |
| M1 几何读取与归一化 | core：config、util、vec、bezier、geometry、sample、ink、rows；host：env、read；脚本 DumpGeometry | bezier 单元测试（求值、导数、曲率、极值与解析值一致）；F1–F10 归一化正确；DumpGeometry 导出的 JSON 能被 Node 读取（用户验证） |
| M2 参考线与基础绘制 | core：edges、cluster、lines（含注册表）、styles、primitives（线、标签）、layout（辅助区域、线跨度；与车道相关的跨度在 M3 补全）；host：draw（图层、线、文字、颜色）、store（文档数据、标签） | F3、F6、F8、F9、F9b 的线分类正确；预览正确；临时版 Generate 能在 Illustrator 中画出基准线（用户验证） |
| M3 笔画、间距、a、倍率标注 | core：stems、baseunit、ratios、layout（车道、模块方块） | F3、F4（笔画部分）、F6（竖笔画部分）、F8 的数值和标签正确；吸附和 severity 正确；预览中标签不重叠。F2 依赖环厚度兜底，在 M4 验收 |
| M4 辅助圆 | core：circles（分段、拟合、合并、覆盖、环、分类、评分）、偏差标记；脚本 CircleFromSelection | F1、F2、F5、F6、F7、F9 正确；F10 性能达标 |
| M5 角度、构造线、目标线、图例、安全区 | core：angles、目标线、图例、安全区 | F4 角度正确；F3 吸附场景下目标线位置正确；图例只列出实际出现的类别 |
| M6 阶段 1 整合，发布 v0.1 | 对话框、全局设置、Refresh、Clear、SetBaseUnit、摘要、日志、错误处理、USER_[GUIDE.md](http://GUIDE.md)（安装、使用、参数说明） | 14.1 全部通过；14.5 清单由用户确认 |
| M7 阶段 2：CEP 面板 v0.2 | manifest、面板 UI、宿主函数、计算迁移到面板、特征列表、可见性与匹配、精选模式、样式切换 | 同一输入下面板版与脚本版的图元一致（类型、数量相同，数值差 ≤ 1e-6）；约 2000 锚点刷新 ≤ 3 秒 |
| M8 阶段 3：AI v0.3 | 设置页（提供商、baseUrl、模型、key）、摘要生成、调用、校验、应用、回退 | 模拟响应（含非法 id、越界 target、非 JSON）都被正确处理；真实调用成功一次 |
| M9 打包与文档 v1.0 | ZXP 签名、安装说明、版本号、CHANGELOG | 用户在一台干净的机器上按文档安装成功 |

USER_[GUIDE.md](http://GUIDE.md) 需包含：脚本安装位置（Windows：`C:\Program Files\Adobe\Adobe Illustrator 版本\Presets\zh_CN\脚本`；macOS：`/Applications/Adobe Illustrator 版本/Presets.localized/zh_CN/脚本`，重启后出现在"文件 › 脚本"菜单），或用"文件 › 脚本 › 其他脚本"直接运行；如何用动作面板的"插入菜单项"给脚本设置快捷键；settings.json 的位置和可调参数。

## 16. 编码规范与 ExtendScript 注意事项

### 16.1 ES3 规则（core 与 host 必须遵守）

- 只用 `var` 和 `function`。禁止 let/const、箭头函数、class、模板字符串、解构、展开运算符、默认参数、for…of、getter/setter。
- 数组和对象字面量禁止尾随逗号。
- 禁止把保留字（包括 ES3 的未来保留字，如 class、enum、int、char、byte、long、short、float、double、final、native、goto、public、static）用作变量名、函数名、点语法属性名或对象字面量的键。需要时写成 obj["default"] 或 { "default": 1 }。
- 禁用 API：Array.prototype 的 forEach、map、filter、reduce、reduceRight、some、every、indexOf、lastIndexOf、find、findIndex、includes、fill；Array.isArray、Array.from；Object.keys、Object.create、Object.defineProperty、Object.assign、Object.entries、Object.values；Function.prototype.bind；String.prototype 的 trim、startsWith、endsWith、includes、repeat、padStart、padEnd；JSON（改用 `LG.json`）；[Date.now](http://Date.now)；Math.hypot、Math.sign、Math.trunc、Math.log2；Number.isFinite、Number.isNaN；Promise、Map、Set、WeakMap、Symbol。需要时使用 `LG.util` 中的等价函数；这些函数不得与禁用的原型方法同名（用 mapArr、filterArr、trimStr 等），否则会被 16.2 误报。
- 模块写法：`LG.xxx = (function () { ... return { ... }; })();`
- core 不得访问 app、document、File、Folder、`$` 等宿主对象。

### 16.2 ES3 检查（tools/check_es3.js）

- 用 acorn 以 `{ ecmaVersion: 3, allowReserved: "never" }` 解析每个产物，语法错误即失败。"never" 使保留字用作属性名时也报错（acorn 在 ES3 模式下默认允许）。
- 递归遍历 acorn 生成的 AST（不需要 acorn-walk），检查 16.1 中的禁用 API：原型方法（如 forEach、trim）按成员访问的属性名匹配；静态方法（如 Array.isArray、Object.keys、[Date.now](http://Date.now)、Math.hypot）按"对象名 + 属性名"匹配；禁用全局名（JSON、Promise、Map、Set、WeakMap、Symbol）按标识符引用匹配。用 AST 而不用正则，注释和字符串里的同名单词不会误报。`indexOf`、`lastIndexOf` 除外，因为字符串也有这两个方法；数组误用由 14.1 的测试环境发现。确需调用同名的宿主 DOM 方法（如 ScriptUI 的 ListBox.find）时，在该行末尾加注释 `// es3-ok` 跳过检查。

### 16.3 ExtendScript / Illustrator 要点

- 构建产物中的非 ASCII 字符一律转义为 `\uXXXX`。
- 入口代码包在 IIFE 中，不污染全局（阶段 2 的宿主暴露函数除外）。
- 读取 pathPoints 时缓存集合和长度，避免在循环中重复访问 DOM 属性。
- 修改锁定的图层前先解锁，结束后在 finally 中恢复。
- 新建图层后恢复 `doc.activeLayer`。
- ScriptUI 用 "dialog" 类型。从"文件 › 脚本"运行时，"palette" 类型的窗口会立即关闭。
- `getByName` 找不到对象时会抛异常，必须 try/catch。
- 坐标可能是负数，注意 `geometricBounds` 的顺序（6.1）。
- 撤销：脚本对撤销历史的影响需要实测（14.5 第 11 项）。"清除"是可靠的回退手段；阶段 2 一次刷新只调用一次绘制。

### 16.4 代码质量

- 每个 core 函数注释输入和输出。
- 算法中的阈值一律从 `LG.config.resolve(settings)` 读取，不硬编码。新增参数必须同时更新第 7 节和 config.js。
- 特征 id 按类别前缀加序号：L（线）、S（笔画）、G（间距）、H（高度）、W（字怀）、C（圆）、R（环）、A（角度）、K（构造线）。

## 17. 风险与已知限制

- 贝塞尔曲线不是真正的圆，拟合必然有误差：输出偏差，并用容差控制。
- 椭圆形曲线会被拆成多段小圆弧，或识别不出来。
- 包围盒间距不等于视觉间距。
- 候选线可能过多：用数量上限、精选模式或 AI 筛选，以及手动删除来控制。
- "红线"（视觉对齐）的语义由规则判断，可能与设计师意图不同：可关闭 `mixedAsVisual`，也可手动改色。
- 偏差统一以 pt 显示，不随文档标尺单位变化。
- 每个文档只维护一套辅助线（一个 "Logo Guides" 图层和一组来源）。
- 3 行以上的字标，中间行上方的标注可能与上一行重叠（写入警告，用户手动调整）。
- ExtendScript 性能有限：阶段 2 把计算移到面板。
- 文字自动轮廓化依赖 `createOutline`，个别字体可能失败：提示用户手动轮廓化。
- 复制来源对象时，`LG_SOURCE` 标签可能随之复制，刷新会把副本也当作来源：重新运行"生成"即可（实际行为见 14.5 第 12 项）。
- 参考线模式能否吸附取决于 Illustrator 的设置，需要实测。
- CEP 长期会被 UXP 取代（Illustrator UXP 预计 2027 年春季公测）：核心库已与宿主解耦。

## 18. 待确认事项（无答复时按默认执行）

| 问题 | 默认 |
| --- | --- |
| Illustrator 版本与操作系统 | 2021 及以上，Windows 和 macOS 都支持 |
| 界面语言 | 中文（可切换英文） |
| 默认样式 | 深色（参考图 1–3 的风格） |
| 基准单位符号 | 小写 a |
| 是否自动对文字临时轮廓化 | 开启 |
| 红线是否包含曲线与直线的对齐（`mixedAsVisual`） | 开启 |
| AI 提供商 | OpenAI 兼容接口 + Anthropic，由用户填写 |

## 附录 A：公式

```
三次贝塞尔：
  B(t)  = (1−t)³P0 + 3(1−t)²t·P1 + 3(1−t)t²·P2 + t³·P3
  B′(t) = 3(1−t)²(P1−P0) + 6(1−t)t(P2−P1) + 3t²(P3−P2)
  B″(t) = 6(1−t)(P2−2P1+P0) + 6t(P3−2P2+P1)

有符号曲率（κ > 0 表示向左转，即逆时针）：
  κ = (x′y″ − y′x″) / (x′² + y′²)^(3/2)
  曲率中心 = p + N/κ，其中 N = (−Ty, Tx)

极值：对某个分量 f，解 a·t² + b·t + c = 0
  a = 3(−P0 + 3P1 − 3P2 + P3)
  b = 6(P0 − 2P1 + P2)
  c = 3(P1 − P0)
  a ≈ 0 时按一次方程求解；只取 0 < t < 1 的根

Kåsa 圆拟合（先减去均值 x̄、ȳ；u = x − x̄，v = y − ȳ）：
  Suu = Σu²   Svv = Σv²   Suv = Σuv
  Suuu = Σu³  Svvv = Σv³  Suvv = Σu·v²  Svuu = Σv·u²
  解方程组：
    Suu·uc + Suv·vc = (Suuu + Suvv) / 2
    Suv·uc + Svv·vc = (Svvv + Svuu) / 2
  圆心 = (x̄ + uc, ȳ + vc)
  r = sqrt(uc² + vc² + (Suu + Svv) / n)

Levenberg–Marquardt 几何拟合：参数 (cx, cy, r)
  di = |pi − c|，残差 ei = di − r
  雅可比行 = [ −(xi − cx)/di, −(yi − cy)/di, −1 ]
  解 (JᵀJ + λ·diag(JᵀJ))·Δ = −Jᵀe
  误差平方和下降则接受并 λ = λ/10，否则拒绝并 λ = λ×10；初始 λ = 1e-3

圆弧转贝塞尔：每段圆心角 φ ≤ 90°，手柄长度 k = (4/3)·tan(φ/4)·r

线段裁剪：Liang–Barsky
点在多边形内：even-odd 射线法
```

## 附录 B：样式预设

宽度和虚线的单位是 u（7.4）。"实线"表示 strokeDashes 为空数组。

### 深色（dark，参考图 1–3 风格）

| style | 描边色 | 宽度 | 虚线 | 不透明度 | 填充 |
| --- | --- | --- | --- | --- | --- |
| baseline | #CCCCCC | 1 | 3, 2 | 80 | 无 |
| dimension | #CCCCCC | 1 | 3, 2 | 80 | 无 |
| visual | #E5484D | 1.2 | 实线 | 100 | 无 |
| construction | #CCCCCC | 0.7 | 实线 | 50 | 无 |
| circleFitted | #CCCCCC | 1 | 3, 2 | 80 | 无 |
| circleVisual | #E5484D | 1.2 | 实线 | 100 | 无 |
| angleArc | #CCCCCC | 0.8 | 2, 2 | 80 | 无 |
| angleRef | #CCCCCC | 0.8 | 2, 2 | 60 | 无 |
| measureBar | #CCCCCC | 1 | 实线 | 90 | 无 |
| target | #FF9F43 | 1.2 | 4, 2 | 100 | 无 |
| devMarker | 无 | — | — | 100 | #FF9F43 |
| moduleSquare | 无 | — | — | 45 | #E5484D |
| clearFrame | #CCCCCC | 1 | 实线 | 80 | 无 |
| clearSquare | 无 | — | — | 60 | #969696 |
| text | — | — | — | 100 | #E6E6E6 |
| textWarn | — | — | — | 100 | #FF9F43 |
| textBad | — | — | — | 100 | #E5484D |
| background | 无 | — | — | 100 | #333333 |

### 浅色（light，参考图 4 风格）

与深色相同的键，只替换颜色和不透明度：

| style | 颜色 | 不透明度 |
| --- | --- | --- |
| baseline、dimension、circleFitted、angleArc、angleRef、measureBar、clearFrame | #8C8C8C（描边） | 同深色 |
| construction | #8C8C8C（描边） | 60 |
| visual、circleVisual | #A3745F（描边） | 100 |
| target | #D9822B（描边） | 100 |
| devMarker | #D9822B（填充） | 100 |
| moduleSquare | #A3745F（填充） | 70 |
| clearSquare | #B4ABA4（填充） | 80 |
| text | #222222（填充） | 100 |
| textWarn | #D9822B（填充） | 100 |
| textBad | #C0392B（填充） | 100 |
| background | #F0EEEB（填充） | 100 |