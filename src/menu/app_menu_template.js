import { app, BrowserWindow } from "electron";
import path from "path";

export default {
  label: "file",
  submenu: [
    {
      label: "home",
      accelerator: "CmdOrCtrl+H",
      click: () => {
        BrowserWindow.getFocusedWindow().loadFile(path.join(__dirname, "app.html"));
      }
    },
    {
      label: "competition",
      accelerator: "CmdOrCtrl+B",
      click: () => {
        BrowserWindow.getFocusedWindow().loadFile(path.join(__dirname, "competition_setup.html"));
      }
    },
    {
      label: "data",
      accelerator: "CmdOrCtrl+D",
      click: () => {
        BrowserWindow.getFocusedWindow().loadFile(path.join(__dirname, "data.html"));
      }
    },
    {
      label: "guests",
      accelerator: "CmdOrCtrl+G",
      click: () => {
        BrowserWindow.getFocusedWindow().loadFile(path.join(__dirname, "guests_setup.html"));
      }
    },
    { type: "separator" },
    {
      label: "quit",
      accelerator: "CmdOrCtrl+Q",
      click: () => {
        app.quit();
      }
    }
  ]
};
