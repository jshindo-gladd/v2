import fs from 'fs';
import { remote } from 'electron';
const { Menu, dialog } = remote;
const mainProcess = remote.require('./index');

import repos from './components/LandingPageView/scripts/repos';
import sync from './components/LandingPageView/scripts/sync';
import main from './main';

const appMenu = Menu.buildFromTemplate([
  {
    label: 'File',
    submenu: [
      {
        label: 'Open Path List',
        click() {
          dialog.showOpenDialog({}, (filePaths) => {
            if (!filePaths) return;

            const filePath = filePaths[0];

            const text = fs.readFileSync(filePath, 'utf8');
            const paths = text.split(/\n/).map(v => v.trim()).filter(v => v);

            localStorage.setItem('paths', JSON.stringify(paths));

            repos.init(paths)
              .then(() => {
                sync.startTimer();
              });
          });
        },
      },
      {
        role: 'quit',
        accelerator: 'CmdOrCtrl+Q',
      },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forcereload' },
      { role: 'toggledevtools' },

      { type: 'separator' },

      {
        label: 'Dark Theme',
        type: 'checkbox',
        click(item) {
          document.documentElement.classList.toggle('dark', item.checked);
          localStorage.setItem('dark', item.checked);
        },
        checked: (() => {
          if (!localStorage.getItem('dark')) {
            localStorage.setItem('dark', true);
          }
          const isChecked = localStorage.getItem('dark') === 'true';
          return document.documentElement.classList.toggle('dark', isChecked);
        })(),
      },
      {
        label: 'Skip Taskbar',
        type: 'checkbox',
        click(item) {
          const win = remote.getCurrentWindow();
          win.setSkipTaskbar(item.checked);

          if (item.checked) {
            mainProcess.createTray();
          } else {
            mainProcess.destroyTray();
          }
        },
        checked: mainProcess.isTrayActive(),
      },
    ],
  },
  {
    label: 'History',
    submenu: [
      {
        label: 'Back',
        accelerator: 'Alt+Left',
        click() {
          main.$router.go(-1);
        },
      },
      {
        label: 'Forward',
        accelerator: 'Alt+Right',
        click() {
          main.$router.go(1);
        },
      },
    ],
  },
]);

Menu.setApplicationMenu(appMenu);


// テキスト入力
const contextMenu = Menu.buildFromTemplate([
  { role: 'cut' },
  { role: 'copy' },
  { role: 'paste' },
  { role: 'delete' },
]);

document.addEventListener('contextmenu', (e) => {
  const el = e.target;

  if (el.disabled) return;

  if (el.classList.contains('input') || el.classList.contains('textarea')) {
    contextMenu.popup();
  }
});
