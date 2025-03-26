const { ipcRenderer } = require('electron');

// 模拟文件元信息
function getFileMetaInfo() {
    return [
        { name: 'file1.txt', size: '2MB', modified: new Date().toISOString() },
        { name: 'file2.png', size: '5MB', modified: new Date().toISOString() }
    ];
}

function setupFileTransfer(dataChannel) {
    dataChannel.onmessage = (event) => {
        const receivedData = JSON.parse(event.data);

        if (receivedData.type === 'metadata') {
            console.log('收到文件元信息：', receivedData);
            ipcRenderer.send('file-info-received', receivedData);
        }
    };

    dataChannel.onopen = () => {
        console.log('数据通道已准备好，发送文件元信息');
        const message = {
            type: 'metadata',
            fileMetaInfo: getFileMetaInfo(),
            connectedPeers: []
        };
        dataChannel.send(JSON.stringify(message));
    };
}

module.exports = { setupFileTransfer };