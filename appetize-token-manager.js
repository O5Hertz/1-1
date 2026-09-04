#!/usr/bin/env node
/**
 * 脚本名称: appetize-token-manager.js
 * 用途: 管理 Appetize.io API 令牌并生成报告推送至微信
 * 
 * 说明:
 * - Appetize.io 不支持通过 API 自动注册账号，需要手动在官网注册
 * - API 令牌需要在组织设置中手动创建 (https://appetize.io/organization/api-tokens)
 * - 本脚本用于验证令牌有效性、测试云端安卓环境并生成报告
 * 
 * 环境变量:
 * - ANZHUOLINGPAISHULIANG: 需要验证的令牌数量 (可选，默认为 1)
 * - WEIXIN_TUISONG: Server酱 SendKey，用于微信推送
 * - APPETIZE_TOKENS: 逗号分隔的 Appetize API 令牌列表 (可选)
 * 
 * 内置测试令牌: tok_oewikghaqkplnadl32zlnn5fee (时长限制 30 分钟)
 */

const https = require('https');
const http = require('http');

// 配置
const CONFIG = {
    // 内置测试令牌 (用户提供的令牌)
    DEFAULT_TOKEN: 'tok_oewikghaqkplnadl32zlnn5fee',
    API_BASE_URL: 'https://api.appetize.io',
    API_V1_PATH: '/v1',
    API_V2_PATH: '/api/v2',
    // Server酱推送地址
    SERVERCHAN_URL: 'https://sctapi.ftqq.com',
    // 请求超时时间 (毫秒)
    REQUEST_TIMEOUT: 30000,
    // 并发请求延迟 (毫秒)
    REQUEST_DELAY: 1000
};

// 从环境变量获取配置
const ANZHUOLINGPAISHULIANG = parseInt(process.env.ANZHUOLINGPAISHULIANG, 10) || 1;
const WEIXIN_TUISONG = process.env.WEIXIN_TUISONG || '';
const CUSTOM_TOKENS = process.env.APPETIZE_TOKENS ? process.env.APPETIZE_TOKENS.split(',').map(t => t.trim()) : [];

// 工具函数：延迟执行
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 工具函数：发送 HTTP 请求
function httpRequest(url, options = {}, postData = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        
        const defaultOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Appetize-Token-Manager/1.0',
                ...options.headers
            },
            timeout: CONFIG.REQUEST_TIMEOUT
        };

        const lib = isHttps ? https : http;
        const req = lib.request(defaultOptions, (res) => {
            let data = '';
            
            res.on('data', chunk => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: jsonData
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`请求失败：${error.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        if (postData) {
            req.write(JSON.stringify(postData));
        }
        
        req.end();
    });
}

// 验证 API 令牌
async function validateToken(token) {
    const result = {
        token: token.substring(0, 8) + '...' + token.substring(token.length - 4),
        valid: false,
        error: null,
        organization: null,
        apps: []
    };

    try {
        // 尝试获取应用列表 (v1 API)
        const response = await httpRequest(
            `${CONFIG.API_BASE_URL}${CONFIG.API_V1_PATH}/apps`,
            {
                method: 'GET',
                headers: {
                    'X-API-KEY': token
                }
            }
        );

        if (response.statusCode === 200) {
            result.valid = true;
            result.apps = response.data.data || [];
            
            // 尝试获取组织信息 (如果有权限)
            try {
                const orgResponse = await httpRequest(
                    `${CONFIG.API_BASE_URL}${CONFIG.API_V2_PATH}/organization`,
                    {
                        method: 'GET',
                        headers: {
                            'X-API-KEY': token
                        }
                    }
                );
                
                if (orgResponse.statusCode === 200) {
                    result.organization = orgResponse.data;
                }
            } catch (orgError) {
                // 忽略组织信息获取错误
            }
        } else if (response.statusCode === 401) {
            result.error = '无效的 API 令牌';
        } else if (response.statusCode === 403) {
            result.error = '令牌权限不足';
        } else {
            result.error = `HTTP ${response.statusCode}: ${JSON.stringify(response.data)}`;
        }
    } catch (error) {
        result.error = error.message;
    }

    return result;
}

// 测试云端安卓环境 (通过构建嵌入 URL 来验证)
async function testCloudAndroid(token, deviceType = 'android') {
    const result = {
        success: false,
        embedUrl: null,
        error: null
    };

    try {
        // 首先获取应用列表
        const appsResponse = await httpRequest(
            `${CONFIG.API_BASE_URL}${CONFIG.API_V1_PATH}/apps`,
            {
                method: 'GET',
                headers: {
                    'X-API-KEY': token
                }
            }
        );

        if (appsResponse.statusCode !== 200) {
            result.error = `获取应用列表失败：HTTP ${appsResponse.statusCode}`;
            return result;
        }

        const apps = appsResponse.data.data || [];
        
        // 如果有应用，生成嵌入 URL 进行测试
        if (apps.length > 0) {
            const app = apps[0];
            const publicKey = app.publicKey;
            
            // 构建嵌入 URL (这是使用 Appetize 云端安卓环境的正确方式)
            const embedUrl = `https://appetize.io/embed/${publicKey}?device=${deviceType === 'android' ? 'pixel4' : 'iphone12'}&orientation=portrait`;
            
            result.success = true;
            result.embedUrl = embedUrl;
            result.appInfo = {
                publicKey: publicKey,
                name: app.name || 'N/A',
                platform: app.platform
            };
        } else {
            // 没有应用时，说明令牌有效但没有可运行的应用
            // 这是正常情况，因为免费账户可能没有上传应用
            result.success = true;
            result.embedUrl = '需要上传应用后才能生成嵌入 URL';
            result.note = '令牌有效但账户中没有应用，请先上传 APK/IPA 文件';
        }
    } catch (error) {
        result.error = error.message;
    }

    return result;
}

// 关闭会话 (v2 API)
async function closeSession(token, sessionToken) {
    try {
        const response = await httpRequest(
            `${CONFIG.API_BASE_URL}${CONFIG.API_V2_PATH}/sessions/${sessionToken}`,
            {
                method: 'DELETE',
                headers: {
                    'X-API-KEY': token
                }
            }
        );
        return response.statusCode === 200 || response.statusCode === 204;
    } catch (error) {
        console.log(`关闭会话时出错：${error.message}`);
        return false;
    }
}

// 生成报告
function generateReport(validationResults, sessionTests) {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    let report = `=== Appetize.io 令牌管理报告 ===\n`;
    report += `生成时间：${timestamp}\n\n`;
    
    report += `--- 令牌验证结果 ---\n`;
    report += `验证数量：${validationResults.length}\n`;
    report += `有效数量：${validationResults.filter(r => r.valid).length}\n`;
    report += `无效数量：${validationResults.filter(r => !r.valid).length}\n\n`;

    validationResults.forEach((result, index) => {
        report += `[令牌 ${index + 1}] ${result.token}\n`;
        report += `  状态：${result.valid ? '有效' : '无效'}\n`;
        if (result.valid) {
            if (result.organization) {
                report += `  组织：${result.organization.name || 'N/A'}\n`;
                report += `  应用数量：${result.apps.length}\n`;
            }
        } else {
            report += `  错误：${result.error}\n`;
        }
        report += '\n';
    });

    report += `--- 云端安卓环境测试 ---\n`;
    sessionTests.forEach((test, index) => {
        report += `[测试 ${index + 1}] ${test.tokenUsed}\n`;
        report += `  结果：${test.success ? '成功' : '失败'}\n`;
        if (test.success) {
            if (test.embedUrl) {
                report += `  嵌入 URL: ${test.embedUrl}\n`;
            }
            if (test.appInfo) {
                report += `  应用：${test.appInfo.name} (${test.appInfo.publicKey})\n`;
            }
            if (test.note) {
                report += `  说明：${test.note}\n`;
            }
        } else {
            report += `  错误：${test.error}\n`;
        }
        report += '\n';
    });

    report += `--- 环境变量信息 ---\n`;
    report += `ANZHUOLINGPAISHULIANG: ${ANZHUOLINGPAISHULIANG}\n`;
    report += `WEIXIN_TUISONG: ${WEIXIN_TUISONG ? '已配置' : '未配置'}\n`;
    report += `APPETIZE_TOKENS: ${CUSTOM_TOKENS.length > 0 ? '已配置 (' + CUSTOM_TOKENS.length + '个)' : '未配置'}\n`;

    return report;
}

// 生成微信推送消息
function generateWechatMessage(validationResults, sessionTests) {
    const validCount = validationResults.filter(r => r.valid).length;
    const invalidCount = validationResults.filter(r => !r.valid).length;
    const successTests = sessionTests.filter(t => t.success).length;
    
    let message = `## Appetize.io 令牌管理报告\n\n`;
    message += `### 验证概览\n`;
    message += `- 验证令牌数：${validationResults.length}\n`;
    message += `- 有效：${validCount}\n`;
    message += `- 无效：${invalidCount}\n\n`;
    
    message += `### 云端测试\n`;
    message += `- 测试次数：${sessionTests.length}\n`;
    message += `- 成功：${successTests}\n\n`;

    if (validationResults.length > 0) {
        message += `### 令牌详情\n`;
        validationResults.forEach((result, index) => {
            const status = result.valid ? '[OK]' : '[FAIL]';
            message += `${status} 令牌${index + 1}: ${result.token}\n`;
            if (!result.valid && result.error) {
                message += `   错误：${result.error.substring(0, 50)}\n`;
            }
        });
    }

    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    message += `\n---\n生成时间：${timestamp}`;

    return message;
}

// 推送至微信 (Server酱)
async function pushToWechat(title, content) {
    if (!WEIXIN_TUISONG) {
        console.log('未配置 WEIXIN_TUISONG 环境变量，跳过微信推送');
        return { success: false, error: '未配置 SendKey' };
    }

    try {
        // Server酱 V3 API
        const url = `${CONFIG.SERVERCHAN_URL}/${WEIXIN_TUISONG}.send`;
        
        const postData = {
            title: title,
            descp: content
        };

        const response = await httpRequest(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            },
            postData
        );

        if (response.statusCode === 200 && response.data.code === 0) {
            return { success: true, data: response.data };
        } else {
            return { 
                success: false, 
                error: `推送失败：HTTP ${response.statusCode}`,
                data: response.data
            };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 主函数
async function main() {
    console.log('========================================');
    console.log('Appetize.io 令牌管理器');
    console.log('========================================\n');

    console.log(`配置信息:`);
    console.log(`- 需要验证的令牌数量：${ANZHUOLINGPAISHULIANG}`);
    console.log(`- 微信推送：${WEIXIN_TUISONG ? '已启用' : '未启用'}`);
    console.log(`- 自定义令牌：${CUSTOM_TOKENS.length > 0 ? CUSTOM_TOKENS.length + ' 个' : '无'}`);
    console.log('');

    // 收集所有待验证的令牌
    const tokensToValidate = [];
    
    // 添加自定义令牌
    if (CUSTOM_TOKENS.length > 0) {
        tokensToValidate.push(...CUSTOM_TOKENS);
    }
    
    // 如果没有自定义令牌，使用默认令牌
    if (tokensToValidate.length === 0) {
        console.log('使用内置测试令牌:', CONFIG.DEFAULT_TOKEN.substring(0, 8) + '...');
        for (let i = 0; i < ANZHUOLINGPAISHULIANG; i++) {
            tokensToValidate.push(CONFIG.DEFAULT_TOKEN);
        }
    }

    console.log(`待验证令牌总数：${tokensToValidate.length}\n`);

    // 验证所有令牌
    const validationResults = [];
    console.log('开始验证令牌...\n');
    
    for (let i = 0; i < tokensToValidate.length; i++) {
        const token = tokensToValidate[i];
        console.log(`[${i + 1}/${tokensToValidate.length}] 验证令牌：${token.substring(0, 8)}...`);
        
        const result = await validateToken(token);
        validationResults.push(result);
        
        console.log(`  结果：${result.valid ? '有效' : '无效'}`);
        if (result.valid && result.organization) {
            console.log(`  组织：${result.organization.name || 'N/A'}`);
        }
        if (!result.valid) {
            console.log(`  错误：${result.error}`);
        }
        
        // 添加延迟避免请求过快
        if (i < tokensToValidate.length - 1) {
            await delay(CONFIG.REQUEST_DELAY);
        }
    }

    console.log('\n----------------------------------------\n');

    // 测试云端安卓环境 (仅对有效令牌)
    const sessionTests = [];
    const validTokens = validationResults.filter(r => r.valid).map(r => {
        // 找到原始令牌
        const originalToken = tokensToValidate.find(t => 
            t.substring(0, 8) === r.token.substring(0, 8) && 
            t.substring(t.length - 4) === r.token.substring(r.token.length - 4)
        );
        return originalToken;
    }).filter(Boolean);

    if (validTokens.length > 0) {
        console.log('开始测试云端安卓环境...\n');
        
        for (let i = 0; i < Math.min(validTokens.length, 3); i++) {
            const token = validTokens[i];
            console.log(`[${i + 1}/${Math.min(validTokens.length, 3)}] 测试令牌：${token.substring(0, 8)}...`);
            
            const testResult = await testCloudAndroid(token, 'android');
            sessionTests.push({
                tokenUsed: token.substring(0, 8) + '...' + token.substring(token.length - 4),
                ...testResult
            });
            
            console.log(`  结果：${testResult.success ? '成功' : '失败'}`);
            if (testResult.success) {
                console.log(`  嵌入 URL: ${testResult.embedUrl || 'N/A'}`);
                
                }
            } else {
                console.log(`  错误：${testResult.error}`);
            }
            
            if (i < Math.min(validTokens.length, 3) - 1) {
                await delay(CONFIG.REQUEST_DELAY);
            }
        }
    }

    console.log('\n----------------------------------------\n');

    // 生成报告
    const report = generateReport(validationResults, sessionTests);
    console.log(report);

    // 推送至微信
    if (WEIXIN_TUISONG) {
        console.log('正在推送报告至微信...\n');
        const wechatMessage = generateWechatMessage(validationResults, sessionTests);
        const pushResult = await pushToWechat('Appetize.io 令牌管理报告', wechatMessage);
        
        if (pushResult.success) {
            console.log('微信推送成功!');
        } else {
            console.log(`微信推送失败：${pushResult.error}`);
        }
    }

    console.log('\n========================================');
    console.log('任务完成');
    console.log('========================================');

    // 返回退出码
    const hasValidTokens = validationResults.some(r => r.valid);
    process.exit(hasValidTokens ? 0 : 1);
}

// 运行主函数
main().catch(error => {
    console.error('发生错误:', error.message);
    process.exit(1);
});
