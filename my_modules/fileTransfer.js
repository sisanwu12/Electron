// fileTransfer.js
let dataChannel = null;

/**
 * 设置数据通道
 * @param {RTCDataChannel} channel - 已建立的 WebRTC 数据通道
 */
function setDataChannel(channel) {
    dataChannel = channel;
    console.log('fileTransfer.js: 数据通道已设置');
    // 当数据通道打开后，主动发送文件元信息
    dataChannel.onopen = () => {
        console.log('fileTransfer.js: 数据通道打开');
        // 当数据通道打开时主动发送文件元信息
        sendDatabaseMetadata();
    };
}

/**
 * 发送文件元信息
 * 此处假设我们通过主进程的 retDatabaseDir() 获取文件元信息数组
 */
function sendDatabaseMetadata() {
    if (!dataChannel || dataChannel.readyState !== 'open') {
        console.error('fileTransfer.js: 数据通道未打开，无法发送文件元信息');
        return;
    }

    // 假设我们通过 IPC 或远程模块获取主进程的 retDatabaseDir() 返回的数据
    window.MyAPI.retShareDir().then((data) => {
        const message = {
            type: 'db-file-metadata',
            payload: data.filesData,
            ip: data.localIp
        };
        dataChannel.send(JSON.stringify(message));
        console.log('fileTransfer.js: 已发送文件元信息', message);
    }).catch((err) => {
        console.error('获取文件元信息失败:', err);
    });
}

/**
 * 接收到数据通道数据时的处理
 * @param {string} data - 接收到的数据（JSON 格式）
 */
async function handleIncomingData(data) {
    try {
        const message = JSON.parse(data);
        switch (message.type) {
            case 'db-file-metadata':
                console.log('fileTransfer.js: 收到文件元信息');
                const dbworker = require('./dbworker');
                // 可根据业务逻辑更新本地数据库、UI 显示等
                for (const fileInfo of message.payload) {
                    fileInfo.file_partner = message.ip;
                    await dbworker.UpdateFileInfo(fileInfo);
                }
                console.log('所有文件元信息已更新并存入数据库');
                break;
            case 'file-download':
                console.log('fileTransfer.js: 收到文件下载请求', message.payload);
                // 根据文件下载请求，启动文件传输流程




                break;
            // 其他类型的消息




            default:
                console.warn('fileTransfer.js: 未知消息类型:', message.type);
        }
    } catch (err) {
        console.error('fileTransfer.js: 解析数据通道消息失败:', err);
    }
}

module.exports = {
    setDataChannel,
    sendDatabaseMetadata,
    handleIncomingData
};