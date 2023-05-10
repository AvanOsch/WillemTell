import { BrowserWindow } from "electron";
import path from "path";
import openAboutWindow from "about-window";

export default {
  label: "help",
  submenu: [
    {
      label: "about",
      click: () => {
        openAboutWindow({
          icon_path: path.join(__dirname, "assets/icon.png"),
          copyright: "© 2023 by AvanOsch."
        });      
      }
    }
  ]
};
