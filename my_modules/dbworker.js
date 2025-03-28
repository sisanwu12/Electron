const { parentPort } = require('worker_threads');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');


const DatabasePath = path.join(__dirname, `..${path.sep}db${path.sep}files.db`);

// 初始化数据库
const db = new sqlite3.Database(DatabasePath, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    } else {
        console.log('成功连接到 SQLite 数据库:', DatabasePath);
        cleanInvalidRecords();
    }
});

// 处理无效记录
function cleanInvalidRecords() {
    // 查询所有记录
    db.all('SELECT id, file_path FROM files', [], (err, rows) => {
        if (err) {
            console.error('查询记录失败:', err.message);
            return;
        }
        rows.forEach((record) => {
            // 检查文件是否存在，注意file_path如果是URL格式则需转换为本地路径
            if (!fs.existsSync(record.file_path)) {
                db.run('DELETE FROM files WHERE id = ?', [record.id], (err) => {
                    if (err) {
                        console.error(`删除记录 id=${record.id} 失败:`, err.message);
                    } else {
                        console.log(`删除无效记录 id=${record.id}, file_path=${record.file_path}`);
                    }
                });
            }
        });
    });
}


db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_hash TEXT NOT NULL UNIQUE,
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
    const { action, filePath, fileName, fileSize, filePartner, requestId } = message;

    try {
        if (action === 'retShareDir') {
            const data = await retDatabaseDir();
            // 发送结果时带上 requestId 以便主进程匹配请求
            parentPort.postMessage({ requestId, data });
        } else if (action === 'add' || action === 'change') {
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



// 监听 Worker 线程终止事件
parentPort.on('exit', () => {
    db.close((err) => {
        if (err) console.error('数据库关闭失败:', err.message);
        else console.log('数据库连接已关闭');
    });
});

// 在Worker线程退出时关闭数据库连接，避免资源泄漏
parentPort.on('close', () => {
    db.close();
});

// 返回文件夹文件
function retDatabaseDir() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DatabasePath, (err) => {
            if (err) {
                console.error('数据库连接失败:', err.message);
                return reject(err);
            }
            console.log('成功连接到 SQLite 数据库');
        });

        db.all('SELECT * FROM files', [], (err, rows) => {
            if (err) {
                console.error('查询失败:', err.message);
                return reject(err);
            }
            resolve(rows);
        });

        db.close((err) => {
            if (err) {
                console.error('关闭数据库失败:', err.message);
            } else {
                console.log('数据库已关闭');
            }
        });
    });
}


// 更新信息函数
function UpdateFileInfo(fileInfo) {
    return new Promise((resolve, reject) => {
        // 比如根据 fileInfo.id 判断数据库中是否已有记录
        db.run(
            `INSERT OR REPLACE INTO files 
         (id, file_name, file_partner, file_path, file_size, file_hash, file_is_load, load_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                fileInfo.id,
                fileInfo.file_name,
                fileInfo.file_partner,
                fileInfo.file_path,
                fileInfo.file_size,
                fileInfo.file_hash,
                fileInfo.file_is_load,
                fileInfo.load_path
            ],
            function (err) {
                if (err) {
                    return reject(err);
                }
                resolve();
            }
        );
    });
}

module.exports = {
    UpdateFileInfo
};