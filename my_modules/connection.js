const dgram = require('dgram');
let localIp, localPort;
const socket = dgram.createSocket('udp4');

// 初始化：绑定本地 IP 与端口
function initialize(ip, port) {
    localIp = ip;
    localPort = port;
    socket.bind(localPort, localIp, () => {
        console.log(`connection.js: 正在监听 ${localIp}:${localPort}`);
    });
    // 监听来自其他设备的消息
    socket.on('message', (msg, rinfo) => {
        try {
            const data = JSON.parse(msg.toString());
            console.log(`connection.js: 收到来自 ${rinfo.address}:${rinfo.port} 的消息:`, data);
            // 根据消息类型处理连接请求，这里仅作为示例，你可以根据实际需求扩展处理逻辑
            if (data.type === 'connect-request') {
                // 例如自动回复一个连接确认或启动 WebRTC 协商流程
                console.log('收到连接请求，处理 WebRTC 连接建立...');
                const { RTCPeerConnection, RTCSessionDescription } = require('wrtc');
                const fileTransfer = require('./fileTransfer');

            }
        } catch (error) {
            console.error('connection.js: 解析消息失败:', error);
        }
    });
}

// 向目标设备发送连接请求
function sendConnectionRequest(remoteIp, remotePort, payload) {
    const message = Buffer.from(JSON.stringify(payload));
    socket.send(message, 0, message.length, remotePort, remoteIp, (err) => {
        if (err) {
            console.error('connection.js: 发送连接请求失败:', err);
        } else {
            console.log(`connection.js: 已向 ${remoteIp}:${remotePort} 发送连接请求`);
        }
    });
}

module.exports = {
    initialize,
    sendConnectionRequest,
};