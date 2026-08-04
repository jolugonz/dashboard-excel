const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {

    const window = new BrowserWindow({
        width: 1400,
        height: 900
    });

    window.loadFile("index.html");

}

app.whenReady().then(() => {
    createWindow();
});