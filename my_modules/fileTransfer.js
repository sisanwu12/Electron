// fileTransfer.js
let dataChannel = null;
let mainWindow;
// 获取主进程API
function getWin(win) {
    mainWindow = win;
}

// 获取数据库数据并发送
async function getDatabaseFile() {
    // 获取主进程的 retDatabaseDir() 返回的数据
    const mainAPI = require('../main');
    const filesData = await mainAPI.retDatabaseDir();
    const ownerData = mainAPI.retLocal();
    const key = `${ownerData.ip}:${ownerData.port}`
    const message = {
        type: 'db-file-metadata',
        payload: filesData,
        ownerKey: key
    };
    dataChannel.send(JSON.stringify(message));
    console.log('fileTransfer.js: 已发送文件元信息', message);
}

// 存储接收端的临时数据
const receivingFiles = new Map();

/**
 * 设置数据通道
 * @param {RTCDataChannel} channel - 已建立的 WebRTC 数据通道
 */
function setDataChannel(channel, key) {
    dataChannel = channel;
    console.log('fileTransfer.js: 数据通道打开');
    // 当数据通道打开时主动发送文件元信息
    sendDatabaseMetadata();
    mainWindow.webContents.send('data-channel-open', key);
}

/**
 * 发送文件元信息
 * 通过主进程的 retDatabaseDir() 获取文件元信息数组
 */
async function sendDatabaseMetadata() {
    if (!dataChannel || dataChannel.readyState !== 'open') {
        console.error('fileTransfer.js: 数据通道未打开，无法发送文件元信息');
        return;
    }

    getDatabaseFile();
}

/**
 * 发送文件下载请求给对方
 * @param {Object} fileMetadata 文件元信息
 */
function sendFileDownloadRequest(fileMetadata) {
    if (!dataChannel || dataChannel.readyState !== 'open') {
        console.error('fileTransfer: 数据通道未打开，无法发送下载请求');
        return;
    }
    const message = {
        type: 'file-download-request',
        payload: fileMetadata
    };
    dataChannel.send(JSON.stringify(message));
    console.log('fileTransfer: 已发送文件下载请求', fileMetadata);
}

/**
 * 收到 file-download-request 后，读取本地文件并分块发送
 */
function sendFileToRemote(data) {
    if (!dataChannel || dataChannel.readyState !== 'open') {
        console.error('fileTransfer: 数据通道未打开，无法发送文件');
        return;
    }
    const filePath = data.file_path;
    const fileName = data.file_name;
    const fileId = data.file_id;

    // 每次读取 16KB（可自定义）
    const fs = require('fs');
    const chunkSize = 16 * 1024;
    const readStream = fs.createReadStream(filePath, { highWaterMark: chunkSize });

    let chunkIndex = 0;
    readStream.on('data', (chunk) => {
        chunkIndex++;
        // 这里可以把 chunk 转为 base64 或者 Buffer -> string
        const base64Chunk = chunk.toString('base64');

        const message = {
            type: 'file-chunk',
            payload: {
                fileId,
                fileName,
                chunkIndex,
                chunkData: base64Chunk
            }
        };
        dataChannel.send(JSON.stringify(message));
    });

    readStream.on('end', () => {
        // 发送传输完成消息
        const completeMsg = {
            type: 'file-transfer-complete',
            payload: {
                fileId,
                fileName
            }
        };
        dataChannel.send(JSON.stringify(completeMsg));
        console.log(`fileTransfer: 文件发送完成 ${fileName}`);
    });

    readStream.on('error', (err) => {
        console.error('fileTransfer: 读取文件失败:', err);
        // 发送错误消息
        // TODO
    });
}

/**
 * 收到文件分块
 */
function receiveFileChunk({ fileId, fileName, chunkIndex, chunkData }) {
    // 如果没在 receivingFiles 中，就初始化
    if (!receivingFiles.has(fileId)) {
        receivingFiles.set(fileId, []);
    }
    const chunks = receivingFiles.get(fileId);

    // 将 base64 转回 Buffer
    const buffer = Buffer.from(chunkData, 'base64');
    chunks.push({ index: chunkIndex, buffer });
}

/**
 * 文件传输完成，合并分块并保存到本地
 */
function finalizeFileTransfer({ fileId, fileName }) {
    const chunks = receivingFiles.get(fileId);
    if (!chunks) {
        console.error('fileTransfer: 未找到对应文件ID的分块');
        return;
    }
    // 按照 chunkIndex 排序后合并
    chunks.sort((a, b) => a.index - b.index);
    const buffers = chunks.map(c => c.buffer);
    const fileBuffer = Buffer.concat(buffers);

    // 写入磁盘
    const fileWatcher = require('./fileWatcher');
    const path = require('path')
    const savePath = path.join(fileWatcher.retDataPath(), `.${path.sep}${fileName}`);
    const fs = require('fs');
    fs.writeFileSync(savePath, fileBuffer);
    console.log(`fileTransfer: 文件 ${fileName} 已保存到 ${savePath}`);

    // 清理
    receivingFiles.delete(fileId);

    // 如果需要通知渲染进程，可以：
    if (mainWindow) {
        mainWindow.webContents.send('file-transfer-complete', { fileId, fileName, savePath });
    }
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
                // 更新本地数据库
                console.log('正在连接数据库');
                for (const fileInfo of message.payload) {
                    fileInfo.file_partner = message.ownerKey;
                    fileInfo.file_is_load = 0;
                    const fileMetadata = {
                        filePath: fileInfo.file_path,
                        fileName: fileInfo.file_name,
                        fileSize: fileInfo.file_size,
                        filePartner: fileInfo.file_partner,
                        fileHash: fileInfo.file_hash,
                        file_is_load: 0
                    }
                    const mainAPI = require('../main');
                    mainAPI.sendFileMetadataToDb(fileMetadata);
                    console.log(`已写入${fileInfo.file_hash}`);
                }
                console.log('所有文件元信息已更新并存入数据库');
                break;
            case 'file-download-request':
                console.log('fileTransfer.js: 收到文件下载请求', message.payload);
                // 根据文件下载请求，启动文件传输流程
                sendFileToRemote(message.payload);
                break;
            case 'file-chunk':
                // 收到文件分块
                receiveFileChunk(message.payload);
                break;

            case 'file-transfer-complete':
                // 文件传输完成
                finalizeFileTransfer(message.payload);
                break;
            default:
                console.warn('fileTransfer.js: 未知消息类型:', message.type);
        }
    } catch (err) {
        console.error('fileTransfer.js: 解析数据通道消息失败:', err);
    }
}

module.exports = {
    getWin,
    setDataChannel,
    sendDatabaseMetadata,
    handleIncomingData,
    sendFileDownloadRequest
};