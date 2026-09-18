# Contributing

感谢参与。提交代码或文档前，请先阅读：

- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)：架构、构建、测试和贡献约定。
- [`docs/OPEN_FORMATS.md`](docs/OPEN_FORMATS.md)：数据目录、标签和坐标协议。
- [`docs/RELEASE.md`](docs/RELEASE.md)：发布包、公开测试数据和许可检查。

## 提交前检查

- 不提交真实点云、标签、日志、账号、令牌或本机绝对路径。
- 功能改动同时更新中英文 README 或对应详细文档；界面文字同时维护中文和 English。
- 修改数据扫描、姿态、标签保存或导出协议时，补充相应的格式说明和回归测试。
- 修改 Windows 启动器或服务生命周期时，验证启动、重复启动、停止、退出和端口切换。
- 不把 `frontend/dist`、构建目录、Qt 运行库或完整 Windows 包提交到源码历史。

提交 Pull Request 时，请在描述中说明改动范围、验证方式以及是否涉及数据格式或许可证边界。
