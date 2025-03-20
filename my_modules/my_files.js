const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');


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




// 打包
module.exports = {
    retDatabaseDir,
};