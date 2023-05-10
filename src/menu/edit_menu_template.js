import { BrowserWindow } from "electron";
import path from "path";

export default {
  label: "edit",
  submenu: [
    {
      label: "members",
      accelerator: "CmdOrCtrl+L",
      click: () => {
        BrowserWindow.getFocusedWindow().loadFile(path.join(__dirname, "members.html"));
      }
    },
    {
      label: "settings",
      accelerator: "CmdOrCtrl+L",
      click: () => {
        BrowserWindow.getFocusedWindow().loadFile(path.join(__dirname, "settings.html"));
      }
    }
  ]
};
