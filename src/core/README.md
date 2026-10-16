# Core 模块

纯函数、ES3、无宿主依赖。M1 几何基础已验收；M2 新增 cluster/edges/lines/layout/styles/primitives 与阶段 analyze，只输出真实检测到的参考线。后续测量数组为空，自动 a 暂为 null，不生成模拟分析。

原文第 5、15 节规定的模块按以下阶段建立，不预先创建无功能源码：

| 阶段 | 模块 |
| --- | --- |
| M0 | 00_ns.js |
| M1 | 01_json2.js、02_util.js、03_config.js、04_vec.js、05_bezier.js、06_geometry.js、07_sample.js、08_ink.js、10_rows.js |
| M2 | 09_cluster.js、11_edges.js、12_lines.js、18_layout.js（基础）、19_styles.js、20_primitives.js（线/标签）、21_pipeline.js（阶段能力） |
| M3 | 13_stems.js、16_baseunit.js、17_ratios.js；补全 layout/流水线 |
| M4 | 14_circles.js；补全圆图元、环厚度兜底与流水线 |
| M5 | 15_angles.js；补全目标线、图例、安全区与图元 |

数据结构与设置完全遵循 docs/DEV_PLAN.md 第 6、7 节；完整 analyze 返回 `{ analysis, render }`。
