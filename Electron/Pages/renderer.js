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


// 通信部分
const TheBtnShowMyShareList = document.getElementById('ShowMyShareList')

TheBtnShowMyShareList.onclick = async () => {
    try {
        const TheUlShareFile = document.getElementById('MyShareList');
        TheUlShareFile.innerHTML = '';
        const filesData = await window.MyAPI.retShareDir();
        console.log('数据库中的文件数据:', filesData);
        filesData.forEach(element => {
            const liElement = document.createElement('li');
            liElement.textContent = element.file_name;
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

