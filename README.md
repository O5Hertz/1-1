# MoonBazaar 问卷自动化脚本

一个基于 Node.js 的 MoonBazaar 问卷自动填写工具，使用 AI 生成答案并自动提交高价值问卷。

## 功能特点

- 🤖 **AI 智能答题**：自动接入免费 AI API 生成合理的问卷答案
- 📊 **动态筛选**：从实时数据流中识别高价值问卷（基于奖励分值）
- 🔄 **自动运行**：批量处理问卷，自动设置请求间隔避免检测
- 📈 **数据统计**：记录运行次数、成功率和累计完成问卷数
- 📱 **微信推送**：通过 Server 酱推送运行报告到微信
- 🛡️ **多重备用**：AI 服务不可用时自动切换到本地智能备用方案

## 环境要求

- Node.js 14.0 或更高版本
- 有效的 MoonBazaar 网站 Cookie
- （可选）Server 酱 SendKey 用于微信推送

## 安装步骤

### 1. 克隆或下载项目

```bash
cd moonbazaar-automation
```

### 2. 配置环境变量（可选）

如果需要微信推送功能，设置以下环境变量：

```bash
export WEIXIN_TUISONG=你的 Server 酱 SendKey
```

### 3. 更新配置

编辑 `moonbazaar-automation.js` 文件中的 `CONFIG` 对象：

```javascript
const CONFIG = {
    COOKIE: '你的有效 Cookie',  // 从浏览器开发者工具获取
    TARGET_SUCCESS_COUNT: 8,    // 触发报告推送的成功次数阈值
    SURVEYS_PER_RUN: 10,        // 每次运行处理的问卷数量
    HIGH_VALUE_THRESHOLD: 0.5   // 高价值问卷的分值阈值
};
```

## 使用方法

### 直接运行

```bash
node moonbazaar-automation.js
```

### 添加执行权限（可选）

```bash
chmod +x moonbazaar-automation.js
./moonbazaar-automation.js
```

### 定时运行（推荐）

使用 cron 设置定时任务，例如每 30 分钟运行一次：

```bash
crontab -e
```

添加以下行：

```
*/30 * * * * cd /path/to/moonbazaar-automation && node moonbazaar-automation.js >> automation.log 2>&1
```

## 配置说明

### 主要配置项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `COOKIE` | - | MoonBazaar 网站的登录 Cookie |
| `TARGET_SUCCESS_COUNT` | 8 | 累计成功多少次后发送微信报告 |
| `SURVEYS_PER_RUN` | 10 | 每次运行最多处理多少个问卷 |
| `HIGH_VALUE_THRESHOLD` | 0.5 | 高价值问卷的最低分值阈值 |

### Cookie 获取方法

1. 打开浏览器访问 MoonBazaar 网站并登录
2. 按 F12 打开开发者工具
3. 切换到 Network（网络）标签
4. 刷新页面，找到任意请求
5. 在 Request Headers 中找到 `Cookie` 字段
6. 复制完整的 Cookie 字符串到配置中

### Server 酱配置

1. 访问 [Server 酱官网](https://sct.ftqq.com/)
2. 注册并绑定微信
3. 获取 SendKey
4. 设置为环境变量 `WEIXIN_TUISONG`

## 运行日志示例

```
=== MoonBazaar 自动化脚本启动 ===

检查网站连接...
连接正常

获取问卷列表...
从实时动态发现 15 个活跃提供商：TappX, AdGem, ...
找到 15 个问卷

筛选出 8 个高价值问卷（>= 0.5 分）

[1/8] 处理：TappX Survey (分值：2.50)
  正在请求 AI 生成答案...
    尝试 AI 服务：Pollinations-Text (超时:10000ms)
    Pollinations-Text 响应成功
  模拟提交问卷...
  提交成功

  等待 3 秒后继续...

...

本次完成：7/8 份问卷
累计成功次数：3/8
```

## 数据存储

脚本会自动创建 `automation_data.json` 文件，记录以下信息：

- `totalRuns`: 总运行次数
- `successfulRuns`: 成功运行次数
- `totalSurveysCompleted`: 累计完成的问卷数量
- `runHistory`: 最近 100 次运行记录

## 注意事项

⚠️ **重要提示**：

1. **Cookie 时效性**：Cookie 可能会过期，需要定期更新
2. **使用频率**：建议合理设置运行间隔，避免过于频繁被检测
3. **网络环境**：确保能够访问 MoonBazaar 网站和 AI API 服务
4. **风险提示**：自动化操作可能违反网站服务条款，请谨慎使用

## 故障排除

### 常见问题

**1. 连接失败**
- 检查网络连接
- 验证 Cookie 是否有效
- 确认网站是否可访问

**2. AI 服务无响应**
- 脚本会自动切换到本地备用方案
- 检查网络是否能访问外部 API

**3. 问卷提交失败**
- Cookie 可能已过期
- 网站结构可能已变更
- 检查控制台错误信息

### 调试模式

在脚本开头添加更多日志输出：

```javascript
// 在 HttpClient 类中添加详细日志
console.log('请求 URL:', url);
console.log('请求头:', options.headers);
```

## 技术架构

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│                 │     │              │     │                 │
│  MoonBazaar     │ ◄─► │  Automation  │ ◄─► │  AI Services    │
│  Website        │     │  Controller  │     │  (Pollinations) │
│                 │     │              │     │                 │
└─────────────────┘     └──────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │              │
                        │  Data Store  │
                        │  (JSON File) │
                        │              │
                        └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │              │
                        │ Push Service │
                        │ (Server 酱)   │
                        │              │
                        └──────────────┘
```

## 许可证

本项目仅供学习研究使用。使用本脚本产生的任何后果由使用者自行承担。

## 更新日志

- **v1.0** - 初始版本
  - 基础自动化功能
  - AI 答案生成
  - 数据统计和推送

---

*MoonBazaar 自动化脚本 - 让问卷填写更智能*
