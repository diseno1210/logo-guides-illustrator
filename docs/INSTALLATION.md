# 安装、升级与回退

当前功能版本0.3.0（M0–M8已验收）。M9提供Windows签名预验包，干净机器安装尚待用户验证；v1.0未发布。下载源码时不会包含dist制品，需要开发者构建或另行取得签名交付目录。

## 环境与交付目录

CEP manifest声明Illustrator25.0–99.9、CEP11及以上；这是加载范围，实际功能目前仅在Windows Illustrator30.0.0/CEP12实测。macOS安装路径列在下文，但尚未实测；不要将Windows签名验收包作为已通过macOS兼容测试的制品。

签名交付目录包含`logo-guides-0.3.0-win32.zxp`、六份`scripts/*.jsx`、使用说明、变更记录、`release.json`与`SHA256SUMS`。终端运行插件无需Node/npm；只有从源码构建和打包时需要Node20+与锁定开发依赖。

先核对ZXP的SHA256与交付记录一致，Windows示例：

```powershell
Get-FileHash -LiteralPath '完整路径/logo-guides-0.3.0-win32.zxp' -Algorithm SHA256
```

签名是项目本地自签名证书，不代表Adobe认证或操作系统信任。`release.json`记录证书和工具hash、签名验证结果、文件清单、构建提交与时间戳情况；没有时间戳的包在证书到期后需重新签名，不承诺长期有效。证书信息中的撤销检查跳过，不代表在线吊销状态已验证。

## 安装CEP面板

1. 保存并关闭Illustrator。干净机器不得预装本项目开发目录，不开启`PlayerDebugMode`，不复制`.debug`。如有旧开发版，先退出宿主并将`local.logoguides.panel`移至CEP搜索目录之外备份，避免加载到旧版。
2. 从[Adobe官方安装说明](https://github.com/Adobe-CEP/Getting-Started-guides/tree/master/Package%20Distribute%20Install#installing-the-zxp-packaged-extension)选择ExManCmd或第三方安装器，例如该说明链接的Anastasiy Extension Manager。只从官方来源获取安装器。不要将ZXP改名解压后作为正式安装，也不要用开启调试模式掩盖签名错误。
3. 使用安装器选择ZXP安装；安装器可能请求系统权限。若选择ExManCmd，Windows命令为：

   ```powershell
   & 'ExManCmd完整路径/ExManCmd.exe' --install 'ZXP完整路径/logo-guides-0.3.0-win32.zxp'
   & 'ExManCmd完整路径/ExManCmd.exe' --list all
   ```

   macOS对应`./ExManCmd --install /完整路径/包名.zxp`。ExManCmd由[Adobe下载入口](https://www.adobe.com/go/ExManCmdWin)获取，macOS为[此入口](https://www.adobe.com/go/ExManCmdMac)；如入口失效，可使用上述官方指南列出的安装器。
4. 重启Illustrator，在“窗口 → 扩展 → Logo Guides”打开。版本显示v0.3；创建空白测试文档，画两个不同宽度的实心矩形，选中并生成，确认有辅助线和特征列表。
5. 移动一个来源锚点，点“刷新来源”；确认辅助线更新且锁定a保持不变。保存测试文件，关闭再打开面板，确认连接正常。AI为可选，安装验收不需要填写密钥或产生付费请求。
6. 对照[干净机器验收表](acceptance/M9.md)回报系统、Illustrator/CEP和安装器版本、ZXP hash与结果。安装成功只证明当前平台/版本，其他环境仍待验证。

开发目录常见路径：Windows `%APPDATA%/Adobe/CEP/extensions/local.logoguides.panel`；macOS `~/Library/Application Support/Adobe/CEP/extensions/local.logoguides.panel`。安装器也可能安装到系统级目录，升级/卸载应交给同一个安装器管理。

## 脚本安装

可直接在Illustrator“文件 → 脚本 → 其他脚本”选择`scripts/LogoGuides_Generate.jsx`。固定菜单安装时复制全部六份JSX并重启：

- Windows：`C:\Program Files\Adobe\Adobe Illustrator 版本\Presets\zh_CN\脚本`。
- macOS：`/Applications/Adobe Illustrator 版本/Presets.localized/zh_CN/脚本`。

动作面板中选择“插入菜单项”，插入相应脚本并设置功能键。脚本与面板使用同份core/host；面板的AI建议只在CEP中提供。全部操作和参数见[使用说明](USER_GUIDE.md)。

## 升级、卸载和回退

- 升级前保存AI文件并备份旧签名交付目录，以及用户目录`LogoGuides/settings.json`；有AI配置时自行备份`ai.json`，不要发送给他人。用户目录在Windows通常为`%APPDATA%/LogoGuides`，macOS以Illustrator的`Folder.userData/LogoGuides`为准。
- 关闭Illustrator，使用原安装器卸载旧包，再安装新包。ExManCmd先用`--list all`核对实际扩展名称，按其帮助使用`--remove`，不要按未核对的ID删除。开发版与签名版勿同时保留。
- 单独脚本升级时替换原六份JSX并重启。卸载时删除自己安装的六份JSX；CEP用安装器卸载。用户配置和已有AI文件中的辅助图层保留，如需清除请使用插件Clear。
- 回退时关闭Illustrator，用同一安装器卸载新版并安装备份旧包，再还原备份设置。需要旧版本继续编辑的AI文件应事先另存副本，尚不承诺未来数据格式可逆迁移。不要为回退删除用户原稿。

## 故障排查

- 菜单找不到：确认宿主支持CEP、安装器报告成功、没有同ID开发扩展，并完全重启Illustrator。收集版本、安装器错误码与ZXP hash。
- 面板空白/签名错误：重新核对包hash与签名，先排除重复安装及过期证书。Adobe记录了[跨平台签名与符号链接问题](https://github.com/Adobe-CEP/CEP-Resources/blob/ab5e4e3e53a42fad08e1225a22a991bb1ffe73f6/ZXPSignCMD/KnownIssue2024.md)；本工具拒绝符号链接并在目标Windows平台签名。仍失败时保留安装器和CEP日志，回报失败，不启用调试模式将其记为通过。
- 连接/生成失败：打开文档并选择支持的路径/文字，查看`LogoGuides/log.txt`。旧文档请先“连接当前文档”。
- AI失败不影响基础安装验收；检查本机配置，不提交或分享`ai.json`、API key、证书或密码。

## 从源码签名（开发者）

先`npm ci`、`npm test`、`npm run build`、`npm run check:es3`。获取[Adobe ZXPSignCmd4.1.3](https://github.com/Adobe-CEP/CEP-Resources/tree/ab5e4e3e53a42fad08e1225a22a991bb1ffe73f6/ZXPSignCMD/4.1.3)的目标平台工具。Windows x64本轮实测SHA256为`ffc2223167225ce61d024eb463fc5ad1a1be16133f99ef334a646f7311916c98`；工具不随源码或发行包分发。

PowerShell中设置`LG_ZXP_SIGNER`为工具绝对路径、`LG_CERT_PATH`为本机`.cache/signing/logo-guides.p12`。交互读取密码，避免把明文键入命令历史：

```powershell
$env:LG_ZXP_SIGNER = (Resolve-Path '.cache/m9/ZXPSignCmd.exe').Path
$env:LG_CERT_PATH = Join-Path $PWD '.cache/signing/logo-guides.p12'
$localSigningSecret = Read-Host '证书密码（至少16字符）' -AsSecureString
$localSigningPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($localSigningSecret)
try {
    $env:LG_CERT_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($localSigningPointer)
    node tools/release.js cert
    node tools/release.js pack --tsa https://timestamp.digicert.com
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($localSigningPointer)
    Remove-Item Env:LG_CERT_PASSWORD -ErrorAction SilentlyContinue
}
```

`cert`仅首次执行，拒绝覆盖现有证书；以后保留同一证书/密码，只运行`pack`。密码需另存安全位置；官方工具要求通过进程参数接收密码，工具不会打印这些参数。不要提交证书或密码。时间戳服务不可用时打包失败，不静默降级；预验阶段可显式加`--no-timestamp`生成有期限的包，记录限制后验收。

`pack`重建干净暂存目录，校验版本和固定清单、ES3/ASCII，签名后执行两次验证并比较ZIP内原始字节；全部通过才发布到`dist/releases/logo-guides-版本-平台`。已有目标目录时拒绝覆盖，可用`--out dist/releases/新目录`。Git有未提交改动时报告`sourceDirty:true`，最终交付应从已提交的干净源码重新打包。签名时间使ZXP hash变化；不宣称签名包字节可重复。

独立校验：`node tools/release.js verify --out dist/releases/交付目录/包名.zxp`（同样需`LG_ZXP_SIGNER`）。`release.json`提供构建输入的逐文件hash与实际ZXP hash，`SHA256SUMS`覆盖交付文件。打包不调用Git push、不改全局配置、不安装或替换开发扩展、不生成tag。
