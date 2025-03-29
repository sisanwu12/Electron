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
        const files = await window.MyAPI.retShareDir();
        console.log('数据库中的文件数据:', files);

        files.forEach(element => {
            const liElement = document.createElement('li');

            // 创建文件名元素
            const fileName = document.createElement('div'); // 改为div以便更好控制
            fileName.className = 'file-name';
            fileName.textContent = element.file_name;
            fileName.setAttribute('data-fullname', element.file_name);

            // 创建文件大小元素
            const fileSize = document.createElement('span');
            fileSize.className = 'file-size';
            fileSize.textContent = formatFileSize(element.file_size);

            // 创建按钮元素
            const btn = document.createElement('button');
            if (element.file_is_load) {
                btn.className = 'local';
                btn.textContent = '本地';
            } else {
                btn.className = 'download';
                btn.id = element.file_hash;
                btn.textContent = '下载';
                btn.addEventListener('click', function () {
                    const fileInfo = fileMap.get(this.id);
                    console.log(fileInfo);
                    MyAPI.Download(fileInfo);
                });
            }

            // 存入map
            fileMap.set(element.file_hash, element);

            // 添加元素到li
            liElement.appendChild(fileName);
            liElement.appendChild(fileSize);
            liElement.appendChild(btn);

            TheUlShareFile.appendChild(liElement);
        });

    } catch (error) {
        console.error('获取数据失败:', error);
    }
}

window.onload = function () {
    MyAPI.LocalInfo().then(data => {
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

document.getElementById('localDir').addEventListener('click', async () => {
    const targetPath = '';
    try {
        const result = await window.MyAPI.openFolder(targetPath);
        if (!result.success) {
            console.error('打开失败:', result.error);
        }
    } catch (error) {
        console.error('通信错误:', error);
    }
});