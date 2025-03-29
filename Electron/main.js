const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const { Worker } = require('worker_threads');



// 全局路径定义
const PagePath = path.join(__dirname, `${path.sep}Pages${path.sep}`);
const ModulePath = path.join(__dirname, `..${path.sep}my_modules${path.sep}`);


let dbWorker = new Worker(path.join(ModulePath, 'dbworker.js'));
const connection = require(path.join(ModulePath, 'connection.js'));
const fileTransfer = require(path.join(ModulePath, 'fileTransfer'));


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

// 发送插入信息函数
function sendFileMetadataToDb(fileMetadata) {
  const requestId = `request-${Date.now()}-${Math.random()}`;
  dbWorker.postMessage({ action: 'add', ...fileMetadata, requestId });
  console.log('已发送文件元信息到 dbworker', fileMetadata);
}


// 获取本机局域网 IP（选择第一个非内网 IPv4 地址）
function getLocalIp() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const iface in interfaces) {
    for (const alias of interfaces[iface]) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIp = getLocalIp();
let localPort;

// 监听渲染进程发来的连接请求
ipcMain.on('connect-to-peer', (even, args) => {
  // 发送连接请求
  console.log(`主进程已收到请求连接请求目标：${args.remoteIp}:${args.remotePort} ,正在通知connection`);
  connection.initiateConnection(args.remoteIp, args.remotePort);
});


// 创建界面函数
function createWindow() {
  const win = new BrowserWindow({
    width: 1150,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, './preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });
  win.loadFile(path.join(PagePath, './index.html'));
  win.webContents.on('did-finish-load', () => {
    fileTransfer.getWin(win);
  });
}

// 启动文件监控
const watcherProcess = fork(path.resolve(ModulePath, 'fileWatcher.js'));
watcherProcess.on('message', (msg) => {
  console.log('文件监控消息:', msg);
});


function retLocal() {
  return { ip: localIp, port: localPort }
}

// 准备就绪，开始渲染页面
app.whenReady().then(async () => {

  const net = require('net');
  const server = net.createServer();
  server.listen(0, localIp, () => {
    const address = server.address();
    localPort = address.port;
    console.log(`主进程: 本地 IP ${localIp}，随机端口 ${localPort}`);
    // 初始化 connection.js 模块，传入本地 IP
    connection.initialize(localIp, localPort);
  });
  // 将本地信息通过 IPC 发送给渲染进程
  ipcMain.handle('localInfo', () => {
    return { ip: localIp, port: localPort }
  })

  const fileWatcher = require('../my_modules/fileWatcher');
  fileWatcher.InitFileWatcher(app.getPath('home'));
  // 创建窗口
  createWindow();

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

  // 监听预加载脚本发出的 'Download-request' 请求
  ipcMain.on('Download-request', (event, fileInfo) => {
    console.log(`主进程收到下载请求：文件${fileInfo.file_hash},正在通知fileTransfer发送请求`);
    fileTransfer.sendFileDownloadRequest(fileInfo);
  })

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

module.exports = {
  retDatabaseDir,
  retLocal,
  sendFileMetadataToDb
}