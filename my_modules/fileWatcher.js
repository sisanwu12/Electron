const { Worker } = require('worker_threads');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');


// 计算文件哈希
function calculateHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}
const home = os.homedir(); // 获取用户主目录
const DataPath = path.join(home, 'LanShare');// 用于存储数据路径
async function InitFileWatcher() {
    const dbWorker = new Worker(path.resolve(__dirname, 'dbWorker.js'));
    // 创建本应用的文件夹
    fs.mkdir(DataPath, { recursive: true }, (err) => {
        if (err) {
            console.error('创建文件夹失败:', err);
        } else {
            console.log('文件夹已创建或已存在:', DataPath);
        }
    });

    // 文件信息提取
    function getFileDetails(filePath) {
        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);
        return { filePath, fileName, fileSize: stats.size, filePartner: 'localhost', file_is_load: stats.file_is_load };
    }

    // 监控文件夹
    const watcher = chokidar.watch(DataPath, {
        persistent: true,
        ignoreInitial: false,
    });

    const fileEventCache = new Set();

    watcher
        .on('add', (filePath) => {
            if (fileEventCache.has(filePath)) return;
            fileEventCache.add(filePath);

            console.log(`文件新增: ${filePath}`);

            // 异步计算哈希值
            const processFile = async () => {
                try {
                    const fileHash = await calculateHash(filePath); // 计算哈希
                    const fileDetails = getFileDetails(filePath);    // 获取其他元数据

                    // 发送包含哈希值的完整数据到数据库
                    dbWorker.postMessage({
                        action: 'add',
                        ...fileDetails,
                        fileHash,         // 添加哈希值
                        filePath,         // 确保传递 filePath
                        file_is_load: 1
                    });
                    console.log(`已处理新增文件: ${filePath}`);
                } catch (error) {
                    console.error(`处理文件 ${filePath} 失败:`, error.message);
                } finally {
                    setTimeout(() => fileEventCache.delete(filePath), 1000); // 清理缓存
                }
            };

            processFile(); // 触发异步处理
        })
        .on('change', (filePath) => {
            if (fileEventCache.has(filePath)) return;
            fileEventCache.add(filePath);
            console.log(`文件修改: ${filePath}`);
            dbWorker.postMessage({ action: 'change', ...getFileDetails(filePath) });
            setTimeout(() => fileEventCache.delete(filePath), 1000);
        })
        .on('unlink', (filePath) => {
            console.log(`文件删除: ${filePath}`);
            dbWorker.postMessage({ action: 'delete', filePath });
        });

    console.log(`正在监控文件夹: ${DataPath}`);

}

function retDataPath() {
    return DataPath;
}

InitFileWatcher();


module.exports = {
    InitFileWatcher,
    retDataPath
}
