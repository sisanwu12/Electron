const TheBtnShowMyShareList = document.getElementById('ShowMyShareList')

TheBtnShowMyShareList.onclick = async () => {
    try {
        const filesData = await window.MyAPI.retShareDir();
        console.log('数据库中的文件数据:', filesData);
        const TheUlShareFile = document.getElementById('MyShareList');
        filesData.forEach(element => {
            const liElement = document.createElement('li');
            liElement.textContent = element.file_name;
            TheUlShareFile.appendChild(liElement);
        });

    } catch (error) {
        console.error('获取数据失败:', error);
    }
}

window.MyAPI.getNetworkInfo()
    .then(info => {
        console.log('IP地址:', info.ip);
        console.log('端口号:', info.port);
        // 显示获取到的信息
        const localIP = document.getElementById('localIP');
        localIP.textContent = `本地IP地址:${info.ip}`;
        const localport = document.getElementById('localport');
        localport.textContent = `使用端口号：${info.port}`;
    })
    .catch(err => console.error('获取信息失败:', err));