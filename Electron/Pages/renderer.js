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