# CEP 面板（M8，M9签名进行中）

M7 面板骨架、V8 控制器、CEP11 manifest、宿主桥接和特征模型已实现，M8 AI建议与真实CEP/Illustrator验证已完成。执行 `npm run build` 后，开发扩展产物位于 `dist/panel/`，可复制到 `%APPDATA%/Adobe/CEP/extensions/local.logoguides.panel/` 进行本机调试。面板计算复用同一份 core，宿主只负责 Geometry 读取、一次性绘制、文档数据和特征显隐。

M9签名发布工具位于`tools/release.js`，项目ZXP及干净机器安装尚未完成；不要把开发目录或PlayerDebugMode当作发布安装。
