# 阶段 1 脚本

M6已构建Generate、Refresh、Clear、SetBaseUnit、CircleFromSelection和DumpGeometry六个入口；入口仅负责文档检查、调用对应宿主流程和异常报告。实际功能在共享core与host中实现。

使用与验收见docs/USER_GUIDE.md、docs/acceptance/M6.md。M6尚待用户实测；P2可选Measure未实现，没有生成无功能脚本。
