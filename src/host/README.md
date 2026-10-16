# Illustrator 宿主层

M1 的 h01_env.js / h02_read.js 选区读取和实际导出已验收。M2 新增 h03_store.js / h04_draw.js：文档数据、来源标签、图层/线/多行文字/颜色绘制，临时 Generate 已接通。自动化使用 DOM mock；M2 真实 Illustrator 基准线绘制待用户验收。M6 实施 h05_i18n.js / h06_dialog.js 及交互整合。

源码必须 ES3。临时轮廓、activeLayer、图层锁定通过 try/finally 恢复。宿主实测由原文 14.5 清单单独验收。
