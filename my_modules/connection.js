const dgram = require('dgram');
const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = require('wrtc');
// 存储与各个远端建立的连接
const connections = new Map();
const rtcConfig = { iceServers: [] };
// UDP 信令 socket，用于收发信令消息
const signalingSocket = dgram.createSocket('udp4');
let isInitialized = false;
let localIp;
let localPort;
// 初始化：绑定本地 IP 与端口
function initialize(ip, port) {
    if (isInitialized) {
        console.warn('connection.js: 已经初始化过，跳过重新初始化');
        return;
    }
    localIp = ip;
    localPort = port
    signalingSocket.bind(port, () => {
        console.log(`connection.js: 正在监听本机${port}端口`);
        isInitialized = true;
    });
}

// 监听来自其他设备的消息
signalingSocket.on('message', async (msg, rinfo) => {
    try {
        const data = JSON.parse(msg.toString());
        const key = `${rinfo.address}:${rinfo.port}`;
        switch (data.type) {
            case 'offer':
                // 收到对方发来的 Offer
                await handleOffer(data.sdp, rinfo.address, rinfo.port, key);
                break;
            case 'answer':
                // 收到 Answer，设置对应连接的远端描述
                await handleAnswer(data.sdp, key);
                break;
            case 'candidate':
                // 收到 ICE 候选消息，加入对应连接
                await handleCandidate(data.candidate, key);
                break;
            default:
                console.warn('未知消息类型:', data.type);
        }
    } catch (error) {
        console.error('解析信令消息失败:', error);
    }
});
/**
 * 统一发送信令消息
 */
function sendSignalingMessage(remoteIP, remotePort, messageObj) {
    const message = Buffer.from(JSON.stringify(messageObj));
    signalingSocket.send(message, remotePort, remoteIP, (err) => {
        if (err) console.error('发送信令消息失败:', err);
        else console.log(`发送 ${messageObj.type} 消息到 ${remoteIP}:${remotePort}`);
    });
}

/**
 * 主动发起连接：用户输入远端的 IP 与端口时调用
 */
async function initiateConnection(remoteIP, remotePort) {
    console.log(`connection: 尝试连接到 ${remoteIP}:${remotePort}`);
    const key = `${remoteIP}:${remotePort}`;
    if (connections.has(key)) {
        console.log('已存在连接，不需要重复发起');
        return;
    }
    const peerConnection = new RTCPeerConnection(rtcConfig);
    connections.set(key, { peerConnection, dataChannel: null, remoteIP, remotePort });

    // 创建数据通道（主动创建）
    console.log("connection: 尝试创建");

    const dataChannel = peerConnection.createDataChannel('dataChannel');
    setupDataChannel(dataChannel, key);
    connections.get(key).dataChannel = dataChannel;

    // 监听对方创建的数据通道
    peerConnection.ondatachannel = (event) => {
        console.log('收到远端数据通道');
        setupDataChannel(event.channel, key);
        connections.get(key).dataChannel = event.channel;
    };

    // 创建 Offer 并设置本地描述
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // 发送 Offer 到目标设备
    sendSignalingMessage(remoteIP, remotePort, {
        type: 'offer',
        sdp: peerConnection.localDescription.sdp
    });
}

/**
 * 处理收到的 Offer：被动应答
 */
async function handleOffer(offerSDP, remoteIP, remotePort, key) {
    // 如果已有连接则使用已有的，否则创建一个新的 RTCPeerConnection
    let connectionObj = connections.get(key);
    if (!connectionObj) {
        const peerConnection = new RTCPeerConnection(rtcConfig);
        connectionObj = { peerConnection, dataChannel: null, remoteIP, remotePort };
        connections.set(key, connectionObj);

        // 当远端主动创建数据通道时
        peerConnection.ondatachannel = (event) => {
            console.log('收到远端数据通道');
            setupDataChannel(event.channel, key);
            connectionObj.dataChannel = event.channel;
        };
    }

    const { peerConnection } = connectionObj;

    // 如果已经存在本地 Offer，则先回滚
    if (peerConnection.signalingState === 'have-local-offer') {
        console.log('检测到信令碰撞，执行回滚');
        await peerConnection.setLocalDescription({ type: 'rollback' });
    }

    // 设置远端描述
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSDP }));
    } catch (error) {
        console.error('设置远端描述时出错：', error);
        return;
    }

    // 创建 Answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // 发送 Answer 回去
    sendSignalingMessage(remoteIP, remotePort, {
        type: 'answer',
        sdp: peerConnection.localDescription.sdp
    });
}

/**
 * 处理收到的 Answer：设置远端描述
 */
async function handleAnswer(answerSDP, key) {
    const connectionObj = connections.get(key);
    if (!connectionObj) {
        console.error('未找到对应的连接对象来处理 Answer');
        return;
    }
    const { peerConnection } = connectionObj;
    await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSDP }));
    console.log('远端描述已设置');
}

const fileTransfer = require('./fileTransfer');

/**
 * 统一配置数据通道事件
 */
function setupDataChannel(channel, key) {
    channel.onopen = () => {
        console.log(`数据通道 (key: ${key}) 已打开`);
        fileTransfer.setDataChannel(channel, key);
    };

    channel.onmessage = (event) => {
        console.log(`数据通道 (key: ${key}) 收到消息:`, event.data);
        fileTransfer.handleIncomingData(event.data);
    };

    channel.onclose = () => {
        console.log(`数据通道 (key: ${key}) 已关闭`);
    };

    channel.onerror = (error) => {
        console.error(`数据通道 (key: ${key}) 错误:`, error);
    };
}

// 导出接口
module.exports = {
    initiateConnection,
    initialize,
    // 你也可以导出一个 sendMessage 方法，通过指定 key 发送消息
    sendMessage: (key, messageObj) => {
        const connectionObj = connections.get(key);
        if (connectionObj && connectionObj.dataChannel && connectionObj.dataChannel.readyState === 'open') {
            connectionObj.dataChannel.send(JSON.stringify(messageObj));
        } else {
            console.error('数据通道不可用');
        }
    }
};