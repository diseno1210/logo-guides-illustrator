# Illustrator 宿主层

M0 尚未调用 Illustrator DOM。按原文顺序实施：M1 h01_env.js / h02_read.js；M2 h03_store.js / h04_draw.js；M6 h05_i18n.js / h06_dialog.js 及交互整合。

源码必须 ES3。临时轮廓、activeLayer、图层锁定通过 try/finally 恢复。宿主实测由原文 14.5 清单单独验收。
