# LinkSwift 网盘直链下载助手 - Gopeed 扩展

将 LinkSwift 用户脚本移植为 Gopeed 扩展，支持八大网盘的直链提取。

## 支持的网盘

- 百度网盘 (pan.baidu.com, yun.baidu.com)
- 阿里云盘 (aliyundrive.com)
- 天翼云盘 (cloud.189.cn)
- 迅雷云盘 (pan.xunlei.com)
- 夸克网盘 (drive.quark.cn)
- UC网盘 (uc.cn)
- 123云盘 (123pan.com, 123pan.cn)
- 中国移动云盘 (yun.139.com)

## 安装步骤

1. 打开 Gopeed，进入扩展页面。
2. 连续点击安装按钮 5 次，开启开发者模式。
3. 点击“从本地安装”，选择本扩展目录（`gopeed-linkSwift-extension`）。
4. 安装完成后，扩展即可生效。

## 配置说明

扩展需要配置各网盘的认证信息，在 Gopeed 扩展设置页面中填写：

| 设置项 | 说明 | 获取方式 |
|--------|------|----------|
| `baidu_token` | 百度网盘 Access Token | 登录百度网盘后，从浏览器开发者工具中获取 |
| `aliyun_token` | 阿里云盘 Token (Bearer) | 登录阿里云盘后，从 API 请求头中获取 |
| `tcloud_session` | 天翼云盘 Session ID | 登录天翼云盘后，从 Cookie 中获取 `session` 值 |
| `xunlei_token` | 迅雷云盘 Access Token | 登录迅雷云盘后，从 API 请求头中获取 |
| `quark_cookie` | 夸克网盘 Cookie 字符串 | 登录夸克网盘后，从浏览器 Cookie 中获取完整字符串 |
| `uc_cookie` | UC 网盘 Cookie 字符串 | 登录 UC 网盘后，从浏览器 Cookie 中获取完整字符串 |
| `pan123_token` | 123 云盘 Token | 登录 123 云盘后，从 API 请求头中获取 |
| `mcloud_cookie` | 中国移动云盘 Cookie 字符串 | 登录移动云盘后，从浏览器 Cookie 中获取完整字符串 |

**注意**：未配置认证信息的网盘将无法获取直链。建议只配置你需要使用的网盘。

## 使用方法

在 Gopeed 中创建任务时，粘贴网盘分享链接或文件页面链接，扩展会自动解析并返回文件下载链接。

支持的链接格式示例：
- 百度分享: `https://pan.baidu.com/s/xxxxx`
- 阿里云盘分享: `https://www.aliyundrive.com/s/xxxxx`
- 天翼云盘: `https://cloud.189.cn/web/file?fileId=xxxxx`
- 迅雷云盘: `https://pan.xunlei.com/drive/v1/files/xxxxx`
- 夸克网盘: `https://drive.quark.cn/file/xxxxx`
- UC网盘: `https://uc.cn/file/xxxxx`
- 123云盘: `https://www.123pan.com/s/xxxxx` 或 `https://www.123pan.com/file/xxxxx`
- 移动云盘: `https://yun.139.com/file/xxxxx`

## 调试

扩展日志输出在 Gopeed 安装目录的 `logs/extension.log` 中，可通过 `tail -f extension.log` 实时查看。

## 免责声明

本扩展仅供学习和研究使用，请勿用于非法用途。使用本扩展产生的任何问题由用户自行承担。
