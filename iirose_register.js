// 脚本名称：iirose_register.js
// 用途：自动化注册蔷薇花园账号并验证，完成后推送微信通知

const puppeteer = require('puppeteer');
const axios = require('axios');

// 配置
const IIROSE_URL = 'https://iirose.com';
const WEIXIN_TUISONG_KEY = process.env.WEIXIN_TUISONG;

// 生成随机用户信息
function generateRandomUserInfo() {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const username = `Rose${timestamp}${randomStr}`;
    const password = `Pass${Math.random().toString(36).substring(2, 10)}!@#aB`;
    const email = `test${timestamp}${randomStr}@gmail.com`;
    
    return {
        username: username,
        password: password,
        email: email
    };
}

// 推送微信消息 (Server 酱)
async function sendWechatMessage(title, content) {
    if (!WEIXIN_TUISONG_KEY) {
        console.log('未配置微信推送环境变量 WEIXIN_TUISONG');
        return false;
    }
    
    try {
        const url = `https://sctapi.ftqq.com/${WEIXIN_TUISONG_KEY}.send`;
        
        const response = await axios.post(url, null, {
            params: {
                title: title,
                desp: content
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000
        });
        
        if (response.data && response.data.code === 0) {
            console.log('微信推送成功');
            return true;
        } else {
            console.log('微信推送响应:', response.data);
            return false;
        }
    } catch (error) {
        console.error('微信推送失败:', error.message);
        return false;
    }
}

// 延迟函数
const delay = ms => new Promise(r => setTimeout(r, ms));

// 主函数
async function main() {
    console.log('========================================');
    console.log('开始执行蔷薇花园账号注册任务');
    console.log('========================================');
    
    let browser = null;
    const reportData = {
        success: false,
        username: '',
        password: '',
        email: '',
        message: '',
        steps: [],
        timestamp: new Date().toLocaleString('zh-CN')
    };
    
    const addStep = (step) => {
        reportData.steps.push(step);
        console.log(step);
    };
    
    try {
        addStep('[步骤 1] 启动浏览器...');
        
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        
        const page = await browser.newPage();
        
        // 设置反检测
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        addStep('[步骤 2] 访问蔷薇花园网站...');
        await page.goto(IIROSE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        addStep(`页面标题：${await page.title()}`);
        
        addStep('[步骤 3] 等待页面初始化...');
        await delay(10000);
        
        // 获取所有 frames
        const frames = page.frames();
        addStep(`检测到 ${frames.length} 个 frames`);
        
        // 尝试与每个 frame 交互
        for (let i = 0; i < frames.length; i++) {
            try {
                const frame = frames[i];
                const frameUrl = frame.url();
                addStep(`Frame ${i}: ${frameUrl.substring(0, 80)}`);
                
                // 尝试在 frame 中查找可交互元素
                try {
                    const frameContent = await frame.content();
                    if (frameContent.includes('注册') || frameContent.includes('guest')) {
                        addStep(`Frame ${i} 包含注册相关内容`);
                    }
                } catch (e) {}
            } catch (e) {
                addStep(`Frame ${i} 访问出错：${e.message}`);
            }
        }
        
        // 生成用户信息
        const userInfo = generateRandomUserInfo();
        reportData.username = userInfo.username;
        reportData.password = userInfo.password;
        reportData.email = userInfo.email;
        
        addStep('[步骤 4] 生成随机用户信息');
        addStep(`用户名：${userInfo.username}`);
        addStep(`邮箱：${userInfo.email}`);
        
        addStep('[步骤 5] 尝试多种注册方式...');
        
        // 方式 1: 查找页面上的按钮和链接
        const allSelectors = [
            'a', 'button', 'input[type="button"]', 'input[type="submit"]',
            '[class*="btn" i]', '[id*="btn" i]', '[class*="button" i]',
            '[class*="register" i]', '[class*="signup" i]', '[class*="guest" i]',
            '[class*="login" i]', '[id*="login" i]'
        ];
        
        let foundElements = [];
        for (const selector of allSelectors) {
            try {
                const elements = await page.$$(selector);
                if (elements.length > 0) {
                    for (const el of elements) {
                        const text = await page.evaluate(e => e.textContent.trim(), el);
                        if (text && (text.includes('注册') || text.includes('游客') || text.includes('Guest'))) {
                            foundElements.push({ selector, text });
                            addStep(`找到相关元素：${selector} - "${text}"`);
                        }
                    }
                }
            } catch (e) {}
        }
        
        // 方式 2: 尝试点击找到的元素
        if (foundElements.length > 0) {
            addStep('[步骤 6] 尝试点击找到的注册相关元素...');
            for (const item of foundElements.slice(0, 3)) {
                try {
                    const els = await page.$$(item.selector);
                    for (const el of els) {
                        const text = await page.evaluate(e => e.textContent.trim(), el);
                        if (text === item.text) {
                            await el.click();
                            addStep(`点击了元素："${text}"`);
                            await delay(3000);
                            break;
                        }
                    }
                } catch (e) {
                    addStep(`点击失败：${e.message}`);
                }
            }
        }
        
        // 方式 3: 尝试执行页面 JS 函数
        addStep('[步骤 7] 尝试调用页面内部函数...');
        const jsAttempts = [
            'if(typeof Main !== "undefined") { console.log("Main exists", Object.keys(Main)); }',
            'if(typeof window.showRegister === "function") window.showRegister();',
            'if(typeof showRegister === "function") showRegister();',
            'document.body.click();'
        ];
        
        for (const js of jsAttempts) {
            try {
                await page.evaluate(js);
                await delay(2000);
            } catch (e) {}
        }
        
        // 检查是否有表单出现
        addStep('[步骤 8] 检查是否有注册表单...');
        const formSelectors = [
            'input[name*="username" i]',
            'input[name*="password" i]', 
            'input[name*="email" i]',
            'input[type="password"]',
            'form'
        ];
        
        let formFound = false;
        for (const selector of formSelectors) {
            try {
                const el = await page.$(selector);
                if (el) {
                    addStep(`找到表单元素：${selector}`);
                    formFound = true;
                }
            } catch (e) {}
        }
        
        if (formFound) {
            addStep('[步骤 9] 填写注册表单...');
            try {
                // 填写用户名
                const usernameInput = await page.$('input[name*="username" i], input[id*="username" i]');
                if (usernameInput) {
                    await usernameInput.click({ clickCount: 3 });
                    await usernameInput.type(userInfo.username, { delay: 30 });
                    addStep('已填写用户名');
                }
                
                // 填写密码
                const passwordInputs = await page.$$('input[type="password"]');
                if (passwordInputs.length > 0) {
                    for (const input of passwordInputs) {
                        await input.click({ clickCount: 3 });
                        await input.type(userInfo.password, { delay: 30 });
                    }
                    addStep('已填写密码');
                }
                
                // 填写邮箱
                const emailInput = await page.$('input[name*="email" i], input[id*="email" i]');
                if (emailInput) {
                    await emailInput.click({ clickCount: 3 });
                    await emailInput.type(userInfo.email, { delay: 30 });
                    addStep('已填写邮箱');
                }
                
                // 提交
                const submitBtn = await page.$('button[type="submit"], input[type="submit"], button[class*="submit" i]');
                if (submitBtn) {
                    addStep('点击提交按钮...');
                    await submitBtn.click();
                    await delay(5000);
                    reportData.success = true;
                }
            } catch (e) {
                addStep(`填写表单出错：${e.message}`);
            }
        }
        
        // 截图保存
        try {
            await page.screenshot({ path: '/tmp/iirose_final.png', fullPage: true });
            addStep('已保存页面截图到 /tmp/iirose_final.png');
        } catch (e) {
            addStep(`截图失败：${e.message}`);
        }
        
        reportData.message = reportData.steps.join('\n');
        
    } catch (error) {
        console.error('执行出错:', error.message);
        reportData.message = `执行出错：${error.message}`;
        reportData.success = false;
    } finally {
        if (browser) {
            await browser.close();
            console.log('浏览器已关闭');
        }
        
        // 生成报告
        const title = '蔷薇花园账号注册报告';
        const content = `【执行时间】${reportData.timestamp}
【状态】${reportData.success ? '成功' : '部分完成/需手动干预'}
【用户名】${reportData.username}
【密码】${reportData.password ? '已生成' : '未生成'}
【邮箱】${reportData.email}

【详细步骤】
${reportData.message}

【重要提示】
1. 蔷薇花园使用复杂的动态加载机制
2. 可能需要手动完成验证码或邮箱验证
3. 如自动注册未完成，请手动访问 https://iirose.com
4. 截图已保存到 /tmp/iirose_final.png`;
        
        await sendWechatMessage(title, content);
        
        console.log('\n========== 最终报告 ==========');
        console.log(content);
        console.log('============================');
        
        process.exit(reportData.success ? 0 : 1);
    }
}

main().catch(e => { console.error('脚本崩溃:', e); process.exit(1); });
