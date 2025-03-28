document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('addUserBtn').addEventListener('click', function () {
        document.getElementById('addUserModal').style.display = 'block';
    });

    document.querySelector('.close').addEventListener('click', function () {
        document.getElementById('addUserModal').style.display = 'none';
    });

    window.addEventListener('click', function (event) {
        if (event.target == document.getElementById('addUserModal')) {
            document.getElementById('addUserModal').style.display = 'none';
        }
    });
});

// 存储文件元数据
const fileMap = new Map();

// 通信部分
const TheBtnShowMyShareList = document.getElementById('ShowMyShareList')

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

TheBtnShowMyShareList.onclick = async () => {
    try {
        const TheUlShareFile = document.getElementById('MyShareList');
        TheUlShareFile.innerHTML = '';
        const data = await window.MyAPI.retShareDir();
        const files = data.filesData;
        console.log('数据库中的文件数据:', files);

        files.forEach(element => {
            const liElement = document.createElement('li');
            const fileName = document.createElement('span');
            // 存入map
            fileMap.set(element.file_hash, element);
            fileName.className = 'file-name';
            fileName.textContent = element.file_name;
            liElement.appendChild(fileName);
            const fileSize = document.createElement('span');
            fileSize.className = 'file-size';
            fileSize.textContent = formatFileSize(element.file_size)
            liElement.appendChild(fileSize);
            const btn = document.createElement('button');
            if (element.file_is_load) {
                btn.className = 'local';
                btn.textContent = '本地';
            } else {
                btn.className = 'download';
                btn.id = element.file_hash;
                btn.textContent = '下载';
                // 添加点击事件监听
                button.addEventListener('click', function () {
                    // 通过 Map 获取完整文件信息
                    const fileInfo = fileMap.get(this.id);
                    MyAPI.Download(fileInfo);
                })
            }
            liElement.appendChild(btn);
            TheUlShareFile.appendChild(liElement);
        });

    } catch (error) {
        console.error('获取数据失败:', error);
    }
}

window.onload = function () {
    MyAPI.onLocalInfo().then(data => {
        const ip = data.ip;
        const port = data.port;
        document.getElementById('local-ip').innerText = `本机 IP: ${ip}`;
        document.getElementById('local-port').innerText = `占用端口: ${port}`;
    })
};

document.getElementById('confirmAddUser').addEventListener('click', () => {
    const remoteIp = document.getElementById('userIP').value;
    const remotePort = document.getElementById('userport').value;
    console.log(remoteIp);
    console.log(remotePort);
    window.MyAPI.connectToPeer(remoteIp, remotePort);
});

window.MyAPI.haveLink((data) => {
    console.log('连接建立成功，对方 IP:', data);
    const UserUL = document.getElementById('connectedUsers');
    const newLi = document.createElement('li');
    newLi.textContent = data;
    UserUL.appendChild(newLi);
});
