const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const dgram = require('dgram');
const socket = dgram.createSocket('udp4');
const os = require('os');
const { v4: uuidv4 } = require('uuid');


// 全局常量定义
const BROADCAST_PORT = 32145; // 端口号
const BROADCAST_ADDR = '255.255.255.255'; // 子网掩码
const Broadcast_Time = 5000;  // 广播时间间隔
const deviceID = uuidv4();    // 设置设备唯一标识

// 全局路径定义
const DataPath = path.join(__dirname, `${path.sep}Database${path.sep}`);
const PagePath = path.join(__dirname, `${path.sep}Pages.${path.sep}`);



// 返回文件夹内文件名函数
async function retDatabaseDir() {
  try {
    const files = await fs.readdir(DataPath);
    const fileNames = []; // 用于保存文件名的数组

    files.forEach((file) => {
      fileNames.push(file); // 将文件名添加到数组
    });
    return fileNames;
  } catch (err) {
    console.error('无法扫描目录: ' + err);
  }
}

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

// 配对函数
function PairFun() {
  // 获取设备基本信息
  const deviceInfo = {
    id: deviceId,
    name: os.hostname(),
    port: BROADCAST_PORT,
    version: '1.0.0',
    os: {
      platform: process.platform,
      type: os.type(),
      release: os.release()
    },
    status: 'available'  // 例如 available、busy、paired 等状态
  };

  // 保存已建立的连接（配对成功的设备）
  const connections = new Map();

  // 绑定 socket，并设置广播
  socket.bind(BROADCAST_PORT, () => {
    socket.setBroadcast(true);
    console.log(`绑定到端口 ${BROADCAST_PORT}，开启广播`);
  });

  // 定时广播设备信息
  setInterval(() => {
    const message = {
      type: 'DISCOVER',
      info: deviceInfo
    };
    const msgBuffer = Buffer.from(JSON.stringify(message));
    socket.send(msgBuffer, 0, msgBuffer.length, BROADCAST_PORT, BROADCAST_ADDR, (err) => {
      if (err) console.error('广播发送失败:', err);
      else console.log('广播消息已发送', deviceInfo);
    });
  }, 5000);

  // 监听所有传入的 UDP 消息
  socket.on('message', (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString());
      // 忽略自己发送的消息
      if (data.info && data.info.id === deviceId) return;

      switch (data.type) {
        case 'DISCOVER':
          // 发现其他设备
          console.log('发现设备:', data.info, '来自', rinfo.address);
          // 可根据状态判断是否主动发起连接或回复确认
          break;
        case 'offer':
          // 收到连接请求 offer，处理并建立 WebRTC 连接（后续调用 setRemoteDescription/createAnswer 等）
          console.log('收到 offer 消息:', data);
          // 如果尚未和该设备配对，则调用处理函数
          if (!connections.has(data.info.id)) {
            // 根据 data.info（发起方信息）建立新连接
            handleIncomingOffer(data, rinfo.address);
          }
          break;
        case 'answer':
          // 收到 answer 消息，设置 remoteDescription
          console.log('收到 answer 消息:', data);
          // 根据 target id 或其它标识，找到对应的 RTCPeerConnection，然后调用 setRemoteDescription
          break;
        case 'candidate':
          // 收到 ICE 候选消息，添加候选到对应连接
          console.log('收到 candidate 消息:', data);
          break;
        default:
          console.warn('未知消息类型:', data.type);
      }
    } catch (error) {
      console.error('解析消息失败:', error);
    }
  });
}

// 示例：处理收到的 offer，建立 WebRTC 连接（简化版伪代码）
async function handleIncomingOffer(data, remoteAddress) {
  // 这里可以使用 WebRTC 库，比如在 Node.js 环境下使用 wrtc
  // const { RTCPeerConnection, RTCSessionDescription } = require('wrtc');
  // 假设你已经创建了 RTCPeerConnection 对象并配置好 ICE
  console.log(`处理来自 ${remoteAddress} 的 offer...`);

  // 示例：创建一个新连接
  const peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      // 发送 candidate 消息给对方
      sendSignalingMessage(remoteAddress, {
        type: 'candidate',
        candidate: event.candidate,
        target: data.info.id,
        info: deviceInfo
      });
    }
  };
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  // 发送 answer 消息回对方
  sendSignalingMessage(remoteAddress, { type: 'answer', sdp: peerConnection.localDescription, target: data.info.id, info: deviceInfo });
  connections.set(data.info.id, peerConnection);

  // 注意：实际应用中需要实现详细的错误处理、重试机制以及信令消息的可靠传输
}

// 用于发送信令消息的函数（可直接使用 UDP，也可以考虑其它可靠传输方式）
function sendSignalingMessage(remoteAddress, message) {
  const msgBuffer = Buffer.from(JSON.stringify(message));
  socket.send(msgBuffer, 0, msgBuffer.length, BROADCAST_PORT, remoteAddress, (err) => {
    if (err) console.error('发送信令消息失败:', err);
    else console.log(`发送 ${message.type} 消息到 ${remoteAddress}`);
  });
}






// 准备就绪，开始渲染页面
app.whenReady().then(() => {
  // 监听分享文件夹获取消息
  ipcMain.handle('retShareDir', retDatabaseDir)
  // 创建窗口
  createWindow()

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