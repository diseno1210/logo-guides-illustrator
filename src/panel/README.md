# CEP 面板（M7）

M7 面板骨架、V8 控制器、CEP11 manifest、宿主桥接和特征模型已实现。执行 `npm run build` 后，扩展产物位于 `dist/panel/`，可复制到 `%APPDATA%/Adobe/CEP/extensions/local.logoguides.panel/` 进行本机调试。面板计算复用同一份 core，宿主只负责 Geometry 读取、一次性绘制、文档数据和特征显隐。

M7 的自动验证和原生桥接探针已通过；真实 CEP 面板 UI 的打开和 Illustrator 交互仍待完成，未将其标记为 M7 已验收。M8 AI 与 P2 自动刷新不在当前范围。
