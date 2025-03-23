const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const { Worker } = require('worker_threads');
// const myfiles = require('../my_modules/my_files');
// const dbWorker = require('../my_modules/dbworker');
let dbWorker = new Worker(path.join(__dirname, '../my_modules', 'dbworker.js'));

// 全局常量定义
const BROADCAST_PORT = 32145; // 端口号
const BROADCAST_ADDR = '255.255.255.255'; // 子网掩码
const Broadcast_Time = 5000;  // 广播时间间隔

// 全局路径定义
const DataPath = path.join(__dirname, `..${path.sep}Database${path.sep}`);
const PagePath = path.join(__dirname, `${path.sep}Pages${path.sep}`);
const ModulePath = path.join(__dirname, `..${path.sep}my_modules${path.sep}`)


// 创建界面函数
function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, './preload.js')
    }
  });
  win.loadFile(path.join(PagePath, "index.html"));
}


// 用于管理请求—响应
const pendingRequests = new Map();
// 简单的 requestId 生成器
let nextRequestId = 1;
function generateRequestId() {
  return nextRequestId++;
}

dbWorker.on('message', (message) => {
  const { requestId, data, error } = message;
  if (pendingRequests.has(requestId)) {
    const { resolve, reject } = pendingRequests.get(requestId);
    if (error) {
      reject(new Error(error));
    } else {
      resolve(data);
    }
    pendingRequests.delete(requestId);
  }
});



// 定义一个函数，通过 dbWorker 请求数据库数据
function retDatabaseDir() {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();
    pendingRequests.set(requestId, { resolve, reject });
    dbWorker.postMessage({ action: 'retShareDir', requestId });
  });
}



// 准备就绪，开始渲染页面
app.whenReady().then(() => {
  // 监听预加载脚本发出的 'retShareDir' 请求
  ipcMain.handle('retShareDir', async () => {
    try {
      const filesData = await retDatabaseDir();
      return filesData;
    } catch (error) {
      console.error('数据库查询错误:', error);
      throw error;
    }
  });
  // 创建窗口
  createWindow()

  // 启动文件监控
  const watcherProcess = fork(path.resolve(ModulePath, 'fileWatcher.js'));
  watcherProcess.on('message', (msg) => {
    console.log('文件监控消息:', msg);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})