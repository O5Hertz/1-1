
// LinkSwift 网盘直链下载助手 - Gopeed 扩展
// 支持：百度网盘、阿里云盘、天翼云盘、迅雷云盘、夸克网盘、UC网盘、123云盘、中国移动云盘

(function() {
    'use strict';

    // 获取用户配置的 settings
    function getSettings() {
        return {
            baidu_token: gopeed.settings.get('baidu_token') || '',
            aliyun_token: gopeed.settings.get('aliyun_token') || '',
            tcloud_session: gopeed.settings.get('tcloud_session') || '',
            xunlei_token: gopeed.settings.get('xunlei_token') || '',
            quark_cookie: gopeed.settings.get('quark_cookie') || '',
            uc_cookie: gopeed.settings.get('uc_cookie') || '',
            pan123_token: gopeed.settings.get('pan123_token') || '',
            mcloud_cookie: gopeed.settings.get('mcloud_cookie') || ''
        };
    }

    // 工具：从 URL 提取参数
    function getParam(url, key) {
        const params = new URL(url).searchParams;
        return params.get(key);
    }

    // 工具：从 URL 提取路径中的 ID
    function extractIdFromPath(url, pattern) {
        const match = url.match(pattern);
        return match ? match[1] : null;
    }

    // === 百度网盘 ===
    async function resolveBaidu(ctx, settings) {
        const url = ctx.req.url;

        // 分享链接 /s/xxx
        const shareMatch = url.match(/pan\.baidu\.com\/s\/([a-zA-Z0-9_-]+)/);
        if (shareMatch) {
            const shareId = shareMatch[1];
            // 1. 获取 sign 和 timestamp
            const signResp = await fetch('https://pan.baidu.com/share/tplconfig?fields=sign,timestamp&channel=chunlei&web=1&app_id=250528&clienttype=0&view_mode=1');
            const signData = await signResp.json();
            if (!signData.data || !signData.data.sign) {
                throw new Error('获取百度网盘 sign 失败');
            }
            const sign = signData.data.sign;
            const timestamp = signData.data.timestamp || '';

            // 2. 获取文件列表
            const listUrl = `https://pan.baidu.com/rest/2.0/xpan/share?method=list&showempty=1&shareid=${shareId}&sign=${sign}&timestamp=${timestamp}`;
            const listResp = await fetch(listUrl);
            const listData = await listResp.json();
            if (listData.errno !== 0) {
                throw new Error('获取百度网盘分享文件列表失败: ' + (listData.errmsg || ''));
            }
            const files = listData.data.list || [];
            if (files.length === 0) {
                throw new Error('分享链接中没有文件');
            }

            // 3. 获取下载链接
            const fsids = files.map(f => f.fs_id).join(',');
            const downloadUrl = `https://pan.baidu.com/rest/2.0/xpan/multimedia?method=filemetas&dlink=1&fsids=[${fsids}]`;
            const downloadResp = await fetch(downloadUrl, {
                headers: {
                    'Authorization': 'Bearer ' + settings.baidu_token,
                    'User-Agent': 'pan.baidu.com'
                }
            });
            const downloadData = await downloadResp.json();
            if (downloadData.errno !== 0) {
                throw new Error('获取百度网盘下载链接失败: ' + (downloadData.errmsg || ''));
            }

            const fileList = downloadData.data.list || [];
            ctx.res = {
                name: '百度网盘分享',
                files: fileList.map(f => ({
                    name: f.server_filename || f.filename || 'file',
                    req: {
                        url: f.dlink || f.downloadLink || '',
                        headers: {
                            'User-Agent': 'pan.baidu.com'
                        }
                    }
                }))
            };
            return;
        }

        // 普通文件页面（非分享） 如 /disk/main?fsid=xxx
        const fsid = getParam(url, 'fsid');
        if (fsid) {
            const downloadUrl = `https://pan.baidu.com/rest/2.0/xpan/multimedia?method=filemetas&dlink=1&fsids=[${fsid}]`;
            const resp = await fetch(downloadUrl, {
                headers: {
                    'Authorization': 'Bearer ' + settings.baidu_token,
                    'User-Agent': 'pan.baidu.com'
                }
            });
            const data = await resp.json();
            if (data.errno !== 0 || !data.data || !data.data.list || data.data.list.length === 0) {
                throw new Error('获取百度网盘文件信息失败');
            }
            const f = data.data.list[0];
            ctx.res = {
                name: f.server_filename || 'file',
                files: [{
                    name: f.server_filename || 'file',
                    req: {
                        url: f.dlink || f.downloadLink || '',
                        headers: {
                            'User-Agent': 'pan.baidu.com'
                        }
                    }
                }]
            };
            return;
        }

        throw new Error('无法解析百度网盘链接');
    }

    // === 阿里云盘 ===
    async function resolveAliyun(ctx, settings) {
        const url = ctx.req.url;
        const shareMatch = url.match(/aliyundrive\.com\/s\/([a-zA-Z0-9_-]+)/);
        if (!shareMatch) {
            throw new Error('仅支持阿里云盘分享链接');
        }
        const shareId = shareMatch[1];

        // 获取分享信息
        const shareInfoResp = await fetch('https://api.aliyundrive.com/v2/share_link/get_share_info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ share_id: shareId })
        });
        const shareInfo = await shareInfoResp.json();
        if (!shareInfo.share_id) {
            throw new Error('获取阿里云盘分享信息失败');
        }

        // 获取文件列表
        const listResp = await fetch('https://api.aliyundrive.com/v2/share_link/get_share_file_list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ share_id: shareId })
        });
        const listData = await listResp.json();
        const items = listData.items || [];
        if (items.length === 0) {
            throw new Error('分享链接中没有文件');
        }

        // 获取下载链接（只取第一个文件）
        const fileId = items[0].file_id;
        const downloadResp = await fetch('https://api.aliyundrive.com/v2/share_link/get_share_link_download_url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + settings.aliyun_token
            },
            body: JSON.stringify({
                share_id: shareId,
                file_id: fileId
            })
        });
        const downloadData = await downloadResp.json();
        if (!downloadData.download_url) {
            throw new Error('获取阿里云盘下载链接失败');
        }

        ctx.res = {
            name: '阿里云盘分享',
            files: [{
                name: items[0].name || 'file',
                req: {
                    url: downloadData.download_url,
                    headers: {
                        'Referer': 'https://www.aliyundrive.com/'
                    }
                }
            }]
        };
    }

    // === 天翼云盘 ===
    async function resolveTcloud(ctx, settings) {
        const url = ctx.req.url;
        // 尝试从 URL 中提取 fileId
        let fileId = getParam(url, 'fileId');
        if (!fileId) {
            const match = url.match(/fileId=(\d+)/);
            if (match) fileId = match[1];
        }
        if (!fileId) {
            throw new Error('无法从天翼云盘链接中提取文件ID');
        }

        // 获取 access_token
        const tokenResp = await fetch('https://api.cloud.189.cn/open/oauth2/ssoH5.action', {
            headers: {
                'Cookie': 'session=' + settings.tcloud_session
            }
        });
        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token || '';

        // 获取下载链接
        const downloadResp = await fetch('https://api.cloud.189.cn/open/file/getFileDownloadUrl.action?fileId=' + fileId, {
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Cookie': 'session=' + settings.tcloud_session
            }
        });
        const downloadData = await downloadResp.json();
        if (!downloadData.downloadUrl) {
            throw new Error('获取天翼云盘下载链接失败');
        }

        ctx.res = {
            name: '天翼云盘文件',
            files: [{
                name: downloadData.fileName || 'file',
                req: {
                    url: downloadData.downloadUrl,
                    headers: {
                        'Referer': 'https://cloud.189.cn/'
                    }
                }
            }]
        };
    }

    // === 迅雷云盘 ===
    async function resolveXunlei(ctx, settings) {
        const url = ctx.req.url;
        // 迅雷云盘文件页面格式: /drive/v1/files/{fileId}
        const match = url.match(/pan\.xunlei\.com\/drive\/v1\/files\/(\d+)/);
        if (!match) {
            throw new Error('无法从迅雷云盘链接中提取文件ID');
        }
        const fileId = match[1];

        const resp = await fetch('https://api-pan.xunlei.com/drive/v1/files/' + fileId + '/download', {
            headers: {
                'Authorization': 'Bearer ' + settings.xunlei_token,
                'Content-Type': 'application/json'
            }
        });
        const data = await resp.json();
        if (!data.download_url) {
            throw new Error('获取迅雷云盘下载链接失败');
        }

        ctx.res = {
            name: '迅雷云盘文件',
            files: [{
                name: data.file_name || 'file',
                req: {
                    url: data.download_url,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            }]
        };
    }

    // === 夸克网盘 ===
    async function resolveQuark(ctx, settings) {
        const url = ctx.req.url;
        const fileId = extractIdFromPath(url, /drive\.quark\.cn\/file\/(\d+)/);
        if (!fileId) {
            throw new Error('无法从夸克网盘链接中提取文件ID');
        }

        const resp = await fetch('https://drive-pc.quark.cn/1/clouddrive/file/download?entry=ft&fr=pc&pr=ucpro&file_id=' + fileId, {
            headers: {
                'Cookie': settings.quark_cookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/3.20.0 Chrome/112.0.5615.165 Electron/24.1.3.8 Safari/537.36'
            }
        });
        const data = await resp.json();
        if (!data.download_url) {
            throw new Error('获取夸克网盘下载链接失败');
        }

        ctx.res = {
            name: '夸克网盘文件',
            files: [{
                name: data.file_name || 'file',
                req: {
                    url: data.download_url,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/3.20.0 Chrome/112.0.5615.165 Electron/24.1.3.8 Safari/537.36'
                    }
                }
            }]
        };
    }

    // === UC网盘 ===
    async function resolveUc(ctx, settings) {
        const url = ctx.req.url;
        const fileId = extractIdFromPath(url, /uc\.cn\/file\/(\d+)/);
        if (!fileId) {
            throw new Error('无法从UC网盘链接中提取文件ID');
        }

        const resp = await fetch('https://pc-api.uc.cn/1/clouddrive/file/download?entry=ft&fr=pc&pr=UCBrowser&file_id=' + fileId, {
            headers: {
                'Cookie': settings.uc_cookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) uc-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36'
            }
        });
        const data = await resp.json();
        if (!data.download_url) {
            throw new Error('获取UC网盘下载链接失败');
        }

        ctx.res = {
            name: 'UC网盘文件',
            files: [{
                name: data.file_name || 'file',
                req: {
                    url: data.download_url,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) uc-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36'
                    }
                }
            }]
        };
    }

    // === 123云盘 ===
    async function resolve123pan(ctx, settings) {
        const url = ctx.req.url;
        // 分享链接
        const shareMatch = url.match(/123pan\.com\/s\/([a-zA-Z0-9_-]+)/);
        if (shareMatch) {
            const shareId = shareMatch[1];
            const resp = await fetch('https://www.123pan.com/api/share/download/info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + settings.pan123_token
                },
                body: JSON.stringify({ share_id: shareId })
            });
            const data = await resp.json();
            if (!data.data || !data.data.download_url) {
                throw new Error('获取123云盘分享下载链接失败');
            }
            ctx.res = {
                name: '123云盘分享',
                files: [{
                    name: data.data.file_name || 'file',
                    req: {
                        url: data.data.download_url,
                        headers: {
                            'Referer': 'https://www.123pan.com/'
                        }
                    }
                }]
            };
            return;
        }

        // 普通文件
        const fileId = extractIdFromPath(url, /123pan\.com\/file\/(\d+)/);
        if (!fileId) {
            throw new Error('无法从123云盘链接中提取文件ID');
        }
        const resp = await fetch('https://www.123pan.com/api/file/download_info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + settings.pan123_token
            },
            body: JSON.stringify({ file_id: fileId })
        });
        const data = await resp.json();
        if (!data.data || !data.data.download_url) {
            throw new Error('获取123云盘文件下载链接失败');
        }
        ctx.res = {
            name: '123云盘文件',
            files: [{
                name: data.data.file_name || 'file',
                req: {
                    url: data.data.download_url,
                    headers: {
                        'Referer': 'https://www.123pan.com/'
                    }
                }
            }]
        };
    }

    // === 中国移动云盘 ===
    async function resolveMcloud(ctx, settings) {
        const url = ctx.req.url;
        const fileId = extractIdFromPath(url, /yun\.139\.com\/file\/(\d+)/);
        if (!fileId) {
            throw new Error('无法从中国移动云盘链接中提取文件ID');
        }

        const resp = await fetch('https://personal-kd-njs.yun.139.com/hcy/file/getDownloadUrl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': settings.mcloud_cookie
            },
            body: JSON.stringify({ fileId: fileId })
        });
        const data = await resp.json();
        if (!data.downloadUrl) {
            throw new Error('获取中国移动云盘下载链接失败');
        }

        ctx.res = {
            name: '中国移动云盘文件',
            files: [{
                name: data.fileName || 'file',
                req: {
                    url: data.downloadUrl,
                    headers: {
                        'Referer': 'https://yun.139.com/'
                    }
                }
            }]
        };
    }

    // === 主入口：注册 onResolve 事件 ===
    gopeed.events.onResolve(async function(ctx) {
        try {
            const url = ctx.req.url;
            const hostname = new URL(url).hostname;

            gopeed.logger.debug('LinkSwift 收到请求: ' + url);

            const settings = getSettings();

            // 根据 hostname 分发
            if (hostname.includes('pan.baidu.com') || hostname.includes('yun.baidu.com')) {
                await resolveBaidu(ctx, settings);
            } else if (hostname.includes('aliyundrive.com')) {
                await resolveAliyun(ctx, settings);
            } else if (hostname.includes('cloud.189.cn')) {
                await resolveTcloud(ctx, settings);
            } else if (hostname.includes('pan.xunlei.com')) {
                await resolveXunlei(ctx, settings);
            } else if (hostname.includes('quark.cn') || hostname.includes('drive.quark.cn')) {
                await resolveQuark(ctx, settings);
            } else if (hostname.includes('uc.cn')) {
                await resolveUc(ctx, settings);
            } else if (hostname.includes('123pan.com') || hostname.includes('123pan.cn')) {
                await resolve123pan(ctx, settings);
            } else if (hostname.includes('yun.139.com')) {
                await resolveMcloud(ctx, settings);
            } else {
                throw new Error('不支持的网盘: ' + hostname);
            }

            gopeed.logger.info('LinkSwift 解析成功，文件数: ' + (ctx.res.files ? ctx.res.files.length : 0));
        } catch (error) {
            gopeed.logger.error('LinkSwift 解析失败: ' + error.message);
            // 抛出错误以便 Gopeed 显示
            throw error;
        }
    });

})();
    