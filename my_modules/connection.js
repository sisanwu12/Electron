const { ipcMain } = require('electron')
const dgram = require('dgram')
const { RTCPeerConnection } = require('wrtc')


class ConnectionManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow
        this.pendingConnections = new Map() // 存储待确认的连接请求
        this.activeConnections = new Map()  // 已建立的连接

        // 初始化多播监听
        this.socket = dgram.createSocket('udp4')
        this.socket.bind(12345, () => {
            this.socket.addMembership('230.185.192.108')
        })

        // 监听渲染进程的确认事件
        ipcMain.on('connection-response', (event, { requestId, accepted }) => {
            this.handleUserResponse(requestId, accepted)
        })
    }

    // 处理多播消息
    startListening() {
        this.socket.on('message', (msg, rinfo) => {
            const message = JSON.parse(msg.toString())
            if (message.type === 'offer') {
                this.handleIncomingOffer(message, rinfo)

            }
        })
    }

    // 处理收到的 Offer
    async handleIncomingOffer(offerData, rinfo) {
        const requestId = Date.now().toString()

        // 发送到渲染进程显示提示
        this.mainWindow.webContents.send('connection-request', {
            requestId,
            from: `${rinfo.address}:${rinfo.port}`,
            offer: offerData
        })

        // 存储待处理请求（15秒超时）
        this.pendingConnections.set(requestId, {
            rinfo,
            offerData,
            timer: setTimeout(() => {
                this.pendingConnections.delete(requestId)
            }, 15000)
        })
    }

    // 处理用户响应
    async handleUserResponse(requestId, accepted) {
        const request = this.pendingConnections.get(requestId)
        if (!request) return

        clearTimeout(request.timer)
        this.pendingConnections.delete(requestId)

        if (accepted) {
            const pc = new RTCPeerConnection({ iceServers: [] })

            // 设置远程 Offer
            await pc.setRemoteDescription(request.offerData)

            // 创建 Answer
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            // 发送 Answer 回对方
            this.sendMessage(request.rinfo, {
                type: 'answer',
                data: answer
            })

            // 监听数据通道
            pc.ondatachannel = (event) => {
                const dataChannel = event.channel
                this.setupDataChannel(dataChannel)
            }

            this.activeConnections.set(requestId, pc)
        }
    }

    // 发送多播消息
    sendMessage(rinfo, message) {
        const msg = JSON.stringify(message)
        this.socket.send(msg, rinfo.port, rinfo.address)
        console.log();

    }

    setupDataChannel(channel) {
        channel.onmessage = (event) => {
            // 处理文件传输逻辑
        }
    }
}

module.exports = ConnectionManager