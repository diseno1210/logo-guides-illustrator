# Illustrator 宿主层

M1 已实现 h01_env.js / h02_read.js：选区读取、临时转曲、UTF-8 导出及日志。自动化使用 DOM mock；真实 Illustrator 尚待用户验收。后续 M2 实施 h03_store.js / h04_draw.js；M6 实施 h05_i18n.js / h06_dialog.js 及交互整合。

源码必须 ES3。临时轮廓、activeLayer、图层锁定通过 try/finally 恢复。宿主实测由原文 14.5 清单单独验收。
