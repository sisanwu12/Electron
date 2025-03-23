const { Worker } = require('worker_threads');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

const dbWorker = new Worker(path.resolve(__dirname, 'dbWorker.js'));
const folderPath = path.resolve(__dirname, '../Database');

// 文件信息提取
function getFileDetails(filePath) {
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    return { filePath, fileName, fileSize: stats.size, filePartner: 'localhost' };
}

// 监控文件夹
const watcher = chokidar.watch(folderPath, {
    persistent: true,
    ignoreInitial: false,
});

const fileEventCache = new Set();

watcher
    .on('add', (filePath) => {
        if (fileEventCache.has(filePath)) return;
        fileEventCache.add(filePath);
        console.log(`文件新增: ${filePath}`);
        dbWorker.postMessage({ action: 'add', ...getFileDetails(filePath) });
        setTimeout(() => fileEventCache.delete(filePath), 1000); // 1秒后删除缓存
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

console.log(`正在监控文件夹: ${folderPath}`);

