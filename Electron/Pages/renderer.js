const TheBtnShowMyShareList = document.getElementById('ShowMyShareList')


TheBtnShowMyShareList.onclick = async () => {
    console.log(MyAPI);
    const ShareFileArr = await window.MyAPI.MyShareDir();
    if (ShareFileArr == NaN) {
        console.log('error');
        return;
    }
    const TheUlShareFile = document.getElementById('MyShareList')
    ShareFileArr.forEach((fileName) => {
        const liElement = document.createElement('li');
        liElement.textContent = fileName;
        TheUlShareFile.appendChild(liElement);
    });
}