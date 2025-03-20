const { parentPort } = require('worker_threads');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 初始化数据库
const db = new sqlite3.Database(path.join(__dirname, `..${path.sep}db${path.sep}files.db`));

db.on('error', (err) => {
    console.error('数据库连接错误:', err.message);
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_hash TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_is_load INTEGER NOT NULL CHECK (file_is_load IN (0, 1)),
    file_partner TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
        if (err) console.error('创建表时出错:', err.message);
    });
});

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

// 处理消息
parentPort.on('message', async (message) => {
    const { action, filePath, fileName, fileSize, filePartner } = message;

    try {
        if (action === 'add' || action === 'change') {
            const fileHash = await calculateHash(filePath);
            db.run(
                `INSERT INTO files (file_name, file_path, file_hash, file_size, file_is_load, file_partner) 
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(file_path) 
        DO UPDATE SET file_hash=excluded.file_hash, file_size=excluded.file_size, updated_at=CURRENT_TIMESTAMP`,
                [fileName, filePath, fileHash, fileSize, 1, filePartner],
                (err) => {
                    if (err) console.error('数据库写入失败:', err.message);
                    else console.log(`数据库记录已更新: ${filePath}`);
                }
            );
        } else if (action === 'delete') {
            db.run(`UPDATE files SET file_is_load = 0 WHERE file_path = ?`, [filePath], (err) => {
                if (err) console.error('删除记录失败:', err.message);
                else console.log(`文件已标记为删除: ${filePath}`);
            });
        }
    } catch (error) {
        console.error('处理失败:', error.message);
    }
});