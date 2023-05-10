CREATE TABLE "settings" (
	 "id" INTEGER NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
	 "setting" TEXT NOT NULL,
	 "value" TEXT NOT NULL
);
INSERT INTO `settings` (setting, value) VALUES ('language', 'nl-NL'),
 	('team_type', 'random'),
	('teams', 3),
	('arrows', 1),
	('turns', 10),
	('score_min', 5),
	('score_max', 10),
	('hide_fields', ''),
	('average_multiplier', 0.9),
	('competition', 1),
 	('cur_team_type', 'random'),
	('cur_teams', 3),
	('cur_arrows', 1),
	('cur_turns', 10),
	('cur_score_min', 5),
	('cur_score_max', 10),
	('cur_count_average', 1),
	('cur_competition', 1),
	('cur_date', '2023-03-03'),
	('cur_players', 1);

CREATE TABLE "team" (
	 "id" INTEGER NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
	 "name" TEXT NOT NULL,
	 "date" TEXT,
	 "counter" INTEGER,
	 "average" REAL
);

CREATE TABLE "players" (
	 "id" INTEGER NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
	 "first_name" TEXT NOT NULL,
	 "last_name" TEXT NOT NULL,
	 "address" TEXT,
	 "postal" TEXT,
	 "city" TEXT,
	 "phone" TEXT,
	 "mobile" TEXT,
	 "email" TEXT,
	 "bow_number" INTEGER,
	 "team_id" INTEGER,
	 "has_key" INTEGER,
	 "function" TEXT,
	 "birthday" TEXT,
	 "joined" TEXT,
	 "active" INTEGER NOT NULL DEFAULT 1,
	 "average" REAL
);

CREATE TABLE "competition" (
	 "id" INTEGER NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
	 "name" TEXT NOT NULL
);
INSERT INTO `competition` (id, name) VALUES (0, 'Geen Competitie'), (1, 'Gasten Schieten'), (2, 'Koningsschieten');

CREATE TABLE "scores" (
	"id" INTEGER NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
	"player_id" INTEGER NOT NULL,
	"team_id" INTEGER,
	"competition_id" INTEGER,
	"count_average" INTEGER,
	"date" TEXT,
	"points" INTEGER,
	"round" INTEGER,
	"part" INTEGER,
	"range" INTEGER,
	"arrow_1"	INTEGER,
	"arrow_2"	INTEGER,
	"arrow_3"	INTEGER,
	"arrow_4"	INTEGER,
	"arrow_5"	INTEGER,
	"arrow_6"	INTEGER,
	"arrow_7"	INTEGER,
	"arrow_8"	INTEGER,
	"arrow_9"	INTEGER,
	"arrow_10"	INTEGER
);

CREATE TABLE "scores_temp" (
	"id" INTEGER NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
	"player_id"	INTEGER NOT NULL,
	"team_id"	INTEGER,
	"competition_id"	INTEGER,
	"count_average"	INTEGER,
	"date"	TEXT,
	"points" INTEGER,
	"round"	INTEGER,
	"part"	INTEGER,
	"range"	INTEGER,
	"arrow_1"	INTEGER,
	"arrow_2"	INTEGER,
	"arrow_3"	INTEGER,
	"arrow_4"	INTEGER,
	"arrow_5"	INTEGER,
	"arrow_6"	INTEGER,
	"arrow_7"	INTEGER,
	"arrow_8"	INTEGER,
	"arrow_9"	INTEGER,
	"arrow_10"	INTEGER
);

CREATE TABLE "groups" (
	 "group_id" INTEGER NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
	 "group_name" TEXT NOT NULL UNIQUE,
	 "date" TEXT
);

CREATE TABLE "guests" (
	 "id" INTEGER NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
	 "first_name" TEXT NOT NULL,
	 "last_name" TEXT,
	 "team_id" INTEGER,
	 "group_name" TEXT NOT NULL
);

CREATE TABLE "scores_guests" (
	"id" INTEGER NOT NULL UNIQUE PRIMARY KEY AUTOINCREMENT,
	"guest_id" INTEGER NOT NULL,
	"team_id" INTEGER,
	"date" TEXT,
	"round" INTEGER,
	"part" INTEGER,
	"range" INTEGER,
	"points" INTEGER,
	"arrow_1" INTEGER,
	"arrow_2" INTEGER,
	"arrow_3" INTEGER,
	"arrow_4" INTEGER,
	"arrow_5" INTEGER,
	"arrow_6" INTEGER,
	"arrow_7" INTEGER,
	"arrow_8" INTEGER,
	"arrow_9" INTEGER,
	"arrow_10" INTEGER
);
