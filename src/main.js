// This is main process of Electron, started as first thing when your
// app starts. It runs through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.

import path from "path";
import fs from "fs";
import url from "url";
import { app, Menu, ipcMain, shell, BrowserWindow, dialog } from "electron";
import Database from "better-sqlite3";
import appMenuTemplate from "./menu/app_menu_template";
import editMenuTemplate from "./menu/edit_menu_template";
import devMenuTemplate from "./menu/dev_menu_template";
import helpMenuTemplate from "./menu/help_menu_template";
import createWindow from "./helpers/window";

// Special module holding environment variables which you declared
// in config/env_xxx.json file.
import env from "env";

// Save userData in separate folders for each environment.
// Thanks to this you can use production and development versions of the app
// on same machine like those are two separate apps.
if (env.name !== "production") {
  const userDataPath = app.getPath("userData");
  app.setPath("userData", `${userDataPath} (${env.name})`);
}

let base = app.getAppPath().replace('\app.asar', '');
const dbfile = path.resolve(base, 'WillemTell.db');

//console.log(dbfile);
//let dbfile = path.join(app.getPath("userData"), "database.db");
const db = new Database(dbfile, { verbose: console.log });

// Create database
fs.readFile(dbfile, function(err, data) {
  if (data.length === 0) {
    const create = fs.readFileSync(path.join(__dirname, "./sql/create.sql")).toString().trim();
    // Prepare the query
    db.exec(create);
  }
});

var knex = require("knex")({
  client: "better-sqlite3",
  connection: {
    filename: dbfile
  }
});

// Load Language
var lang = {};
var langcode = 'nl-NL';
// Load default language
fs.readFile(path.join(__dirname, "./lang/" + langcode + ".json"), "utf8", (err, jsonString) => {
  if (err) {
    console.log("Error reading file from disk:", err);
    return;
  }
  try {
    lang = JSON.parse(jsonString);
  } catch (err) {
    console.log("Error parsing JSON string:", err);
  }
});
// Load Language from settings, and translate menus
const translate = () => {
  return new Promise ((resolve) => {
    knex.first('value').from('settings').where('setting', 'language').then(function(langc) {
      langcode = langc.value;
      fs.readFile(path.join(__dirname, "./lang/" + langcode + ".json"), "utf8", (err, jsonString) => {
        if (err) {
          console.log("Error reading file from disk:", err);
          return;
        }
        try {
          lang = JSON.parse(jsonString);
        } catch (err) {
          console.log("Error parsing JSON string:", err);
        }
        appMenuTemplate.label = lang[appMenuTemplate.label];
        appMenuTemplate.submenu.forEach(submenu => {
          if (submenu.label != undefined) submenu.label = lang[submenu.label];
        });
        editMenuTemplate.label = lang[editMenuTemplate.label];
        editMenuTemplate.submenu.forEach(submenu => {
          if (submenu.label != undefined) submenu.label = lang[submenu.label];
        });
        helpMenuTemplate.label = lang[helpMenuTemplate.label];
        helpMenuTemplate.submenu.forEach(submenu => {
          if (submenu.label != undefined) submenu.label = lang[submenu.label];
        });
        resolve();
      });
    }).catch(function(error) {
      console.log("Error getting language from database:", error);
      resolve();
    });
  });
}

const setApplicationMenu = () => {
  const menus = [appMenuTemplate, editMenuTemplate, helpMenuTemplate];
  if (env.name !== "production") {
    menus.push(devMenuTemplate);
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
};

let mainWindow;
let childWindow;

app.on("ready", () => {
  translate().then((_resp) => {
    setApplicationMenu();

    mainWindow = createWindow("main", {
      width: 1000,
      height: 600,
      show: false,
      backgroundColor: '#5f7400',
      webPreferences: {
        // Two properties below are here for demo purposes, and are
        // security hazard. Make sure you know what you're doing
        // in your production app.
        nodeIntegration: true,
        contextIsolation: false,
        // Spectron needs access to remote module
        enableRemoteModule: env.name === "test"
      }
    });

    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, "app.html"),
        protocol: "file:",
        slashes: true
      })
    );

    if (env.name === "development") {
      mainWindow.openDevTools();
    }
  });
});

// Function to create child window of parent one
function createChildWindow(file) {
  childWindow = createWindow("child", {
    width: 800,
    height: 600,
    minWidth: 780,
    minHeight: 550,
    modal: true,
    show: false,
    parent: mainWindow, // Make sure to add parent window here
    backgroundColor: '#5f7400',
    // Make sure to add webPreferences with below configuration
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });
  
  // Child window loads the passed file
  childWindow.loadFile(path.join(__dirname, file));

  // Child window has no menu
  //childWindow.setMenuBarVisibility(false);
  
  childWindow.once("ready-to-show", () => {
    childWindow.show();
  });
}
ipcMain.on('getLanguage', async (event, refresh) => {
  if (refresh) {
    var langc = await knex.first('value').from('settings').where('setting', 'language').catch(function(error) {
      dialog.showMessageBox(childWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorGettingFromDB.replace("%s", lang.language),
        detail: lang.errorGettingFromDBLong + error.message
      }).then(data => {console.log(data)});
    });
    langcode = langc.value;
    //console.log(langcode);
  }
  event.reply("gotLanguage", langcode);
});

ipcMain.on('gotoPage', (event, page) => {
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, page),
      protocol: "file:",
      slashes: true
    })
  );
});

ipcMain.on("newMemberWindow", (event, arg) => {
  createChildWindow('member_new.html');
});
ipcMain.on("editMemberWindow", async (event, arg) => {
  createChildWindow('member_edit.html');
  var player = await knex.first('*').from('players').where({id: arg});
  childWindow.once("ready-to-show", () => {
    childWindow.webContents.send("gotPlayer", player);
  });
  //console.log(player);
});

ipcMain.on("getAllFrom", async (event, table) => {
  var data = await knex.select('*').from(table);
  event.reply("gotAllFrom_" + table, data);
  //console.log(data);
});

ipcMain.on("getActivePlayers", async (event, arg) => {
  var exists = await knex.select('player_id', 'competition_id', 'date').from('scores_temp');
  if (exists.length) {
    var names = '';
    var date = '';
    var competition_id = '';
    exists.forEach(async player => {
      competition_id = player.competition_id;
      date = player.date;
      if (competition_id == 1) var play = await knex.first('first_name').from('guests').where({id: player.player_id});
      else var play = await knex.first('first_name').from('players').where({id: player.player_id});
      names += play.first_name + ', ';
    });
    var data = await knex.first('name').from('competition').where({id: competition_id});
    var competition = data.name;

    dialog.showMessageBox(childWindow, {
      type: 'question',
      title: lang.backupFound,
      message: lang.backupFoundMsg,
      detail: lang.backupFoundMsgLong.replace("%d", date).replace("%c", competition).replace("%s", names),
      buttons: [lang.yes, lang.no]
    }).then(async (result) => {
      // Bail if the user pressed "No" or escaped (ESC) from the dialog box
      if (result.response !== 0) { return; }
      if (result.response === 0) {
        //console.log('The "Yes" button was pressed');
        var urlpage = (competition_id == 1) ? "guests.html" : "competition.html";
        mainWindow.loadURL(
          url.format({
            pathname: path.join(__dirname, urlpage),
            protocol: "file:",
            slashes: true
          })
        );
      }
    })
  }
  if (arg != undefined && arg != "") var data = await knex.select('*').from('guests').where({ group_name: arg });
  else var data = await knex.select('*').from('players').whereNot({ active: '0' });
  event.reply("gotActivePlayers", data);
  //console.log(data);
});

ipcMain.on("addGroup", async (event, name) => {
  var exists = await knex('groups').select('group_id').where({ group_name: name }).then(check_exist);
  if (exists) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: lang.errorExists.replace("%s", lang.group),
      message: lang.errorExistsMsg.replace("%s", lang.group),
      detail: lang.errorExistsMsgLong.replace("%s", lang.group)
    }).then(data => {console.log(data)});
  } else {
    var success = await knex('groups').insert({ group_name: name }).catch(function(error) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorSaveToDB.replace("%s", lang.newGroup),
        detail: lang.errorSaveToDBLong + error.message
      }).then(data => {console.log(data)});
    });
    if (success) {
      mainWindow.webContents.reloadIgnoringCache();
    }
  }
});

ipcMain.on("addGuest", async (event, args) => {
  var exists = await knex('guests').select('id').where({ group_name: args.group_name, first_name: args.first_name, last_name: args.last_name }).then(check_exist);
  if (exists) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: lang.errorExists.replace("%s", lang.guest),
      message: lang.errorExistsMsg.replace("%s", lang.guest),
      detail: lang.errorExistsMsgLong.replace("%s", lang.guests)
    }).then(data => {console.log(data)});
  } else {
    var success = await knex('guests').insert({ group_name: args.group_name, first_name: args.first_name, last_name: args.last_name }).catch(function(error) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorSaveToDB.replace("%s", lang.newGuest),
        detail: lang.errorSaveToDBLong + error.message
      }).then(data => {console.log(data)});
    });
    if (success) {
      var guest = await knex('guests').first('id').where({ group_name: args.group_name, first_name: args.first_name, last_name: args.last_name });
      event.reply("addedGuest", { id: guest.id, first_name: args.first_name, last_name: args.last_name });
      //mainWindow.webContents.reloadIgnoringCache();
    }
  }
});

ipcMain.on("delGuest", async (event, arg) => {
  var success = await knex('guests').where({ id: arg }).del().catch(function(error) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: lang.error,
      message: lang.errorDelFromDB.replace("%s", lang.guest),
      detail: lang.errorDelFromDBLong + error.message
    }).then(data => {console.log(data)});
  });
  if (success) {
    event.reply("deletedGuest", arg);
  }
});

ipcMain.on("getPlayersData", async (event, arg) => {
  var cdata = await knex.first('value').from('settings').where('setting', 'competition');
  //console.log(cdata.value);
  var pdata = await knex.select('players.first_name', 'players.last_name', 'players.average', 'players.active', 'scores.*').from('players')
            .join('scores', {'scores.player_id': 'players.id'})
            .where('scores.competition_id', cdata.value)
            .orderBy('players.id').catch(function(error) {
    dialog.showMessageBox(childWindow, {
      type: 'error',
      title: lang.error,
      message: lang.errorGettingFromDB.replace("%s", lang.players),
      detail: lang.errorGettingFromDBLong + error.message
    }).then(data => {console.log(data)});
  });
  //var pdata = await knex.select('first_name', 'last_name', 'average').from('players').where('competition_id', cdata.value);
  var data = [];
  pdata.forEach(player => {
    if (data[player.player_id] == undefined) {
      data[player.player_id] = [];
      data[player.player_id].id = player.player_id;
      data[player.player_id].first_name = player.first_name;
      data[player.player_id].last_name = player.last_name;
      data[player.player_id].average = player.average;
      data[player.player_id].active = player.active;
      data[player.player_id].arrows = 0;
      data[player.player_id].score = 0;
      data[player.player_id].points = 0;
      data[player.player_id].average_now = 0;
      data[player.player_id].improvement = 0;
      data[player.player_id].arrows_all = 0;
      data[player.player_id].points_all = 0;
    }
    for (let i = 1; i <= 10; i++) {
      if (player['arrow_' + i] != '' && player['arrow_' + i] != null) {
        data[player.player_id].arrows++;
        data[player.player_id].score += player['arrow_' + i];
      }
    }
    data[player.player_id].average_now = data[player.player_id].score / data[player.player_id].arrows;
    data[player.player_id].points += player.points;
    data[player.player_id].improvement = data[player.player_id].average_now - player.average;
  });
  event.reply("gotPlayersData", data);
  //console.log(data);
});

ipcMain.on("getDataWhere", async (event, arg) => {
  createChildWindow('data_show.html');
  if (arg['competition'] != undefined && arg['competition'] == 1) {
    delete arg['competition'];
    var data = await knex.select('guests.first_name', 'guests.last_name', 'scores_guests.*').from('guests')
              .join('scores_guests', {'scores_guests.guest_id': 'guests.id'})
              .where(arg)
              .orderBy('scores_guests.points', 'scores_guests.guest_id', 'scores_guests.team_id').catch(function(error) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorGettingFromDB.replace("%s", lang.guests),
        detail: lang.errorGettingFromDBLong + error.message
      }).then(data => {console.log(data)});
    });
    arg.competition = await knex.first('name').from('competition').where({id: 1});
  } else {
    var data = await knex.select('players.first_name', 'players.last_name', 'players.average', 'players.active', 'scores.*', 'competition.name').from('players')
              .join('scores', {'scores.player_id': 'players.id'})
              .join('competition', {'scores.competition_id': 'competition.id'})
              .where(arg)
              .orderBy('scores.date', 'scores.competition_id', 'scores.team_id', 'scores.id').catch(function(error) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorGettingFromDB.replace("%s", lang.players),
        detail: lang.errorGettingFromDBLong + error.message
      }).then(data => {console.log(data)});
    });
  }
  childWindow.once("ready-to-show", () => {
    childWindow.webContents.send("gotData", [data, arg]);
  });
//  console.log(data);
});

function check_exist(rows) {
  if (!rows.length) return false;
  else return true;
}

ipcMain.on("getSettings", async (event, arr) => {
  var data = await knex.select('*').from('settings').whereIn('setting', arr);
  event.reply("gotSettings", data);
  //console.log(data);
});

ipcMain.on("submitSettings", async (event, formData) => {
  //console.log(formData);
  //console.log(formData.arrows);
  var success = knex.transaction(trx => {
    const queries = [];
    const settings = ['language', 'team_type', 'teams', 'arrows', 'turns', 'score_min', 'score_max', 'average_multiplier', 'competition', 'hide_fields'];
    settings.forEach(setting => {
      console.log(setting + ': ' + formData[setting]);
      if (setting == 'hide_fields') {
        formData.hide_fields = (formData.hide_fields != undefined && formData.hide_fields != '') ? formData.hide_fields.toString() : '';
      }
      const query = knex('settings').where('setting', setting).update('value',formData[setting]).transacting(trx); // This makes every update be in the same transaction
      queries.push(query);
    });
    Promise.all(queries) // Once every query is written
        .then(trx.commit) // We try to execute all of them
        .catch(trx.rollback); // And rollback in case any of them goes wrong
  });
  if (success) {
    mainWindow.webContents.reloadIgnoringCache();
  }
});

ipcMain.on("addCompetition", async (event, name) => {
  //console.log(name);
  var exists = await knex('competition').select('id').where({ name: name }).then(check_exist);
  if (exists) {
    dialog.showMessageBox(childWindow, {
      type: 'error',
      title: lang.errorExists.replace("%s", lang.competition),
      message: lang.errorExistsMsg.replace("%s", lang.competition),
      detail: lang.errorExistsMsgLong.replace("%s", lang.competition)
    }).then(data => {console.log(data)});
  } else {
    var success = await knex('competition').insert({ name: name }).catch(function(error) {
      dialog.showMessageBox(childWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorSaveToDB.replace("%s", lang.competition),
        detail: lang.errorSaveToDBLong + error.message
      }).then(data => {console.log(data)});
    });
    if (success) {
      mainWindow.webContents.reloadIgnoringCache();
    }
  }
});

ipcMain.on("delCompetition", async (event, id) => {
  //console.log(id);
  var exists = await knex('scores').select('id').where({ competition_id: id }).then(check_exist);
  if (exists || id === '1' || id === 1) {
    dialog.showMessageBox(childWindow, {
      type: 'error',
      title: lang.errorDelCompetition,
      message: lang.errorDelCompetitionMsg,
      detail: lang.errorDelCompetitionMsgLong
    }).then(data => {console.log(data)});
  } else {
    var success = await knex('competition').where({ id: id }).del().catch(function(error) {
      dialog.showMessageBox(childWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorDelFromDB.replace("%s", lang.competition),
        detail: lang.errorDelFromDBLong + error.message
      }).then(data => {console.log(data)});
    });
    if (success) {
      mainWindow.webContents.reloadIgnoringCache();
    }
  }
});

ipcMain.on("getCompetition", async (event, competition_id) => {
  var data = await knex.select('name').from('competition').where({id: competition_id});
  event.reply("gotCompetition", data);
  //console.log(data);
});

ipcMain.on("setCompetition", async (event, formData) => {
  //console.log(formData);
  if (formData.players == undefined || !Array.isArray(formData.players)) {
    dialog.showMessageBox(childWindow, {
      type: 'warning',
      title: lang.errorNoPlayers,
      message: lang.errorNoPlayersMsg,
      detail: lang.errorNoPlayersMsgLong
    }).then(data => {console.log(data)});
  } else {
    var players = formData.players;
    formData.players = formData.players.toString();
    var success = knex.transaction(trx => {
      const queries = [];
      const settings = ['date', 'team_type', 'teams', 'arrows', 'turns', 'score_min', 'score_max', 'competition', 'count_average', 'players'];
      settings.forEach(setting => {
        const query = knex('settings').where('setting', 'cur_' + setting).update('value',formData[setting]).transacting(trx); // This makes every update be in the same transaction
        queries.push(query);
      });
      Promise.all(queries) // Once every query is written
          .then(trx.commit) // We try to execute all of them
          .catch(trx.rollback); // And rollback in case any of them goes wrong
    });
    if (success) {
      createChildWindow('competition_players.html');
      if (formData['competition'] == 1) formData.players = await knex.select('id', 'first_name', 'last_name', 'team_id').from('guests').whereIn('id', players);
      else formData.players = await knex.select('id', 'first_name', 'last_name', 'team_id', 'average').from('players').whereIn('id', players);
      childWindow.once("ready-to-show", () => {
        childWindow.webContents.send("gotPlayers", formData);
      });
      //console.log(formData);
    }
  }
});

ipcMain.on("goCompetition", async (event, players) => {
  var setting = await knex.first('value').from('settings').where('setting', 'cur_competition').catch(function(error) {
    dialog.showMessageBox(childWindow, {
      type: 'error',
      title: lang.error,
      message: lang.errorGettingFromDB.replace("%s", lang.competition),
      detail: lang.errorGettingFromDBLong + error.message
    }).then(data => {console.log(data)});
  });
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, (setting.value == 1 ? "guests.html" : "competition.html")),
      protocol: "file:",
      slashes: true
    })
  );
  var success = await knex('settings').where({ setting: 'cur_players' }).update('value', JSON.stringify(players)).catch(function(error) {
    dialog.showMessageBox(childWindow, {
      type: 'error',
      title: lang.error,
      message: lang.errorUpdateDB.replace("%s", lang.temporaryData),
      detail: lang.errorUpdateDBLong + error.message
    }).then(data => {console.log(data)});
  });
  if (success) {
    knex('scores_temp').del().catch(function(error) {
      dialog.showMessageBox(childWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorDelFromDB.replace("%s", lang.temporaryData),
        detail: lang.errorDelFromDBLong + error.message
      }).then(data => {console.log(data)});
    });
    childWindow.close();
  }
});

ipcMain.on("getGame", async (event) => {
  var settings = await knex.select('*').from('settings').whereIn('setting', ['cur_team_type', 'cur_teams', 'cur_arrows', 'cur_turns', 'cur_score_min', 'cur_score_max', 'competition', 'cur_competition', 'cur_count_average', 'cur_date', 'cur_players']).catch(function(error) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: lang.error,
      message: lang.errorGettingFromDB.replace("%s", lang.competition + ' ' + lang.settings),
      detail: lang.errorGettingFromDBLong + error.message
    }).then(data => {console.log(data)});
  });
  var data = [];
  settings.forEach(setting => {
    data[setting.setting] = setting.value;
  });
  var teams = JSON.parse(data.cur_players);
  var players = [];
  teams.forEach(team => {
    players.push(...team);
  });
  data.competition_id = data.competition;
  if (data.cur_competition <= 2) data.competition_id = data.cur_competition; // Set to 0: "No Competition", 1: "Guest Archers" or 2: "Koningsschieten"
  var competition = await knex.first('*').from('competition').where('id', data.competition_id).catch(function(error) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: lang.error,
      message: lang.errorGettingFromDB.replace("%s", lang.competition),
      detail: lang.errorGettingFromDBLong + error.message
    }).then(data => {console.log(data)});
  });
  data.competition = competition.name;
  let select = ['id', 'first_name', 'last_name'];
  let table = 'guests';
  if (data.competition_id != 1) {
    select.push('average');
    table = 'players';
  }
  data.players = await knex.select(select).from(table).whereIn('id', players).catch(function(error) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: lang.error,
      message: lang.errorGettingFromDB.replace("%s", lang.players),
      detail: lang.errorGettingFromDBLong + error.message
    }).then(data => {console.log(data)});
  });
  //console.log(data);
  // Save data temporarily, to avoid losing data because of any crashes
  var exists = await knex.select('player_id').from('scores_temp').where({competition_id: data.competition_id, date: data.cur_date});
  if (!exists.length) {
    await knex('scores_temp').del().catch(function(error) {
      dialog.showMessageBox(childWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorDelFromDB.replace("%s", lang.temporaryData),
        detail: lang.errorDelFromDBLong + error.message
      }).then(data => {console.log(data)});
    });
    event.reply("gotGame", data);
  } else {
    var work = new Promise((resolve, reject) => {
      data.players.forEach(async (player, index, array) => {
        if (exists.length) {
          data.players[index].scores = await knex.select('*').from('scores_temp').where({player_id: player.id});
          //console.log('setting player scores!');
        }
        if (index === array.length -1) resolve();
      });
    });
    work.then(() => {
      event.reply("gotGame", data);
    });
  }
});

// Copy data from temporary table to scores table
ipcMain.on("saveGame", async (event) => {
  var data = await knex.select('*').from('scores_temp').orderBy('id');
  //console.log(data);
  var work = new Promise((resolve, reject) => {
    data.forEach(async (dat, index, array) => {
      delete dat.id; // Don't need temporary id
      var exists = await knex.select('id').from('scores')
        .where({player_id: dat.player_id, team_id: dat.team_id, competition_id: dat.competition_id, date: dat.date, round: dat.round, part: dat.part, range: dat.range });
      if (exists.length) {
        await knex('scores').where({ id: exists[0].id }).update(dat).catch(function(error) {
          dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: lang.error,
            message: lang.errorUpdateDB.replace("%s", lang.scores),
            detail: lang.errorUpdateDBLong + error.message
          }).then(data => {console.log(data)});
        });
      } else {
        await knex('scores').insert(dat).catch(function(error) {
          dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: lang.error,
            message: lang.errorSaveToDB.replace("%s", lang.scores),
            detail: lang.errorSaveToDBLong + error.message
          }).then(data => {console.log(data)});
        });
      }
      if (index === array.length -1) resolve();
    });
  });
  work.then(() => {
    knex('scores_temp').del().catch(function(error) {
      dialog.showMessageBox(childWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorDelFromDB.replace("%s", lang.temporaryData),
        detail: lang.errorDelFromDBLong + error.message
      }).then(data => {console.log(data)});
    });
    event.reply("savedGame");
  });
});

// Copy data from temporary table to scores table
ipcMain.on("saveGuestGame", async (event) => {
  var data = await knex.select('*').from('scores_temp').orderBy('id');
  //console.log(data);
  var work = new Promise((resolve, reject) => {
    data.forEach(async (dat, index, array) => {
      delete dat.id; // Don't need temporary id
      delete dat.competition_id; // Don't need competition id
      delete dat.count_average; // Don't need to count average
      dat.guest_id = dat.player_id;
      delete dat.player_id;
      var exists = await knex.select('id').from('scores_guests')
        .where({guest_id: dat.guest_id, team_id: dat.team_id, date: dat.date, round: dat.round, part: dat.part, range: dat.range });
      if (exists.length) {
        await knex('scores_guests').where({ id: exists[0].id }).update(dat).catch(function(error) {
          dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: lang.error,
            message: lang.errorUpdateDB.replace("%s", lang.guest + " " + lang.scores),
            detail: lang.errorUpdateDBLong + error.message
          }).then(data => {console.log(data)});
        });
      } else {
        await knex('scores_guests').insert(dat).catch(function(error) {
          dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: lang.error,
            message: lang.errorSaveToDB.replace("%s", lang.guest + " " + lang.scores),
            detail: lang.errorSaveToDBLong + error.message
          }).then(data => {console.log(data)});
        });
      }
      if (index === array.length -1) resolve();
    });
  });
  work.then(() => {
    knex('scores_temp').del().catch(function(error) {
      dialog.showMessageBox(childWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorDelFromDB.replace("%s", lang.temporaryData),
        detail: lang.errorDelFromDBLong + error.message
      }).then(data => {console.log(data)});
    });
    event.reply("savedGame");
  });
});

ipcMain.on("saveTempScore", async (event, formData) => {
  //console.log(formData);
  //console.log('Updating player ' + formData.player_id);
  var exists = await knex.select('id').from('scores_temp').where({ player_id: formData.player_id, round: formData.round, part: formData.part, date: formData.date });
  if (!exists.length) {
    var data = {
      player_id: formData.player_id, team_id: formData.team_id, round: formData.round, range: formData.range,
      date: formData.date, part: formData.part, points: formData.points, competition_id: formData.competition_id,
      arrow_1: formData.arrow_1, arrow_2: formData.arrow_2, arrow_3: formData.arrow_3, arrow_4: formData.arrow_4,
      arrow_5: formData.arrow_5, arrow_6: formData.arrow_6, arrow_7: formData.arrow_7, arrow_8: formData.arrow_8,
      arrow_9: formData.arrow_9, arrow_10: formData.arrow_10
    };
    //console.log(data);
    var success = await knex('scores_temp').insert(data).catch(function(error) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorSaveToDB.replace("%s", lang.temporaryData),
        detail: lang.errorSaveToDBLong + error.message
      }).then(data => {console.log(data)});
    });
  } else {
    var success = await knex('scores_temp').where({ player_id: formData.player_id, round: formData.round, part: formData.part }).update(formData).catch(function(error) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorUpdateDB.replace("%s", lang.temporaryData),
        detail: lang.errorUpdateDBLong + error.message
      }).then(data => {console.log(data)});
    });
  }
  if (!success) {
    event.reply('saveError', 'tempScore');
  }
});

ipcMain.on("saveTempPoints", async (event, formData) => {
  //console.log(formData);
  //console.log('Updating points for team: ' + formData.team_id);
  var exists = await knex.select('id').from('scores_temp').where({ team_id: formData.team_id, round: formData.round });
  if (!exists.length) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: lang.error,
      message: lang.errorSaveTemp,
      detail: lang.errorSaveTempLong.replace("%s", 'team_id: ' + formData.team_id + ', round: ' + formData.round)
    }).then(data => {console.log(data)});
  } else {
    var success = await knex('scores_temp').where({ team_id: formData.team_id, round: formData.round }).update('points', formData.points).catch(function(error) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorUpdateDB.replace("%s", lang.points),
        detail: lang.errorUpdateDBLong + error.message
      }).then(data => {console.log(data)});
    });
  }
  if (!success) {
    event.reply('saveError', 'tempPoints');
  }
});

ipcMain.on("saveTempPoint", async (event, formData) => {
  //console.log(formData);
  //console.log('Updating points for team: ' + formData.team_id);
  var exists = await knex.select('id').from('scores_temp').where({ player_id: formData.player_id, round: formData.round });
  if (!exists.length) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: lang.error,
      message: lang.errorSaveTemp,
      detail: lang.errorSaveTempLong.replace("%s", 'player_id: ' + formData.player_id + ', round: ' + formData.round)
    }).then(data => {console.log(data)});
  } else {
    var success = await knex('scores_temp').where({ player_id: formData.player_id, round: formData.round }).update('points', formData.points).catch(function(error) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorUpdateDB.replace("%s", lang.points),
        detail: lang.errorUpdateDBLong + error.message
      }).then(data => {console.log(data)});
    });
  }
  if (!success) {
    event.reply('saveError', 'tempPoints');
  }
});

ipcMain.on("getAllDates", async (event) => {
  var dates = await knex('scores').distinct('date').catch(function(error) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: lang.error,
      message: lang.errorGettingFromDB.replace("%s", lang.date),
      detail: lang.errorGettingFromDBLong + error.message
    }).then(data => {console.log(data)});
  });
  var gdates = await knex('scores_guests').distinct('date').catch(function(error) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: lang.error,
      message: lang.errorGettingFromDB.replace("%s", lang.date),
      detail: lang.errorGettingFromDBLong + error.message
    }).then(data => {console.log(data)});
  });

  event.reply("gotAllDates", dates.concat(gdates));
});

ipcMain.on("submitPlayer", async (event, formData) => {
  //console.log(formData);
  //console.log(formData.first_name);
  var data = {
    first_name: formData.first_name,
    last_name: formData.last_name,
    address: formData.address,
    postal: formData.postal,
    city: formData.city,
    email: formData.email,
    mobile: formData.mobile,
    phone: formData.phone,
    birthday: formData.birthday,
    joined: formData.joined,
    bow_number: formData.bow_number,
    function: formData.function,
    average: formData.average,
    active: formData.active,
    has_key: formData.has_key
  };
  if (formData.player_id !== undefined) {
    console.log('Updating player ' + formData.player_id);
    var success = await knex('players').where({ id: formData.player_id }).update(data).catch(function(error) {
      dialog.showMessageBox(childWindow, {
        type: 'error',
        title: lang.error,
        message: lang.errorUpdateDB.replace("%s", lang.players),
        detail: lang.errorUpdateDBLong + error.message
      }).then(data => {console.log(data)});
    });
    if (success) {
      mainWindow.webContents.reloadIgnoringCache();
      childWindow.close();
    }
  } else {
    var exists = await knex('players').select('id').where({
      first_name: formData.first_name,
      last_name:  formData.last_name
    }).then(check_exist);
    //console.log(exists);
    if (!exists) {
      var success = await knex('players').insert(data).catch(function(error) {
        dialog.showMessageBox(childWindow, {
          type: 'error',
          title: lang.error,
          message: lang.errorSaveToDB.replace("%s", lang.players),
          detail: lang.errorSaveToDBLong + error.message
        }).then(data => {console.log(data)});
      });
      if (success) {
        mainWindow.webContents.reloadIgnoringCache();
        childWindow.close();
      }
    } else {
      dialog.showMessageBox(childWindow, {
        type: 'warning',
        title: lang.errorExists,
        message: lang.errorExistsMsg.replace("%s", lang.player),
        detail: lang.errorExistsPlayer
      }).then(data => {console.log(data)});
    }
  }
});

ipcMain.on("deletePlayer", async (event, player_id) => {
  console.log(player_id);
  dialog.showMessageBox(childWindow, {
    type: 'question',
    title: lang.removePlayer,
    message: lang.removePlayerMsg,
    detail: lang.removePlayerMsgLong,
    buttons: [lang.yes, lang.no]
  }).then(async (result) => {
    // Bail if the user pressed "No" or escaped (ESC) from the dialog box
    if (result.response !== 0) { return; }
    if (result.response === 0) {
      //console.log('The "Yes" button was pressed');
      var success = await knex('players').where({ id: player_id }).del().catch(function(error) {
        dialog.showMessageBox(childWindow, {
          type: 'error',
          title: lang.error,
          message: lang.errorDelFromDB.replace("%s", lang.players),
          detail: lang.errorDelFromDBLong + error.message
        }).then(data => {console.log(data)});
      });
      if (success) {
        mainWindow.webContents.reloadIgnoringCache();
        childWindow.close();
      }
    }
  })
});

app.on("window-all-closed", () => {
  app.quit();
});
