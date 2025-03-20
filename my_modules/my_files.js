
// 返回文件夹内文件名函数
async function retDatabaseDir(dirPath) {
    try {
        const fs = require('fs').promises;
        const files = await fs.readdir(dirPath);
        const fileNames = [];
        files.forEach((file) => {
            fileNames.push(file);
        });
        return fileNames;
    } catch (err) {
        console.error('无法扫描目录: ' + err);
        throw err;
    }
}

// 使用 SHA-256 计算文件哈希
async function computeHash(filePath) {
    const crypto = require('crypto');
    const fs = require('fs');
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', err => reject(err));
    });
}



// 打包
module.exports = {
    retDatabaseDir,
};