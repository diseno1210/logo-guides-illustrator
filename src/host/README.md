# Illustrator 宿主层

按原文第5节组织为h01_env、h02_read、h03_store、h04_draw、h05_i18n、h06_dialog。M6自动验证通过，待第14.5节真实宿主验收。h04包含图元绘制与手动圆边界；h06包含ScriptUI窗口和Generate/Refresh/Clear/SetBaseUnit交互流程。所有宿主API访问都延迟到函数调用时，不在模块加载阶段执行。

源码必须 ES3。临时轮廓、activeLayer、图层锁定通过 try/finally 恢复。宿主实测由原文 14.5 清单单独验收。
