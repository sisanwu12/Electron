const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const { Worker } = require('worker_threads');
let dbWorker = new Worker(path.join(__dirname, '../my_modules', 'dbworker.js'));
const connection = require(path.join(__dirname, '../my_modules/connection.js'));


// 全局路径定义
const DataPath = path.join(__dirname, `..${path.sep}Database${path.sep}`);
const PagePath = path.join(__dirname, `${path.sep}Pages${path.sep}`);
const ModulePath = path.join(__dirname, `..${path.sep}my_modules${path.sep}`)



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
const net = require('net');
const server = net.createServer();
server.listen(0, localIp, () => {
  const address = server.address();
  localPort = address.port;
  console.log(`主进程: 本地 IP ${localIp}，随机端口 ${localPort}`);
  // 初始化 connection.js 模块，传入本地 IP 与随机端口
  connection.initialize(localIp, localPort);
});

// 将本地信息通过 IPC 发送给渲染进程
ipcMain.handle('local-info', () => {
  return { ip: localIp, port: localPort }
})


// 监听渲染进程发来的连接请求
ipcMain.on('connect-to-peer', (even, args) => {
  // 发送连接请求
  console.log(`主进程已收到请求连接请求目标：${args.remoteIp}:${args.remotePort} ,正在通知connection`);
  connection.initiateConnection(args.remoteIp, args.remotePort);
});


// 创建界面函数
function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, './preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });
  win.loadFile(path.join(PagePath, './index.html'));
  return win;
}

// 启动文件监控
const watcherProcess = fork(path.resolve(ModulePath, 'fileWatcher.js'));
watcherProcess.on('message', (msg) => {
  console.log('文件监控消息:', msg);
});


// 准备就绪，开始渲染页面
app.whenReady().then(async () => {

  // 创建窗口
  const mainWindow = createWindow();
  // 将主窗口传入connection.js
  connection.getWin(mainWindow);

  // 监听预加载脚本发出的 'retShareDir' 请求
  ipcMain.handle('retShareDir', async () => {
    try {
      const filesData = await retDatabaseDir();
      return { filesData, localIp };
    } catch (error) {
      console.error('数据库查询错误:', error);
      throw error;
    }
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