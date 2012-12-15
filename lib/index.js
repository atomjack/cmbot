var https = require('https');
var fs = require('fs');
var util = require('util');

var path = require('path');
var xml2js = require('xml2js');
var querystring = require('querystring');
var crypto = require('crypto');
var dateFormat = require('dateformat');
var Bot = require('ttapi');
var sprintf = require('sprintf').sprintf;
var myhttp = require('http-get');
var $ = require('jquery');
var twitter = require('ntwitter');
var Lastfm = require('simple-lastfm');

var User = require('./TTUser.js');
var Queue = require('./ttqueue.js');

process.on('uncaughtException', function(err) {
	log("uncaughtException: ", err);
	log("stack trace: ", err.stack);
});

var avatars = {
		'chinesegirl': 1,
		'greengirl': 2,
		'redheadgirl': 3,
		'gingergirl': 4,
		'whiteboy': 5,
		'tangirl': 6,
		'tanboy': 7,
		'gingerboy': 8,
		'blackboy': 34,
		'greenbear': 9,
		'greybear': 10,
		'greenbear': 11,
		'alienbear': 12,
		'aquabear': 13,
		'maroonbear': 14,
		'orangebear': 15,
		'blackbear': 16,
		'bluebear': 17,
		'lightbluecat': 18,
		'greencat': 19,
		'redcat': 121,
		'blondesuperboy': 20,
		'redheadsuperboy': 21,
		'hornedsuperboy': 22,
		'gorilla': 23,
		'boymonkey': 36,
		'girlmonkey': 37,
		'spaceman1': 27,
		'spaceman2': 28,
		'spaceman3': 29,
		'spaceman4': 30,
		'spaceman5': 31,
		'spaceman6': 32,
		'spaceman7': 33,
		'redspacemonkey': 218,
		'purplespacemonkey': 219,
		'burgundyspacemonkey': 220,
		'yellowspacemonkey': 221,
		'alien1': 222,
		'alien2': 223,
		'alien3': 224,
		'alien4': 225,
		'alien5': 226,
		'alien6': 227,
		'alien7': 228,
		'alien8': 229,
		'alien9': 230,
		'daftpunk1': 26,
		'daftpunk2': 35
};
var avatar_options = [];
for(var avatar in avatars)
	avatar_options.push(avatar);

var cmbot = function(_options) {
	var cmbot = this;
	this.VERSION = '0.9.6';
	
	this.initOptions(_options);
	this.currentSong = false;
	
	this.timezones =  {
		'EST': '-5',
		'CST': '-6',
		'MST': '-7',
		'PST': '-8',
	};
	this.bot = new Bot(this.options.bot.auth, this.options.bot.userid, this.options.bot.roomid);
	
	this.customEvents = {};
	this.customCommands = {};
	
	// Sqlite3
	if(this.options.sqlite.enabled) {
		try {
			var sqlite3 = require('sqlite3').verbose();
			this.sqlite = new sqlite3.Database(this.options.sqlite.file, function(error) {
				if(error != null) {
					log("Attempting to open sqlite3 database failed: ", err);
					this.options.sqlite.enabled = false;
				}
			});
		} catch (e) {
			log("Error setting up sqlite: ", e);
			this.options.sqlite.enabled = false;
		}
	}
	
	
//	this.setStrings();
	this.session = {
		nosong: false,
		lamed: false, // Has the bot lamed the currently playing track?
		scrobbled: false,
		current_scrobble: false, // timer for the current scrobble - if the user steps down or is taken down before the scrobble happens, cancel the timer to do the scrobble
		djs: [],
		custom_modules: false,
		djing: false, // is the bot dj'ing
		loved: false,
		autodjing: false, // If the bot autodj's, this will get set to true. When someone adds themselves to the queue, the bot will only step down if it automatically stepped up (ie, it won't step down if a mod made it dj manually)
		autodj: this.options.autodj,
		snagged: false,
		stfu: false,
		max_djs: 5,
		twitterVerification: {},
		current_dj: false, // Which dj is currently playing a song
		songstarted: false, // timestamp of when the current song started
		refreshes: [], // DJ's who are refreshing their browser
		warned: false,
		triggers: {},
		timers: {
			autodj: false,
			casinoWinnerAnnounce: false
		},
		current_song_tags: false,
		votes: {
			up: [],
			down: []
		},
		enforcement: true, // Queue enforcement
		queueTimer: {},
		lastfm: {
			enabled: false
		},
		start_time: new Date(),
		casino: false, // casino mode
		casino_data: {
			rolls: {},
			activeRolls: [],
			rollActive: false, // Users are currently /roll'ing to get a number to DJ
			winners: [],
			nums: [] // stores the numbers that have been rolled, so duplicates can be avoided
		}
	};
	
	if(this.options.modules_directory !== false) {
		var mstats = fs.lstatSync(this.options.modules_directory);
		if(mstats.isDirectory()) {
			this.session.custom_modules = true;
		}
		if(this.options.autoload_modules === true && this.session.custom_modules) {
			log("Autoloading modules");
			fs.readdir(cmbot.options.modules_directory, function(err, files) {
				files.sort();
				for(var i=0;i<files.length;i++) {
					var file = files[i];
					if(file.match(/\.js$/)) {
						try {
							var result = cmbot.loadModule(cmbot.options.modules_directory + "/" + file);
							for(var j=0;j<result.messages.length;j++)
								log(result.messages[j]);
						} catch(e) {
							log("Exception loading " + file + "module: ", e.stack);
						}
					}
				}
			});
		}
	}
	
	if(this.options.messages.length > 0)
		this.setupMessages(); // Start the timers to display informational messages
	this.settings = $.extend({
		shitlist: {},
		deckshitlist: {}, // Users not allowed to DJ
		idleDJTimeout: 15,
		setlimit: this.options.set_limit,
		triggerLimit: {},
		triggerBan: {},
		timezones: {},
		triggers: {},
		modtriggers: {},
		playcounts: {},
		twitterUsernames: {},
		modpm: true,
		modchat: {},
		room_name: false,
		room_shortcut: false,
		room_id: false,
		queue: [],
		phrases: {},
		bannedArtists: {},
		bannedSongs: {},
		mobileWhitelist: {},
		acl: {
			addacl: {},
			remacl: {}
		},
		lastfm_session_key: false
		}, this.loadSettings());

	this.initQueue();
	
	this.lastfm = false;
	if(this.options.lastfm.enabled === true) {
		if(this.settings.lastfm_session_key != undefined && this.settings.lastfm_session_key != '')
			this.options.lastfm.session_key = this.settings.lastfm_session_key;
		this.lastfm = new Lastfm(this.options.lastfm);
		if(this.options.lastfm.session_key === false) {
			this.lastfm.getSessionKey(function(result) {
				log("session key = " + result.session_key);
				cmbot.settings.lastfm_session_key = result.session_key;
				cmbot.saveSettings();
			});
		}
	}

	this.users = {};
	this.mods = {};
	
	this.commandAliases = {
		'commands': 'help',
		'unafk': 'back',
		'away': 'afk'
	};

	// Command Time Limits - how many seconds since the last time this command was said by any user before the bot will respond to it again
	this.commandTimeLimits = {
		triggers: 5,
		queue: 5,
		help: 5
	};
	
	this.customEventsSupported = [
	'speak', 'ready', 'roomChanged', 'update_votes', 'newsong', 'endsong', 'pmmed', 'add_dj', 'rem_dj', 'update_user', 'new_moderator',
	'rem_moderator', 'registered', 'deregistered', 'booted_user', 'snagged', 'nosong', 'tcpConnect', 'tcpMessage', 'tcpEnd',
	'httpRequest' ];

	this.commandTimestamps = {};
	this.triggerTimeStamps = {};

	this.twit = false;
	if(typeof this.options.twitter == 'object') {
		try {
			this.twit = new twitter({
				consumer_key: this.options.twitter.consumer_key,
				consumer_secret: this.options.twitter.consumer_secret,
				access_token_key: this.options.twitter.access_token_key,
				access_token_secret: this.options.twitter.access_token_secret
			});
			this.twit.verifyCredentials(function (err, data) {
				log("twitter verified");
//	        log(data);
			});
		} catch(e) {}
	}
	
	

	this.eventReady();
	
	this.eventRoomChanged();
	this.eventSpeak();
	this.eventPM();
	
	this.eventUpdateVotes();
	this.eventNewSong();
	this.eventNoSong();
	this.eventEndSong();
	this.eventAddDj();
	this.eventRemDj();
	this.eventUpdateUser();
	this.eventNewModerator();
	this.eventRemModerator();
	this.eventRegistered();
	this.eventDeregistered();
	this.eventBootedUser();
	this.eventSnagged();
	
	
	this.eventTcpConnect();
	this.eventTcpMessage();
	this.eventTcpEnd();
	this.eventHttpRequest();
	
	if(this.options.mysql.enabled) {
		var song_table = 'song';
		var songlog_table = 'songlog';
		var mysql = this.getMysqlClient();
		if(mysql !== false) {
			log("Checking for table '" + song_table + "':");
			mysql.query("show tables like '" + song_table + "'", 
				function selectCb(err, results, fields) {
				if(results.length == 0) {
					mysql.query(
							'CREATE TABLE IF NOT EXISTS `' + song_table + '` (' + 
							'`id` varchar(100) NOT NULL,' + 
							'`track` varchar(255) DEFAULT NULL,' + 
							'`artist` varchar(255) DEFAULT NULL,' + 
							'`album` varchar(255) DEFAULT NULL,' + 
							'`coverart` varchar(255) DEFAULT NULL,' + 
							'`length` int(11) DEFAULT NULL,' + 
							'`mnid` varchar(50) DEFAULT NULL,' + 
							'`genre` varchar(255) DEFAULT NULL,' + 
							'PRIMARY KEY (`id`)' + 
							') ENGINE=InnoDB DEFAULT CHARSET=utf8;', function(err) {
								log("Checking for table '" + songlog_table + "'");
								mysql.query("show tables like '" + songlog_table + "'", 
										function selectCb(err, results, fields) {
											if(results.length == 0) {
												mysql.query(
														'CREATE TABLE IF NOT EXISTS `' + songlog_table + '` (' + 
														'`songid` varchar(100) DEFAULT NULL,' + 
														'`starttime` datetime NOT NULL,' + 
														'`upvotes` int(11) DEFAULT NULL,' + 
														'`downvotes` int(11) DEFAULT NULL,' + 
														'PRIMARY KEY (`starttime`),' + 
														'KEY `songid` (`songid`)' + 
														') ENGINE=InnoDB DEFAULT CHARSET=utf8;', function(err) {
															mysql.query(
																'ALTER TABLE `' + songlog_table + '`' + 
																'ADD CONSTRAINT `' + songlog_table + '_ibfk_1` FOREIGN KEY (`songid`) REFERENCES `' + song_table + '` (`id`);', function(err) {
																	log("Done!");
																});
															mysql.end();
														});
											} else
												mysql.end();
								});
							});
				} else
					mysql.end();
			});
		} else {
			log("Error: mysql doesn't seem to be installed.");
		}
	} else if(this.options.sqlite.enabled) {
		log("Sqlite3:");
		var song_table = 'song';
		var songlog_table = 'songlog';
		var cmbot = this;
		
		cmbot.sqlite.run('CREATE TABLE IF NOT EXISTS `' + song_table + '` (' + 
				'`id` varchar(100) NOT NULL, ' + 
				'`track` varchar(255) DEFAULT NULL, ' + 
				'`artist` varchar(255) DEFAULT NULL, ' + 
				'`album` varchar(255) DEFAULT NULL, ' + 
				'`coverart` varchar(255) DEFAULT NULL, ' + 
				'`length` int(11) DEFAULT NULL, ' + 
				'`mnid` varchar(50) DEFAULT NULL, ' + 
				'`genre` varchar(255) DEFAULT NULL, PRIMARY KEY (`id`))', function(err, changes) {
			if(err != null) {
				log("Something went wrong trying to initialize the song table: ", err);
				cmbot.options.sqlite.enabled = false;
			} else {
				cmbot.sqlite.run('CREATE TABLE IF NOT EXISTS `' + songlog_table + '` (' + 
					'`songid` varchar(100) DEFAULT NULL,' + 
					'`starttime` datetime NOT NULL,' + 
					'`upvotes` int(11) DEFAULT NULL,' + 
					'`downvotes` int(11) DEFAULT NULL,' + 
					'PRIMARY KEY (`starttime`) ' +
					'FOREIGN KEY (`songid`) REFERENCES song(`id`)' +
					')', function(err, changes) {
					if(err != null) {
						log("Something went wrong trying to initialize the songlog table: ", err);
						cmbot.options.sqlite.enabled = false;
					}
				});
					
			}
		});
	}
};

cmbot.prototype.addCommand = function(commandName, obj) {
	if(this.commands[commandName] == undefined) {
		log("!!!!!! NOTE: addCommand is deprecated and will be disabled in a future release. Please use dynamic modules instead.");
		this.customCommands[commandName] = obj;
		log("Command " + commandName + " added");
	} else {
		log("Command " + commandName + "not added as there already exists a command by that name.");
	}
};

cmbot.prototype.eventReady = function() {
	var cmbot = this;
	this.bot.on('ready', function () {
		cmbot.bot.roomRegister(cmbot.options.bot.roomid);
		cmbot.doCustomEvents('ready');
	});
};

cmbot.prototype.eventRoomChanged = function() {
	var cmbot = this;
	this.bot.on('roomChanged',  function (data) {
//		log("room changed: ", data);
//		log("djs:", data.room.metadata.js);
//		log("data: ", data.room.metadata.current_song);
		cmbot.currentSong = data;
		cmbot.session.djs = data.room.metadata.djs;
		cmbot.session.max_djs = data.room.metadata.max_djs;
		
		if(cmbot.settings.room_name === false || cmbot.settings.room_id === false) {
			cmbot.settings.room_name = data.room.name;
			if(data.room.shortcut != '')
				cmbot.settings.room_shortcut = data.room.shortcut;
			cmbot.settings.room_id = data.room.roomid;
			cmbot.saveSettings();
		}
		
		$.each(data.room.metadata.votelog, function(index, vote) {
			var userid = vote[0];
			var upordown = vote[1];
			if(cmbot.session.votes['up'].indexOf(userid) > -1)
				cmbot.session.votes['up'].splice(cmbot.session.votes['up'].indexOf(userid), 1);
			if(cmbot.session.votes['down'].indexOf(userid) > -1)
				cmbot.session.votes['down'].splice(cmbot.session.votes['down'].indexOf(userid), 1);
			if(cmbot.session.votes[upordown] == undefined)
				cmbot.session.votes[upordown] = [];
			cmbot.session.votes[upordown].push(userid);
		});

		
		
		// If the current song hasn't been scrobbled yet, scrobble it
//		var timeCode =  (currentSong.room.metadata.current_song.starttime * 1000) - now();
//		log("song has been playing for " + timeCode + " seconds");
		//1328209511314 (now)
		//1328222953.3 (starttime)
		if(data.room.metadata.upvotes > 10)
			cmbot.session.loved = true;
		
//		log("users: ", data.users);
		
		$(data.room.metadata.moderator_id).each(function(index, value) {
			cmbot.mods[value] = 1;
		});
		try {
			
			//fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings));
		} catch(e) {
			
		}

		
		$(data.users).each(function(index, user) {
			if (typeof cmbot.users[user.userid] != 'object') {
				if(user.acl > 0)
					cmbot.mods[user.userid] = 1;
				var newUser = new User({userid: user.userid, name: user.name, mod: cmbot.mods[user.userid] == 1 || user.acl > 0, laptop: user.laptop});
				if(user.acl == 1)
					newUser.role = "superuser";
				else if(user.acl == 2)
					newUser.role = "gatekeeper";
				cmbot.users[user.userid] = newUser;
			}
		});
		$.each(cmbot.q.getQueue(), function(index, userid) {
			if(cmbot.users[userid] == undefined) {
				log("removing user " + userid + " from queue.");
				cmbot.q.removeUser({userid: userid});
			}
		});
		
		if(cmbot.settings.idleDJTimeout !== false) {
			$(cmbot.session.djs).each(function(index, userid) {
				cmbot.users[userid].djing = true;
				cmbot.activateIdleDJCheck(cmbot.users[userid]);
			});
		}
		cmbot.loadPlayCounts();
		cmbot.autodj();
		cmbot.doCustomEvents('roomChanged', data);
	});
};

cmbot.prototype.eventSpeak = function() {
	var cmbot = this;
	this.bot.on('speak', function (data) {
//		log("received speak: ", data);
		var user = cmbot.users[data.userid];
		if(typeof user == 'object') {
//			log("setting last interaction for user to now: ", users[data.userid]);
			user.lastInteraction = now();
			if(user.djing && cmbot.settings.idleDJTimeout !== false)
				cmbot.activateIdleDJCheck(user);
			clearTimeout(user.timers.idleDJRemove);
			user.timers.idleDJRemove = false;
			clearTimeout(user.timers.idleDJEscort);
			user.idleDJEscort = false;
		}
		data.origin = 'chat';
		if (data.text.match(/^[\\]*\//) && data.userid != cmbot.options.bot.userid) 
			cmbot.reactToCommand(data);
		else 
			if (data.userid != cmbot.options.bot.userid) { // Don't react to what the bot says
//				cmbot.monitorAfk(data);
				cmbot.reactToSpeak(data);
			}
		cmbot.doCustomEvents('speak', data);
	});
};

cmbot.prototype.eventPM = function() {
	var cmbot = this;
	this.bot.on('pmmed', function(data) {
		if(cmbot.users[data.senderid] == undefined)
			return false;
		var userid = data.senderid;
		if(cmbot == undefined || cmbot.users == undefined)
			return false;
		if(!cmbot.users[userid].present)
			return false;
		var command = arg = '';
		if(data.text.match(/^[\\]*\/([^ ]+)\s{0,1}(.*)$/)) {
			command = RegExp.$1;
			arg = RegExp.$2;
		}
		command = command.toLowerCase();
		
		log("received a PM from: " + cmbot.users[userid].name + ": " + data.text);

		if(cmbot.commandAliases[command] != undefined)
			command = cmbot.commandAliases[command];
		
		var theCommand = false;
		if(typeof cmbot.commands[command] == 'object') {
			theCommand = cmbot.commands[command];
		} else if(typeof cmbot.customCommands[command] == 'object') {
			theCommand = cmbot.customCommands[command];
		}
		
		if(theCommand !== false) {
		
//		if(typeof cmbot.commands[command] == 'object') {
			log("found a command: " + command);
			if(typeof theCommand.command == 'function') {//} && theCommand.pmonly) {
//				log("command: ", theCommand);
//				log("user: ", cmbot.users[userid]);
				if(!theCommand.modonly || cmbot.users[userid].mod) {
					var go = true;
					if(theCommand.acl === true)
						go = false; // Enforce ACL restrictions
					if(cmbot.settings.acl[command] != undefined) {
						go = false;
						if(cmbot.settings.acl[command][userid])
							go = true;
					}
					if(cmbot.options.master_userid.indexOf(userid) > -1)
						go = true;
					if(go)
						theCommand.command({
								cmbot: cmbot,
								pm: true, 
								userid: userid,
								arg: arg
							});
					else
						cmbot.bot.pm("You don't have permission to run that command.", userid);
				}
			}
		} else if (cmbot.settings.modtriggers[escape(command)] != undefined && cmbot.users[userid].mod) {
			cmbot.doModTrigger(userid, command);
		} else if (cmbot.settings.triggers[escape(command)] != undefined) {
			cmbot.doTrigger(userid, command);
		} else if(command == '' || command == 'me') {
			if(cmbot.users[userid].mod) {
				if(cmbot.settings.modpm) {
					if(cmbot.settings.modchat[userid] !== false) {
						log("Sending this to all mods: " + data.text);
						cmbot.modpm(data.text, false, userid);
					} else {
						cmbot.bot.pm("Sorry, but you have modchat off. Type /modchat on to turn it on.", userid);
					}
				}
			} else {
				cmbot.bot.pm("Sorry, but I'm not a real person. Please PM a mod for help, or, for a list of commands I respond to, PM me '/help'.", userid);
			}
		}
		cmbot.doCustomEvents('pmmed', data);
	});
};

cmbot.prototype.eventUpdateVotes = function() {
	var cmbot = this;
	this.bot.on('update_votes', function (data) {
//		log("Someone voted: ", data);
//		log("votelog: ", data.room.metadata.votelog);
		$.each(data.room.metadata.votelog, function(index, vote) {
			var userid = vote[0];
			var upordown = vote[1];
			if(userid != '') {
				if(cmbot.session.votes['up'].indexOf(userid) > -1)
					cmbot.session.votes['up'].splice(cmbot.session.votes['up'].indexOf(userid), 1);
				if(cmbot.session.votes['down'].indexOf(userid) > -1)
					cmbot.session.votes['down'].splice(cmbot.session.votes['down'].indexOf(userid), 1);
				if(cmbot.session.votes[upordown] == undefined)
					cmbot.session.votes[upordown] = [];
				cmbot.session.votes[upordown].push(userid);
			}
		});
		
		
		
		var userid = 0;
		$(data.room.metadata.votelog[0]).each(function(index, prop) {
			userid = prop;
			return false;
		});
		if (typeof cmbot.users[userid] == 'object') {
			cmbot.users[userid].lastInteraction = now();
			try {
				clearTimeout(cmbot.users[userid].timers.idleDJRemove);
				cmbot.users[userid].idleDJRemove = false;
				clearTimeout(cmbot.users[userid].timers.idleDJEscort);
				cmbot.users[userid].idleDJEscort = false;
				if(cmbot.users[userid].djing && cmbot.settings.idleDJTimeout !== false)
					cmbot.activateIdleDJCheck(cmbot.users[userid]);
			} catch(e) {
				log("Exception clearing timeout: ", e);
			}
		}
		// If 5 users or over 20% of the population in the room (whichever is lower) have upvoted, then up vote
		var numUsers = 0;
		$.each(cmbot.users, function(userid, user) {
			if(user.present)
				numUsers++;
		});
		//autobop_threshold_number
		//autobop_threshold_percentage
		if(cmbot.options.autobop_threshold_number !== false) {
			var autobop_threshold = cmbot.options.autobop_threshold_number;
			if(cmbot.options.autobop_threshold_percentage !== false) {
				if(Math.floor(numUsers * (cmbot.options.autobop_threshold_percentage / 100)) < autobop_threshold)
					autobop_threshold = Math.floor(numUsers * (cmbot.options.autobop_threshold_percentage / 100));
			}
//			log("With " + numUsers + " users, autobop_threshold = " + autobop_threshold);
			if (userid != cmbot.options.bot.userid) {
				if (data.room.metadata.upvotes >= autobop_threshold && !cmbot.session.lamed) 
					cmbot.bot.vote('up');
				if (data.room.metadata.upvotes > cmbot.options.snag_threshold && !cmbot.session.loved && cmbot.currentSong.room.metadata.current_song.metadata.song != 'Untitled' && cmbot.currentSong.room.metadata.current_song.metadata.artist != 'Unknown') {
					log("Yoinking track");
					cmbot.yoinkTrack();
					cmbot.bot.snag();
					cmbot.session.loved = true;
				}
			}
		}
		cmbot.doCustomEvents('update_votes', data);
	});
};

cmbot.prototype.eventNewSong = function() {
	var cmbot = this;
	this.bot.on('newsong', function(data) {
		cmbot.session.nosong = false;
		cmbot.session.lamed = false;
		cmbot.session.loved = false;
		cmbot.session.warned = false;
		cmbot.session.current_song_tags = false;
		cmbot.session.snagged = false;
		cmbot.session.votes = {
			up: [],
			down: []
		};
//		log("song started: %o", data);
//		log("djs: %o", data.room.metadata.djs);
		cmbot.currentSong = data;
		var song = data.room.metadata.current_song;
		log("New song playing: " + song.metadata.song + " by " + song.metadata.artist + " dj'd by " + song.djname);
		var artist = song.metadata.artist;
		var banned = false;
		for(var bannedArtist in cmbot.settings.bannedArtists) {
			var checkArtist = bannedArtist.toLowerCase();
			if(checkArtist == artist.toLowerCase()) {
				cmbot.bot.speak(song.djname + ", " + artist + " is banned!");
				cmbot.bot.remDj(song.djid);
				banned = true;
			}
		}
		if(cmbot.settings.bannedSongs[artist.toLowerCase()] != undefined) {
			if(cmbot.settings.bannedSongs[artist.toLowerCase()].indexOf(song.metadata.song.toLowerCase()) != -1) {
				cmbot.bot.speak(song.djname + ", " + song.metadata.song + " by " + artist + " is banned! Please skip or you will be removed from the decks in 15 seconds");
				var warnUser = cmbot.users[song.djid];
				warnUser.timers.warning = setTimeout(function() {
					cmbot.bot.remDj(warnUser.userid);
					cmbot.bot.pm("Sorry, you didn't skip in time.", warnUser.userid);
				}, 15*1000);
			}
		}
		if(banned) {
			return false;
		}
		cmbot.session.current_dj = song.djid;
		
		if(cmbot.options.scrobble === true && cmbot.lastfm !== false) {
			// Set a timer to scrobble this play
			var length = song.metadata.length;
			if (length > 30) { // Don't scrobble tracks under 30 seconds
				
				cmbot.lastfm.scrobbleNowPlayingTrack({
					artist: song.metadata.artist,
					track: song.metadata.song,
					callback: function(result) {
						log(result.success ? "Track scrobbled (now playing)." : "Error scrobbling (now playing) track: " + result.error);
					}
				});
				var scrobbleAt = length / 2 < 60 * 4 ? length / 2 : 60 * 4;
				var scrobbleTime = Math.floor(now() / 1000);
//				log("scrobble at: " + scrobbleAt);
				cmbot.session.current_scrobble = setTimeout(function() {
					cmbot.session.current_scrobble = false;
					cmbot.lastfm.scrobbleTrack({
						artist: song.metadata.artist,
						track: song.metadata.song,
						timestamp: scrobbleTime,
						callback: function(result) {
							log(result.success ? song.metadata.song + " by " + song.metadata.artist + " scrobbled." : "Error scrobbling track: " + result.error);
							cmbot.session.scrobbled = true;
	//						log("Scrobbled: ", result);
						}
					});
				}, scrobbleAt*1000);
			}
		}
		// Tweet
		if(cmbot.twit !== false && cmbot.options.twitter.tweet_text != '' && cmbot.options.twitter.tweet_songs) {
			var text = cmbot.options.twitter.tweet_text;
			var djname = cmbot.users[song.djid].name;
			if(cmbot.settings.twitterUsernames[song.djid] != undefined) {
				djname = "@" + cmbot.settings.twitterUsernames[song.djid];
			}
			text = text.replace('%djname%', djname);
			text = text.replace('%song%', song.metadata.song);
			text = text.replace('%artist%', song.metadata.artist);
			text = text.replace('%roomname%', cmbot.settings.room_name);
			text = text.replace('%roomurl%', 'http://turntable.fm/' + cmbot.settings.room_shortcut);
			cmbot.twit.updateStatus(text,
				function (err, data) {
					log("tweeted");
				}
			);
		}
		cmbot.session.scrobbled = false;
		cmbot.doCustomEvents('newsong', data);
	});
};

cmbot.prototype.eventEndSong = function() {
	var cmbot = this;
	this.bot.on('endsong', function(data) {
//		log("song ended: ", data);
		var songstarted = cmbot.session.songstarted;
		cmbot.session.songstarted = now();
		cmbot.session.snagged = false;
		
		try {
			if (cmbot.currentSong !== false) {
				if(data.room.metadata.current_dj == cmbot.options.bot.userid) {
					try {
						cmbot.bot.playlistAll(function(res) {
							log("length: " + $(res.list).length);
							var plLength = $(res.list).length;
							var r = getRandomNumber(20, plLength);
							var song = res.list[r];
							log("Putting " + song.metadata.song + " by " + song.metadata.artist + " at the top of my queue.");
							cmbot.bot.playlistReorder(r, 0, function(result) {
								if(result.success) {
									log("Random song chosen.");
								}
							});
						});
					} catch(e) {
						log("Exception trying to put a random song at the top of the bot's queue: ", e);
					}
					
					if(cmbot.q.getQueueLength(true) > 0) {
						cmbot.bot.remDj(cmbot.options.bot.userid, function(result) {
							cmbot.users[cmbot.options.bot.userid].djing = false;
							cmbot.session.djing = false;
						});
					}
				}
				if(cmbot.session.current_scrobble !== false) {
					clearTimeout(cmbot.session.current_scrobble);
				}
				if(cmbot.options.mysql.enabled) {
					var mysql = cmbot.getMysqlClient();
					if(mysql !== false) {
						var song = cmbot.currentSong.room.metadata.current_song;
						mysql.query("SELECT id FROM song WHERE id = '" + cmbot.currentSong.room.metadata.current_song._id + "'", 
							function selectCb(err, results, fields) {
								log("results: ", results);
								if(err) {
									log("MYSQL ERROR LOOKING FOR SONG! ", err);
								}
								if(results.length == 0) {
									// Save this song
									mysql.query("INSERT INTO song VALUES(?, ?, ?, ?, ?, ?, ?, ?)", 
									[
									 	song._id,
									 	song.metadata.song.replace('/\\/', ''),
									 	song.metadata.artist.replace('/\\/', ''),
									 	song.metadata.album.replace('/\\/', ''),
									 	song.metadata.coverart,
									 	song.metadata.length,
									 	song.metadata.mnid,
									 	song.metadata.genre != undefined ? song.metadata.genre.replace('/\\/', '') : ''
									]
									);
								}
								// Now save the play
								var insert_array = [
													 song._id,
													 songstarted !== false ? songstarted / 1000 : (now() / 1000) - data.room.metadata.current_song.metadata.length,
													 parseInt(data.room.metadata.upvotes),
													 parseInt(data.room.metadata.downvotes)
													];
								log("insert array: ", insert_array);
								mysql.query("INSERT INTO songlog VALUES (?, DATE_FORMAT(FROM_UNIXTIME(?), '%Y-%m-%d %k:%i:%s'), ?, ?)",
									insert_array
								);
								mysql.end();
							}
						);
					} else {
						log("Error: mysql doesn't seem to be installed.");
					}
				} else if(cmbot.options.sqlite.enabled) {
					var song = cmbot.currentSong.room.metadata.current_song;
					cmbot.sqlite.get("SELECT id FROM song where id = ?", cmbot.currentSong.room.metadata.current_song._id, function(err, row) {
						if(err != undefined) {
							log("An error occured trying to save a play: ", err);
						} else {
							if(row == undefined) {
								// Song doesn't exist, so create it
								cmbot.sqlite.run("INSERT INTO song VALUES(?, ?, ?, ?, ?, ?, ?, ?)", 
									[
									 	song._id,
									 	song.metadata.song.replace('/\\/', ''),
									 	song.metadata.artist.replace('/\\/', ''),
									 	song.metadata.album.replace('/\\/', ''),
									 	song.metadata.coverart,
									 	song.metadata.length,
									 	song.metadata.mnid,
									 	song.metadata.genre != undefined ? song.metadata.genre.replace('/\\/', '') : ''
									]);
							}
							// Now save the play
							var insert_array = [
												 song._id,
												 songstarted !== false ? songstarted / 1000 : (now() / 1000) - data.room.metadata.current_song.metadata.length,
												 parseInt(data.room.metadata.upvotes),
												 parseInt(data.room.metadata.downvotes)
												];
							log("insert array: ", insert_array);
							cmbot.sqlite.run("INSERT INTO songlog VALUES (?, strftime(\"%s\", ?, 'localtime'), ?, ?)",
								insert_array
							);
						}
					});
				}
				
				if(cmbot.options.scrobble === true && cmbot.lastfm !== false) {
					var length = cmbot.currentSong.room.metadata.current_song.metadata.length;
					var scrobbleAt = length / 2 < 60 * 4 ? length / 2 : 60 * 4;
//					log("scrobbled: " + cmbot.session.scrobbled);
//					log("length: " + length);
					if(!cmbot.session.scrobbled && length > 30) { // This track hasn't been scrobbled yet
						var scrobbleTime = Math.floor((now() / 1000) - length);
//						log("now = " + now());
//						log("length = " + length);
//						log("(now() / 1000) - scrobbleAt = "  + ((now() / 1000) - scrobbleAt));
//						log("session.start_time.getTime() / 1000 = " + (cmbot.session.start_time.getTime() / 1000));
						
						if((now() / 1000) - scrobbleAt > cmbot.session.start_time.getTime() / 1000) { // If the bot started up before the middle of this song elapsed, scrobble it
							log("Scrobbling track!"); 
							cmbot.lastfm.scrobbleTrack({
								artist: cmbot.currentSong.room.metadata.current_song.metadata.artist,
								track: cmbot.currentSong.room.metadata.current_song.metadata.song,
								timestamp: scrobbleTime,
								callback: function(result) {
									log(result.success ? "Track scrobbled. (" + cmbot.currentSong.room.metadata.current_song.metadata.artist + " - " + cmbot.currentSong.room.metadata.current_song.metadata.song + ") " : "Error scrobbling track: " + result.error);
									cmbot.session.scrobbled = true;
								}
							});
						}
					}
				}
				if(cmbot.session.casino) {
					cmbot.bot.remDj(cmbot.currentSong.room.metadata.current_dj);
//					if(!cmbot.session.casino_data.rollActive)
//						cmbot.activateCasinoRollTimer();
				} else {
					var userid = cmbot.currentSong.room.metadata.current_dj;
					var user = cmbot.users[userid];
					clearTimeout(user.timers.warning);
					user.playcount++;
					cmbot.savePlayCounts();
					if (((user.playcount == cmbot.settings.setlimit && cmbot.session.enforcement) || user.escortme)) {
						user.escortme = false;
						log(user.name + " has hit song limit of " + cmbot.settings.setlimit + ", removing from the decks.");
						cmbot.bot.remDj(user.userid);
					} else if(user.idleDJEscort) {
						// User's song was playing when they reached their idle limit, so give them a warning and remove them from the decks in 1 unless they chat/vote (the timer gets reset in those events)
						user.idleDJEscort = false;
						cmbot.bot.pm('@' + user.name + ', you have one minute to chat or vote before being taken down from the decks. (' + cmbot.settings.idleDJTimeout + ' minute idle limit)', user.userid);
						user.timers.idleDJRemove = setTimeout(function(){
	//						log("Removing idle dj " + user.name + " who has been idle for " + diff + " minutes.");
							if(cmbot.session.current_dj != user.userid)
								cmbot.bot.remDj(user.userid);
							else {
								user.idleDJEscort = true;
							}
						}, 60 * 1000);
					}
				}
				
			}
		} 
		catch (e) {
			log("EXCEPTION! ", e);
		}
		cmbot.doCustomEvents('endsong', data);
	});
};

cmbot.prototype.eventNoSong = function() {
	var cmbot = this;
	this.bot.on('nosong', function(data) {
		cmbot.session.nosong = true;
		cmbot.doCustomEvents('nosong', data);
	});
};

cmbot.prototype.eventAddDj = function() {
	var cmbot = this;
	this.bot.on('add_dj', function(data) {
		var newDj = cmbot.users[data.user[0].userid];
		if(newDj.userid == cmbot.options.bot.userid) {
			cmbot.session.djing = true;
			cmbot.bot.playlistAll(function(res) {
				try {
					log("length: " + $(res.list).length);
					var plLength = $(res.list).length;
					// First song
					var r = getRandomNumber(20, plLength);
					var song = res.list[r];
					log("Putting " + song.metadata.song + " by " + song.metadata.artist + " at the top of my queue.");
					cmbot.bot.playlistReorder(r, 0, function(result) {
						if(result.success) {
							log("Random song chosen.");
						} else {
							log("Failed to reorder playlist: ", result);
						}
					});
				} catch(e) {}
				});
		}
		
		if(cmbot.settings.deckshitlist[newDj.userid] != undefined) {
			// User is banned from DJ'ing
			cmbot.bot.remDj(newDj.userid);
			cmbot.bot.pm("You are banned from DJ'ing" + (cmbot.settings.deckshitlist[newDj.userid].reason == "" ? "." : ": " + cmbot.settings.deckshitlist[newDj.userid].reason), newDj.userid, function(result) {
				if(!result.success) {
					cmbot.bot.speak("You are banned from DJ'ing, " + cmbot.users[options.userid].name + (cmbot.settings.deckshitlist[newDj.userid].reason == "" ? "." : ": " + cmbot.settings.deckshitlist[newDj.userid].reason));
				}
			});
		}
		
		try {
//			log("User laptop: " + newDj.laptop);
			if(!cmbot.options.allow_mobile_djs && !newDj.mod && (newDj.laptop == 'iphone' || newDj.laptop == 'android') && cmbot.settings.mobileWhitelist[newDj.userid] == undefined) {
				// Look at past escorts, and if there are 3 in the last 10 seconds, kick the user
				if (newDj.escorts == undefined) 
					newDj.escorts = [];
				newDj.escorts.push(now());
				var numEscorts = 0;
				for(var e=0;e<newDj.escorts.length;e++) {
					var escortTimestamp = newDj.escorts[e];
					if (((now() - escortTimestamp) / 1000) < 10) {
						numEscorts++;
					}
				}
				log("numEscorts: " + numEscorts);
				if (numEscorts >= 3) {
					cmbot.bot.bootUser(newDj.userid, "Sorry but you must be whitelisted in order to DJ from a mobile device. Let a mod know what you were going to play and they will whitelist you.");
					cmbot.bot.speak("Hasta la vista, meatbag! http://goo.gl/krnve");
				}
				else {
					cmbot.bot.remDj(newDj.userid);
					if(numEscorts <= 1) {
						cmbot.bot.speak(newDj.name + ", sorry but you must be whitelisted in order to DJ from a mobile device. Let a mod know what you were going to play and they will whitelist you.");
					}
				}
//				return false;
			}
		} catch(e) {
			log("Exception checking laptop: ", e);
		}
		
		
		
		newDj.lastInteraction = now();
		newDj.escorted = false;
		
		if(cmbot.settings.idleDJTimeout !== false)
			cmbot.activateIdleDJCheck(newDj);
		
		
		if (!cmbot.isFFA()) {
			// If there's a queue, make sure the person who steps up is the first non-afk person in the queue
			var foundUser = false;
			if (!newDj.refresh) {
				var numDjs = cmbot.session.djs.length + 1; // Need to add one because we haven't pushed this dj onto the array yet
				var freeSpots = cmbot.session.max_djs - numDjs;
				var queueLength = cmbot.q.getQueueLength();
				var queueSpot = -1;
				if(cmbot.session.refreshes.length <= freeSpots && cmbot.session.refreshes.indexOf(newDj.userid) == -1 && cmbot.session.enforcement && queueSpot > -1) {
					log("There's a user refreshing but someone else stepped up.");
				} else if (queueLength > 0 && freeSpots <= queueLength && cmbot.session.refreshes.indexOf(newDj.userid) == -1) {
					var idx = 0;
					$(cmbot.q.getQueue()).each(function(index, userid){
						if(userid == newDj.userid)
							queueSpot = idx;
						if(typeof cmbot.users[userid] == 'object')
							if(!cmbot.users[userid].afk)
								idx++;
						
					});
					log("queueSpot = " + queueSpot);
					log("freespots = " + freeSpots);
					if(queueSpot == -1) {
						log("User is not in queue");
					}
					if(queueSpot > 0 && queueSpot >= freeSpots) {
						log("queuespot is greater than free spots & > 0");
					}
				}
				
				// If there is a queue
				// AND the number of free spots is less than or equal to the length of the queue
				// AND (the user is not in the queue or there are more non-afk users in front of them in the queue than there are free spots
				// Then escort them.
				if (queueLength > 0 && freeSpots <= queueLength && (queueSpot == -1 || queueSpot > freeSpots)) {
					$(cmbot.q.getQueue()).each(function(index, userid){
						var user = cmbot.users[userid];
						try {
							if (!user.afk && user.present) {
								log("found non afk user: " + user.name);
								try {
									if (user.userid != newDj.userid && !foundUser && cmbot.session.enforcement) {
										// Look at past escorts, and if there are 3 in the last 10 seconds, kick the user
										if (newDj.escorts == undefined) 
											newDj.escorts = [];
										newDj.escorts.push(now());
										var numEscorts = 0;
										for(var e=0;e<newDj.escorts.length;e++) {
											var escortTimestamp = newDj.escorts[e];
											if (((now() - escortTimestamp) / 1000) < 10) {
												numEscorts++;
											}
										}
										log("numEscorts: " + numEscorts);
										if (numEscorts >= 3) {
											cmbot.bot.bootUser(newDj.userid, "We have a queue here, please check your message window.");
//											bot.pm("http://goo.gl/krnve", newDj.userid);
											cmbot.bot.speak("Hasta la vista, meatbag! http://goo.gl/krnve");
										}
										else {
											if(numEscorts <= 1)
												cmbot.bot.pm(":warning:" + user.name + " is next in the queue. Type /addme to add yourself. :warning:", newDj.userid, function(result) {
													if(!result.success && result.errid == 5) {
														cmbot.bot.speak(":warning: " + newDj.name + ", " + user.name + " is next in the queue. Type /addme to add yourself. :warning:", newDj.userid);
													}
												}); //cmbot.bot.speak("@" + newDj.name + ", " + user.name + " is next in the queue. Type /addme to add yourself.");
											cmbot.bot.remDj(newDj.userid);
											newDj.escorted = true;
											newDj.djing = false;
										}
									}
								} 
								catch (e) {
									log("Exception checking users: ", e);
								}
								foundUser = true;
								return false;
							} else if(userid == data.userid) {
								// The user who stepped up is afk, and is currently in the queue, before any non-afk users, so remove them from the queue.
								foundUser = true;
								return false;
							}
						} 
						catch (e) {
						}
					});
				} else if(queueSpot > -1) {
					foundUser = true;
				}
				
				if (foundUser && !newDj.escorted) {
					log("removing " + data.user[0].name + " from queue because they just stepped up.");
					cmbot.q.removeUser(newDj);
				}
			}
		} else { //ffa
			/*
			var numFreeSpots = 5 - session.djs.length;
			if(session.refreshes.length > 0 && session.refreshes.length <= numFreeSpots && session.refreshes.indexOf(newDj.userid) == -1 && enforcement) {
				// At least one dj is in the middle of a refresh, and someone else tried to step up yet there arent' enough spots, so escort them
				bot.remDj(newDj.userid);
				newDj.escorts.push(now());
				var numEscorts = 0;
				$(newDj.escorts).each(function(index, escortTimestamp){
					if (((now() - escortTimestamp) / 1000) < 10) {
						numEscorts++;
					}
				});
				log("numEscorts: " + numEscorts);
				if (numEscorts >= 3) {
					bot.bootUser(newDj.userid, "Pay attention.");
					cmbot.bot.speak("Hasta la vista, meatbag!");
				}
				if(numEscorts == 1)
					bot.pm("Sorry, but at least one DJ is currently refreshing their browser. Please wait until another spot opens up.", newDj.userid);
			}
			*/
		}
		
		if(cmbot.session.casino) {
			if(cmbot.session.casino_data.winners.indexOf(newDj.userid) == -1) {
				// User who isn't a winner stepped up, so escort them
				cmbot.bot.pm("Sorry, but casino mode is active. PM me '/help casino' for help.", newDj.userid);
				cmbot.bot.remDj(newDj.userid);
			} else {
				cmbot.session.casino_data.winners.splice(cmbot.session.casino_data.winners.indexOf(newDj.userid), 1);
				log("Deleted " + newDj.name + " from winners, now winners = ", cmbot.session.casino_data.winners);
				clearTimeout(user.timers.casinoWinner);
				user.timers.casinoWinner = false;
			}
			if(cmbot.session.casino_data.winners.length == 0) {
				// Last winner stepped up, so we're done with this round of rolls
//				cmbot.session.casino_data.rollActive = false;
				cmbot.session.casino_data.activeRolls = [];
			}
		}
		if(newDj.refresh) {
			cmbot.session.refreshes.splice(cmbot.session.refreshes.indexOf(newDj.userid));
			clearTimeout(newDj.timers.removeRefresh);
			newDj.timers.removeRefresh = false;
		}
		// If the new dj message isnt set up, dont bother checking the dj's file
		if(cmbot.options.new_dj_message !== false && cmbot.options.new_dj_message != '') {
			if(!cmbot.hasUserDJed(newDj.userid)) {
				cmbot.bot.pm(cmbot.options.new_dj_message, newDj.userid);
				cmbot.addDJCount(newDj.userid);
			}
		}
		cmbot.users[newDj.userid].djing = true;
//		currentSong.room.metadata.djs.push(newDj.userid);
		cmbot.users[newDj.userid].refresh = false;
		clearTimeout(cmbot.users[newDj.userid].timers.queueTimer);
		cmbot.users[newDj.userid].timers.queueTimer = false;
		cmbot.session.djs.push(newDj.userid);
		
		cmbot.checkQueue();
		if(newDj.userid != cmbot.options.bot.userid) {
			cmbot.autodj();
			// Step down if the decks are full
			if(cmbot.session.djing && (cmbot.session.djs.length == cmbot.session.max_djs) && (!cmbot.session.enforcement || cmbot.isFFA())) {
				log("Stepping down since the decks are full.");
				cmbot.bot.remDj(cmbot.options.bot.userid);
			}
		}
		
		cmbot.doCustomEvents('add_dj', data);
	});
};

cmbot.prototype.autodj = function() {
	var cmbot = this;
	// If autodj is on, there are 2 or more spots open, the bot isn't dj'ing, and there is nobody in the queue, go ahead and dj.
	log("Checking to see if I should autodj.");
	var freeSpots = cmbot.session.max_djs - cmbot.session.djs.length;
	if(cmbot.session.djing)
		log("I'm already DJ'ing.");
	else if(!cmbot.session.autodj)
		log("AutoDJ is off.");
	else if(freeSpots < 2) 
		log("There " + (freeSpots == 1 ? "is " + freeSpots + " spot" : "are " + freeSpots + " spots") + " free. (max djs: " + cmbot.session.max_djs + ", num djs: " + cmbot.session.djs.length + ")");
	else if(cmbot.q.getQueueLength(true) != 0)
		log("There is someone in the queue.");
	else if(cmbot.session.timers.autodj !== false)
		log("There's already a timer for me to autodj.");
	else {
		log("Setting timer to autodj");
		cmbot.session.timers.autodj = setTimeout(function() {
			// Make sure the previous conditions are still true before actually dj'ing
			if(cmbot.session.max_djs - cmbot.session.djs.length >= 2 && !cmbot.session.djing && cmbot.q.getQueueLength(true) == 0) {
				log("Autodj'ing!");
				cmbot.bot.addDj(function(result) {
					if(result.success) {
						cmbot.session.autodjing = true;
						cmbot.users[cmbot.options.bot.userid].djing = true;
						cmbot.session.djing = true;
					}
				});
			}
			clearTimeout(cmbot.session.timers.autodj);
			cmbot.session.timers.autodj = false;
		}, 60*1000);
	}
};

cmbot.prototype.eventRemDj = function() {
	var cmbot = this;
	cmbot.bot.on('rem_dj', function(data) {
		log(data.user[0].name + " just stepped down from the decks.");
		var user = cmbot.users[data.user[0].userid];
		if(user.userid == cmbot.options.bot.userid) {
			cmbot.session.djing = false;
			cmbot.session.autodjing = false;
		}
//		delete currentSong.room.metadata.djs[data.user[0].userid];
		cmbot.session.djs.splice(cmbot.session.djs.indexOf(user.userid), 1);
		user.djing = false;
		if (!user.refresh && !user.escorted) {
			user.playcount = 0;
			user.lastInteraction = now();
			clearTimeout(user.timers.idleDJRemove);
			user.timers.idleDJRemove = false;
			cmbot.savePlayCounts();
			
			
		} else if(user.escorted) {
			user.escorted = false;
//			user.djing = false;
		}
		if(cmbot.session.casino) {
//			if(!cmbot.session.casino_data.rollActive && cmbot.session.casino_data.activeRolls.length > 0) {
//				log("got here");
				cmbot.casinoAnnounceNextWinner();
//			}
		}
		// Alert the first non-afk person that they are up
		else if(!user.refresh) {
			cmbot.checkQueue();
			cmbot.autodj();
		}

		user.escortme = false;
		
		cmbot.doCustomEvents('rem_dj', data);
	});
};


cmbot.prototype.eventBootedUser = function() {
	var cmbot = this;
	cmbot.bot.on('booted_user', function(data) {
		cmbot.doCustomEvents('booted_user', data);
	});
};

cmbot.prototype.eventSnagged = function() {
	var cmbot = this;
	cmbot.bot.on('snagged', function(data) {
		cmbot.doCustomEvents('snagged', data);
	});
};

cmbot.prototype.eventUpdateUser = function() {
	var cmbot = this;
	cmbot.bot.on('update_user', function(data) {
//		log("User updated: %o", data);
		if(data.name != null) {
			// User changed their name
			cmbot.users[data.userid].name = data.name;
		}
		cmbot.doCustomEvents('update_user', data);
	});
};

cmbot.prototype.eventNewModerator = function() {
	var cmbot = this;
	cmbot.bot.on('new_moderator', function(data) {
		log("A user was given mod: ", data);
		var userid = data.userid;
		cmbot.users[userid].mod = true;
		cmbot.mods[userid] = 1;
		cmbot.doCustomEvents('new_moderator', data);
	});
};

cmbot.prototype.eventRemModerator = function() {
	var cmbot = this;
	cmbot.bot.on('rem_moderator', function(data) {
		log("A user was unmodded: ", data);
		var userid = data.userid;
		cmbot.users[userid].mod = false;
		delete cmbot.mods[userid];
		cmbot.doCustomEvents('rem_moderator', data);
	});
};

cmbot.prototype.eventRegistered = function() {
	var cmbot = this;
	this.bot.on('registered', function(data) {
		var userid = data.user[0].userid;
		log(data.user[0].name + " just joined.");

		if (cmbot.settings.shitlist[userid] != null) {
			log("shitlisted user just joined, booting");
			cmbot.bot.bootUser(userid, cmbot.settings.shitlist[userid].reason + " http://goo.gl/krnve");
			return false;
		}
		else {
			if (typeof cmbot.users[data.user[0].userid] != 'object') {
				user = new User({userid: data.user[0].userid, name: data.user[0].name, mod: cmbot.mods[data.user[0].userid] == 1 || data.user[0].acl > 0, laptop: data.user[0].laptop});
				if(data.user[0].acl > 0) {
					cmbot.mods[data.user[0].userid] = 1;
					if(data.user[0].acl == 1)
						user.role = 'superuser';
					else if(data.user[0].acl == 2)
						user.role = 'gatekeeper';
				}
				cmbot.users[data.user[0].userid] = user;
			}
			else {
				cmbot.users[data.user[0].userid].present = true;
				cmbot.users[data.user[0].userid].lastInteraction = now();
				cmbot.users[data.user[0].userid].laptop = data.user[0].laptop;
				if(cmbot.users[userid].timers.removeFromQueue !== false) {
					log("Clearing removeFromQueue timer for " + data.user[0].name + ".");
					clearTimeout(cmbot.users[userid].timers.removeFromQueue);
					cmbot.users[userid].timers.removeFromQueue = false;
				}

			}
		}
		cmbot.doCustomEvents('registered', data);
	});
};

cmbot.prototype.eventDeregistered = function() {
	var cmbot = this;
	this.bot.on('deregistered', function(data) {
		var thisUser = cmbot.users[data.user[0].userid];
		try {
			thisUser.present = false;
			var userInQueue = false;
			$(cmbot.q.getQueue()).each(function(index, userid) {
				if (userid == thisUser.userid) 
					userInQueue = true;
			});
			if (userInQueue && !thisUser.refresh) {
//				thisUser.afk = true;
				log("User in queue, " + thisUser.name + ", just left the room. Setting up timer to remove them from the queue in 5 minutes if they don't leave.");
				thisUser.timers.removeFromQueue = setTimeout(function(){
					log(thisUser.name + " left the room 5 minutes ago and hasn't returned, removing from the queue.");
					cmbot.q.removeUser(thisUser);
				}, 60 * 5000);
			}
		} catch(e) {
			log("Exception checking queue after user leaves room: ", e);
		}	
		cmbot.doCustomEvents('deregistered', data);
	});
};

cmbot.prototype.eventTcpConnect = function() {
	var cmbot = this;
	this.bot.on('tcpConnect', function (socket) {
		cmbot.doCustomEvents('tcpConnect', socket);
	});
};

cmbot.prototype.eventTcpMessage = function() {
	var cmbot = this;
	this.bot.on('tcpMessage', function (socket, msg) {
		if(typeof this.customEvents[event] == 'object') {
			for(var module in this.customEvents['tcpMessage']) {
				if(typeof this.customEvents['tcpMessage'][module] == 'function')
					this.customEvents['tcpMessage'][module](this, socket, msg);
			}
		}
	});
};

cmbot.prototype.eventTcpEnd = function() {
	var cmbot = this;
	this.bot.on('tcpEnd', function (socket) {
		cmbot.doCustomEvents('tcpEnd', socket);
	});
};

cmbot.prototype.eventHttpRequest = function() {
	var cmbot = this;
	this.bot.on('httpRequest', function (request, response) {
		if(typeof cmbot.customEvents['httpRequest'] == 'object') {
			for(var module in cmbot.customEvents['httpRequest']) {
				if(typeof cmbot.customEvents['httpRequest'][module] == 'function')
					cmbot.customEvents['httpRequest'][module](cmbot, request, response);
			}
		}
	});
};

cmbot.prototype.speakOrPM = function(text, pm, userid) {
	if(pm)
		this.bot.pm(text, userid);
	else
		this.bot.speak(text);
};

cmbot.prototype.savePlayCounts = function() {
	var counts = {};
	$.each(this.users, function(userid, user) {
		try {
			if (user.djing) {
//				log("user: ", user);
//				counts.push(user.name + ": " + user.playcount);
				counts[user.userid] = user.playcount;
			}
		} catch(e) {}
	});
	this.settings.playcounts = counts;
	this.saveSettings();
};

cmbot.prototype.loadPlayCounts = function() {
	var cmbot = this;
	var counts = this.settings.playcounts;
	$.each(counts, function(userid, playcount) {
		if (typeof cmbot.users[userid] == 'object') {
			cmbot.users[userid].playcount = playcount;
		}
	});
};

cmbot.prototype.reactToSpeak = function(data) {
	var cmbot = this;
	// Just react to ++ and --
	var text = data.text;
	if(text.match(/^([^\+]+)\+\+$/)) {
		log("got here");
		var phrase = RegExp.$1;
		if(cmbot.settings.phrases[phrase] == undefined)
			cmbot.settings.phrases[phrase] = 1;
		else
			cmbot.settings.phrases[phrase]++;
		cmbot.bot.speak(phrase + " has a score of " + cmbot.settings.phrases[phrase]);
		cmbot.saveSettings();
	} else if(text.match(/^([^\-]+)\-\-$/)) {
		var phrase = RegExp.$1;
		if(cmbot.settings.phrases[phrase] == undefined)
			cmbot.settings.phrases[phrase] = -1;
		else
			cmbot.settings.phrases[phrase]--;
		cmbot.bot.speak(phrase + " has a score of " + cmbot.settings.phrases[phrase]);
		cmbot.saveSettings();
	}
};

cmbot.prototype.getUserByName = function(name) {
	var foundUser = false;
	$.each(this.users, function(userid, user) {
		try {
			if (user.name.toLowerCase() == name.toLowerCase()) 
				foundUser = user;
		} catch(e) {
			log("EXCEPTION! ", e);
		}
	});
	return foundUser;
};

cmbot.prototype.on = function(event, callback) {
	log("!!!!!! NOTE: Custom Events using 'on' is deprecated and will be disabled in a future release. Please use dynamic modules instead.");
	this.customEvents[event] = callback;
};

cmbot.prototype.reactToCommand = function(data) {
	var cmbot = this;
	// Get the data
	var text = data.text;
	var command = arg = '';
	if(text.match(/^[\\]*\/([^ ]+)\s{0,1}(.*)$/)) {
		command = RegExp.$1;
		arg = RegExp.$2;
//		if(arg != '')
//			log("arg = " + arg);
	}
	command = command.toLowerCase();
	
	if(cmbot.commandAliases[command] != undefined)
		command = cmbot.commandAliases[command];
	
	if(cmbot.commandTimestamps[command] != undefined) {
		if ((now() - cmbot.commandTimestamps[command]) / 1000 < cmbot.commandTimeLimits[command]) {
			// it's been less than the time limit for this command, so don't bother doing anything
			log("less than " + cmbot.commandTimeLimits[command] + " seconds have passed since " + command + " was last run.");
			return false;
		}
	}
	cmbot.commandTimestamps[command] = now();
	
	
	if(command == '' || command == 'me' || cmbot.users[data.userid] == undefined)
		return;
	
	var theCommand = false;
	if(typeof cmbot.commands[command] == 'object') {
		theCommand = cmbot.commands[command];
	} else if(typeof cmbot.customCommands[command] == 'object') {
		theCommand = cmbot.customCommands[command];
	}
	
	if(theCommand !== false) {
		log("found command: " + command);
		if(typeof theCommand.command == 'function') {
			if(!theCommand.modonly || cmbot.users[data.userid].mod) {
				if(!theCommand.pmonly)
					theCommand.command({ cmbot: cmbot, pm: false, arg: arg, userid: data.userid });
				else
					cmbot.bot.pm("Sorry, that command is only available in PM.", data.userid);
				return;
			}
		}
	}
	if(cmbot.settings.modtriggers[escape(command)] != undefined && cmbot.users[data.userid].mod) {
		var userid = data.userid;
		cmbot.doModTrigger(userid, command);
	} else if(cmbot.settings.triggers[escape(command)] != undefined) {
		var userid = data.userid;
		cmbot.doTrigger(userid, command);
	}
};

function now() {
	return new Date().getTime();
}

function escapeRegExp(str) {
	return str.replace(/[-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function getRandomNumber(min, max) {
	var r = Math.floor((max - min - 1) * Math.random()) + min;
	return r;
}

cmbot.prototype.doCustomEvents = function(event, data) {
	if(typeof this.customEvents[event] == 'object' && data.userid != this.options.bot.userid) {
		for(var module in this.customEvents[event]) {
			if(typeof this.customEvents[event][module] == 'function') {
				if(data != undefined)
					this.customEvents[event][module](this, data);
				else
					this.customEvents[event][module](this);
			}
		}
	}
};

cmbot.prototype.hasUserDJed = function(userid) {
	try {
		var json = fs.readFileSync(this.options.dj_file);
		var djs = JSON.parse(json);
		if (djs[userid] == undefined) 
			return false;
		else 
			return true;
	} catch(e) {
		return false;
	}
};

cmbot.prototype.addDJCount = function(userid) {
	var json = '';
	try {
		json = fs.readFileSync(this.options.dj_file);
	} catch(e) {}
	var djs;
	if(json == '')
		djs = {};
	else
		djs = JSON.parse(json);
	if(djs[userid] == undefined)
		djs[userid] = 1;
	try {
		fs.writeFileSync(this.options.dj_file, JSON.stringify(djs));
	} catch(e) {}
	djs = null;
};

cmbot.prototype.doTrigger = function(userid, command) {
	var cmbot = this;
	if(cmbot.settings.triggerBan[userid] != undefined) {
		if(cmbot.settings.triggerBan[userid] < now())
			delete cmbot.settings.triggerBan[userid];
		else
			return false;
	}
	if ((now() - cmbot.triggerTimeStamps[command]) / 1000 < cmbot.settings.triggerLimit[command]) {
		// it's been less than the time limit for this command, so don't bother doing anything
		log("less than " + cmbot.settings.triggerLimit[command] + " seconds have passed since " + cmbot.command + " was last run.");
		return false;
	}
	cmbot.triggerTimeStamps[command] = now();
	var djName = cmbot.users[cmbot.currentSong.room.metadata.current_dj] != undefined ? cmbot.users[cmbot.currentSong.room.metadata.current_dj].name : '';
	cmbot.bot.speak(cmbot.settings.triggers[command].replace(/%me%/g, '@' + cmbot.users[userid].name).replace(/%dj%/g, '@' + djName));
};

cmbot.prototype.doModTrigger = function(userid, command) {
	var cmbot = this;
	var djName = cmbot.users[cmbot.currentSong.room.metadata.current_dj] != undefined ? cmbot.users[cmbot.currentSong.room.metadata.current_dj].name : '';
	cmbot.bot.speak(cmbot.settings.modtriggers[command].replace(/%me%/g, '@' + cmbot.users[userid].name).replace(/%dj%/g, '@' + djName));
};

cmbot.prototype.initQueue = function() {
	var cmbot = this;
	cmbot.q = new Queue(cmbot, function(queueArray) {
		cmbot.settings.queue = queueArray;
		cmbot.saveSettings();
	});
	this.q.setQueue(this.settings.queue);
//	log("q = ", this.q);
};

cmbot.prototype.loadSettings = function() {
	var _settings = {};
	try {
		var json = fs.readFileSync(this.options.settings_file);
		_settings = JSON.parse(json);
	} catch(e) {
		log("Exception: %o", e);
	}
	return _settings;
};

cmbot.prototype.saveSettings = function() {
	try {
		fs.writeFileSync(this.options.settings_file, JSON.stringify(this.settings));
	} catch(e) {
		log("Exception saving settings: %o", e);
	}
};

cmbot.prototype.initOptions = function(_options) {
	// First, try to open the settings and djs files, or create them if they don't exist
	$.each([_options.settings_file, _options.dj_file], function(index, file) {
		if(!path.existsSync(file)) {
			fs.writeFileSync(file, "{}");
		}
	});
	
	if(typeof _options.master_userid == 'string')
		_options.master_userid = [_options.master_userid];
	this.options = $.extend({
		settings_file: false,
		dj_file: false,
		
		autodj: true,
		queue_enabled: true,
		bot: false,
		modules_directory: false,
		autoload_modules: true,
		set_limit: 0,
		// If either of the following are set to false, only awesome for the other. If both are set to false, never autobop
		autobop_threshold_number: 5, // How many other users must awesome before the bot awesomes
		autobop_threshold_percentage: 20, // The percentage of the room's population that must awesome before the bot awesomes
		snag_threshold: 10, // How many votes a song must get for the bot to add it to it's queue.
		master_userid: [], // Who runs the bot should have extra privileges
		ffa: false, // Day of the week for free for all. Sunday = 0, Monday = 1, etc. Set to false for none.
		ffa_text: false,
		timezone: 'PST',
		modpm_superusers: true,
		allow_mobile_djs: true, // Set to false to require users to be whitelisted in order to DJ from a mobile device (mods are exempt)
		lastfm: {
			enabled: false,
			earliest_scrobble: ''
		},
		songkick: false,
		google: {
			url_shorten_api_key: 'AIzaSyCgS_W9UZYBhl3d8cLxxPYo1IaX6WzwJbc'
		},
		mysql: {
			enabled: false, // Change to true and fill out details below to enable mysql logging of song plays
			host: '',
			database: '',
			user: '',
			password: ''
		},
		sqlite: {
			enabled: false,
			file: '',
		},
		/*
		 * Messages:
		 * This should be an array of text that the bot will say in the chat room periodically, such as reminding users of the rules, how the queue works, etc.
		 */
		messages: [],
		/*
		 * Sets how often the messages should display, in minutes. After the bot starts up, it waits the interval time,
		 * then speaks the first message (in the array above) out into chat. It then waits the interval time again until displaying
		 * the next message in the array (if there is one). So, the amount of time between each time a specific message is displayed is dependent on both
		 * the message interval (defined below) and the number of different messages in the array. If there are two messages, and the interval
		 * is 15 minutes each message will be displayed every 30 minutes - the first one 15 minutes after the bot starts, and the next
		 * one 15 minutes later, then the first one in another 15 minutes, etc.
		 */
		message_interval: 15, // Number of minutes between each informational message
		messages_hide_ffa: [], // index of which messages should be hidden when it's FFA (free for all) mode (if the queue is disabled, this setting doesn't do anything - every message will display)
		/*
		 * Events:
		 * You can program your own logic here when certain turntable events happen. Simply add a new entry like the ones below.
		 * Events supported: speak, ready, roomChanged, update_votes, newsong, endsong, pmmed, add_dj, rem_dj, update_user, new_moderator, rem_moderator, registered, deregistered
		 * See Alain Gilbert's TTAPI (which this bot uses) for more details on what each event is for at https://github.com/alaingilbert/Turntable-API
		 * The options object looks like this:
		 * {
		 * 		bot: (the bot object - you can use the methods from the TTAPI page above to make the bot do things, like speak in chat or PM someone)
		 * 		data: (the data that particular event receives from turntable. Each event gets it's own unique data object, so use console to output it for a particlar event to get an idea)
		 * 		users: (An object containing every user the bot is aware of. This object is keyed on the user's id, so users['109f909109ea091959fa'] for instance is an object containing some information about that user, like their name, mod status, playcount, etc.)
		 * }
		 */
		events: false,
		/*
		 * The first time a user dj's in your room, you can have the bot PM them an introductory message, for instance to remind them of what type of music is welcome in the room. to disable, just set this to false.
		 */
		 new_dj_message: false,
		 twitter: false
	}, _options);
//	log("options: ", this.options);
};

/*
 * TODO: allow overriding the strings of text the bot speaks/pm's
cmbot.prototype.setStrings = function(strings) {
	strings = strings || {};
	var newstrings = $.extend({
		test: "foo %something% bar %yeah% blah %four%"
	}, strings);
	this.strings = newstrings;
};

cmbot.prototype.getString = function() {
	var arg = arguments[0];
	var string = this.strings[arg];
	for(var i=1;i<arguments.length;i++) {
		string = string.replace('%' + i, arguments[i]);
	}
	return string;
};
*/


cmbot.prototype.shortenUrls = function(urls, urlsCallback, shortenedUrls) {
	var cmbot = this;
	shortenedUrls = shortenedUrls || [];
	if(urls.length == 0)
		urlsCallback(shortenedUrls);
	else {
		var url = urls[0];
		cmbot.shortenUrl(url, function(result) {
			if(result.success) {
				shortenedUrls.push({long: url, short: result.url});
				urls.splice(0, 1);
				cmbot.shortenUrls(urls, urlsCallback, shortenedUrls);
			}
		});
	}
};

cmbot.prototype.shortenUrl = function(url, callback) {
	post_data = '{"longUrl": "' + url + '"}';
	var options = {
		host: 'www.googleapis.com',
		port: '443',
		path: '/urlshortener/v1/url?key=' + this.options.google.url_shorten_api_key,
		method: 'POST',
		headers: {
			'Content-Length': post_data.length,
			'Content-Type': 'application/json'
		}
	};
	options.agent = new https.Agent(options);
	
	var req = https.request(options, function(res) {
		res.setEncoding('utf8');
		res.on('data', function(d) {
			var result = JSON.parse(d);
			if(typeof callback == 'function') {
				if(result.id != undefined) {
					callback({
						success: true,
						url: result.id
					});
				} else {
					callback({
						success: false,
						error: result.error.message
					});
				}
			}
		});
	});
	req.write(post_data);
	req.end();
};

cmbot.prototype.getUptime = function() {
	var now = new Date();
	var diff = now.getTime() - this.session.start_time.getTime();
	var x = diff / 1000;
	var seconds = Math.floor(((x % 86400) % 3600) % 60);
	var minutes = Math.floor(((x % 86400) % 3600) / 60);
	var hours = Math.floor((x % 86400) / 3600);
	var days = Math.floor(x / 86400);
	var uptime = 'up ';
	if(days == 1)
		uptime += days + ' day, ';
	else if(days > 1)
		uptime += days + ' days, ';
	if(hours > 0)
		uptime += sprintf("%02d", hours) + ":" + sprintf("%02d", minutes);
	else if(minutes > 0)
		uptime += minutes + ' mins';
	else
		uptime += seconds + ' secs';
	return uptime;
};

/*
 * Set up informational messages
 */
cmbot.prototype.setupMessages = function() {
	var cmbot = this;
	if(isNaN(this.options.message_interval)) {
		log("interval is bad");
	} else {
		var modifier = 1000*60; // 1 minute
		$.each(this.options.messages, function(index, message) {
			var interval = cmbot.options.message_interval*cmbot.options.messages.length*modifier;
			setTimeout(function() {
				if(!cmbot.isFFA() || cmbot.options.messages_hide_ffa[index] == undefined || !cmbot.options.queue_enabled) {
					cmbot.bot.speak(cmbot.options.messages[index]);
					log("Displaying message: " + index);
				}
				setInterval(function() {
					if(!cmbot.isFFA() || cmbot.options.messages_hide_ffa[index] == undefined) {
						log(index + ": Displaying messages: " + cmbot.options.messages[index]);
						cmbot.bot.speak(cmbot.options.messages[index]);
					}
				}, interval);
			}, cmbot.options.message_interval*(index == 0 ? 1 : index+1)*modifier);
		});
	}
};

cmbot.prototype.modpm = function(text, modsToPm, from, fromBot) {
	var cmbot = this;
	fromBot = fromBot !== true ? false : fromBot;
	if(modsToPm === false) {
		modsToPm = [];
		$.each(cmbot.mods, function(each_userid) {
			if(cmbot.users[each_userid] != undefined && 
					cmbot.users[each_userid].present && 
					(cmbot.options.modpm_superusers || cmbot.users[each_userid].role == 'user' || cmbot.settings.modchat[each_userid] === true) &&
					each_userid != from && 
					each_userid != cmbot.options.bot.userid &&
					cmbot.settings.modchat[each_userid] !== false) {
				modsToPm.push(each_userid);
			}
		});
	}
	if(modsToPm.length > 0) {
		var mod = modsToPm[0];
		mod = cmbot.users[mod];
		var date = new Date();
		if(cmbot.settings.timezones[mod.userid] != undefined) {
			var offset = date.stdTimezoneOffset() / 60;
			var userTimezone = cmbot.settings.timezones[mod.userid];
			var userOffsetNum = cmbot.timezones[userTimezone];
			if(userOffsetNum.indexOf('-') > -1) {
				userOffsetNum = parseInt(userOffsetNum.substr(1)) * -1;
			} else {
				userOffsetNum = parseInt(userOffsetNum);
			}
			date.setHours(date.getHours() + userOffsetNum + parseInt(offset));
		}
		var output = text;
		if(output.match(/^\/me/))
			output = " " + output.replace(/^\/me/, '');
		else
			output = ": " + output;
		var time = dateFormat(date, "h:MMtt");
		cmbot.bot.pm("[" + time + "] " + (!fromBot ? cmbot.users[from].name : "") + output, mod.userid, function(result) {
			log("sent pm to " + mod.name);
			modsToPm.splice(0, 1);
			cmbot.modpm(text, modsToPm, from, false);
		});
	}
};

cmbot.prototype.yoinkTrack = function(callback) {
	var cmbot = this;
	if(!this.options.lastfm.enabled || this.lastfm === false) {
		cmbot.bot.playlistAll(function(res) {
			var found = false;
			if(!cmbot.session.snagged) { // If we've already snagged this one in this session, don't bother checking the playlist for it
				for(var i=0;i<res.list.length;i++) {
					var song = res.list[i];
					if(cmbot.currentSong.room.metadata.current_song['_id'] == song['_id'])
						found = true;
				}
			}
			var result;
			if(found) {
				result = {
					success: false,
					error: cmbot.q.ALREADY_YOINKED
				};
			} else {
				cmbot.bot.snag();
				cmbot.bot.playlistAdd(cmbot.currentSong.room.metadata.current_song['_id'], res.list.length);
				cmbot.session.snagged = true;
				result = {
					success: true
				};
			}
			if(typeof callback == 'function')
				callback(result);
		});
	} else {
		this.lastfm.getTrackInfo({
			artist: cmbot.currentSong.room.metadata.current_song.metadata.artist,
			track: cmbot.currentSong.room.metadata.current_song.metadata.song,
			callback: function(result) {
//				log("Trackinfo result: ", result);
				if(!result.success) {
					if(typeof callback == 'function') {
						callback({
							success: false,
							error: result.error
						});
					}
				} else {
					if(result.trackInfo.userloved == '0') {
						cmbot.lastfm.loveTrack({
							artist: cmbot.currentSong.room.metadata.current_song.metadata.artist,
							track: cmbot.currentSong.room.metadata.current_song.metadata.song,
							callback: function(result) {
								if(result.success) {
									cmbot.bot.playlistAll(function(res) {
										log("Adding to playlist: " + res.list.length);
										cmbot.bot.snag(function(result, err) {
											console.log("result: ", result);
											console.log("err: ", err);
										});
										cmbot.bot.playlistAdd(cmbot.currentSong.room.metadata.current_song['_id'], res.list.length);
										cmbot.session.snagged = true;
									});
								}
								if(typeof callback == 'function')
									callback(result);
							}
						});
					} else {
						cmbot.session.snagged = true;
						if(typeof callback == 'function') {
							callback({
								success: false,
								error: cmbot.q.ALREADY_YOINKED
							});
						}
					}
				}
			}
		});
	}
};

cmbot.prototype.getPlayCounts = function() {
	var cmbot = this;
	var counts = [];
	$(this.session.djs).each(function(index, userid) {
		try {
			var user = cmbot.users[userid];
			if (user.djing) {
				counts.push(user.name + ": " + user.playcount);
			}
		} catch(e) {
		}
	});
	return counts;
};

cmbot.prototype.getMysqlClient = function() {
	var cmbot = this;
	var mysql = false;
	try {
		mysql = require('mysql').createClient({
			host: cmbot.options.mysql.host,
			user: cmbot.options.mysql.user,
			password: cmbot.options.mysql.password
		});
		mysql.query('USE ' + cmbot.options.mysql.database);
	} catch(e) {}
	return mysql;
};

//If there are any open spots, and any non-afker's in the queue, do the timer.
cmbot.prototype.checkQueue = function() {
	log("Checking queue.");
	var cmbot = this;
	if($(this.session.djs).length < cmbot.session.max_djs) {
		if (this.q.getQueueLength() > 0 && this.session.enforcement) {
			var foundUser = false;
			$(this.q.getQueue()).each(function(index, userid){
				var user = cmbot.users[userid];
				if (user != undefined) {
					if (!foundUser) {
						if (user.userid == cmbot.options.bot.userid) {
							// The bot is next in queue, so step up
							cmbot.bot.addDj();
							foundUser = true;
						}
						else {
							if (!user.afk && user.present && !user.djing && user.timers.queueTimer === false) {
								cmbot.bot.speak("@" + user.name + " has three minutes to step up.");
								user.timers.queueTimer = setTimeout(function() {
									user.afk = true;
									clearTimeout(user.timers.queueTimer);
									user.timers.queueTimer = false;
									cmbot.checkQueue();
								}, 60000 * 3);
								foundUser = true;
							} else if(user.djing) {
								cmbot.q.removeUser(user);
							} else if(user.timers.queueTimer !== false) {
								foundUser = true;
							}
						}
					}
				}
			});
		}
	}
};

cmbot.prototype.isFFA = function() {
	var day = new Date().getDay();
	if(this.options.ffa === false)
		return false;
	if(this.options.ffa.indexOf(day) == -1)
		return false;
	else
		return true;
};

cmbot.prototype.loadModule = function(module) {
	var result = {
		messages: []
	};
	if(require.cache[module] !== undefined)
		delete require.cache[module];
	var customModule = require(module);
	if(customModule.customCommands !== undefined) {
		var customCommands = customModule.customCommands;
		if(customCommands.length == undefined)
			customCommands = [customCommands];
		for(var i=0;i<customCommands.length;i++) {
			var customCommand = customCommands[i];
			if(typeof customCommand.name != 'string')
				result.messages.push("Couldn't find name of the custom command.");
			else if(typeof customCommand.command != 'function')
				result.messages.push("Couldn't find the command's function (command: function(options) {...");
			else {
				var comm = {};
				comm[customCommand.name] = {
					command: customCommand.command,
					modonly: customCommand.modonly !== undefined ? customCommand.modonly : false,
					pmonly: customCommand.pmonly !== undefined ? customCommand.pmonly : false,
					help: customCommand.help !== undefined ? customCommand.help : false,
					acl: customCommand.acl !== undefined ? customCommand.acl : false,
					hide: customCommand.hide !== undefined ? customCommand.hide : false
				};
				this.customCommands = $.extend(this.customCommands, comm);
				if(typeof customCommand.setup == 'function') {
					customCommand.setup(this);
				}
				result.messages.push("Command " + customCommand.name + " loaded.");
			}
		}
	}
	if(customModule.customEvents !== undefined) {
		var customEvents = customModule.customEvents;
		if(customEvents.length == undefined)
			customEvents = [customEvents];
		for(var i=0;i<customEvents.length;i++) {
			var customEvent = customEvents[i];
			if(typeof customEvent.on != 'string')
				result.messages.push("Sorry, but I couldn't find which event you want to hook into.");
			else if(typeof customEvent.event != 'function')
				result.messages.push("Sorry, but I couldn't find function to run when the event fires.");
			else if(this.customEventsSupported.indexOf(customEvent.on) == -1)
				result.messages.push("Sorry, but I don't know the event '" + customEvent.on + "'");
			else {
				if(this.customEvents[customEvent.on] == undefined)
					this.customEvents[customEvent.on] = {};
				this.customEvents[customEvent.on][module] = customEvent.event;
				if(typeof customEvent.setup == 'function')
					customEvent.setup(this);
				result.messages.push("Custom event for '" + customEvent.on + "' added.");
			}
		}
	}
	if(customModule.customCommands == undefined && customModule.customEvents == undefined) {
		result.messages.push("Sorry, but I couldn't find a custom command or event in the file you specified.");
	}
	
	return result;
};

cmbot.prototype.commands = {
	'settwitter': {
		command: function(options) {
			if(this.twit === false)
				options.cmbot.bot.pm("Sorry, twitter is not enabled.", options.userid);
			else if(options.arg == "")
				options.cmbot.bot.pm("Please enter your twitter username.", options.userid);
			else {
				var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
				var randomstring = '';
				for (var i=0; i<32; i++) {
					var rnum = Math.floor(Math.random() * chars.length);
					randomstring += chars.substring(rnum,rnum+1);
				}
				log("Randomstring: " + randomstring);
				options.cmbot.session.twitterVerification[options.userid] = {
					username: options.arg,
					string: randomstring
				};
				options.cmbot.bot.pm("Tweet the following string and then PM me /verifytwitter: " + randomstring, options.userid);
			}
		},
		modonly: false,
		pmonly: true,
		hide: this.twit === false,
		help: "Set your twitter username, so that when I tweet your songplay I'll @mention you. I'll give you a string to tweet, and once you do that, PM me /verifytitter and I'll save your username."
	},
	'verifytwitter': {
		command: function(options) {
			// options.cmbot.session.twitterVerification
			if(this.twit === false)
				options.cmbot.bot.pm("Sorry, twitter is not enabled.", options.userid);
			else {
				if(typeof options.cmbot.session.twitterVerification[options.userid] != 'object')
					options.cmbot.bot.pm("Sorry, it doesn't look like you've run /settwitter yet.", options.userid);
				else {
					options.cmbot.twit.getUserTimeline({
						screen_name : options.cmbot.session.twitterVerification[options.userid].username
					}, function(err, result) {
						var tweet = result[0];
						console.log("Result: ", tweet.text);
						if(typeof tweet == 'object') {
							var regexp = new RegExp(options.cmbot.session.twitterVerification[options.userid].string);
							if(tweet.text.match(regexp)) {
								options.cmbot.settings.twitterUsernames[options.userid] = options.cmbot.session.twitterVerification[options.userid].username;
								options.cmbot.saveSettings();
								options.cmbot.bot.pm("Success! Your username has been saved. You can delete that tweet now, if you'd like.", options.userid);
							} else {
								options.cmbot.bot.pm("Sorry, but it doesn't appear that your last tweet contains the verification string ( " + options.cmbot.session.twitterVerification[options.userid].string + "), please try again.", options.userid);
							}
						} else {
							options.cmbot.bot.pm("Sorry, but I couldn't find any tweets from @" + options.cmbot.session.twitterVerification[options.userid].username + ".", options.userid);
						}
					});
				}
			}
		},
		modonly: false,
		pmonly: true,
		hide: this.twit === false,
		help: "Verify your twitter username. Use /settwitter to tell me your username, and /verifytwitter after you've followed the instructions."
	},
	'setlimit': {
		command: function(options) {
			var text = "";
			if(options.arg == '')
				text = "Set limit is " + (options.cmbot.settings.setlimit == 0 ? "unlimited" : options.cmbot.settings.setlimit) + ".";
			else if(options.arg.match(/^[0-9]+$/)) {
				options.cmbot.settings.setlimit = parseInt(options.arg);
				options.cmbot.saveSettings();
				text = "Set limit is now " + (parseInt(options.arg) == 0 ? "unlimited" : options.arg) + ".";
			} else
				text = "Invalid syntax. Usage: /setlimit [#]";
			options.cmbot.bot.pm(text, options.userid);
		},
		modonly: true,
		pmonly: true,
		help: 'Change the set limit (number of songs each DJ can play).'
	},
	'bansong': {
		command: function(options) {
			var text = "";
			var artist = track = false;
			if(options.arg.match(/^(.+) - (.+)$/)) {
				artist = RegExp.$1.toLowerCase();
				track = RegExp.$2.toLowerCase();
			} else if(options.arg == "") {
				artist = options.cmbot.currentSong.room.metadata.current_song.metadata.artist.toLowerCase();
				track = options.cmbot.currentSong.room.metadata.current_song.metadata.song.toLowerCase();
			}
			if(artist !== false && track !== false) {
				if(options.cmbot.settings.bannedSongs[artist] == undefined)
					options.cmbot.settings.bannedSongs[artist] = [];
				if(options.cmbot.settings.bannedSongs[artist].indexOf(track) > -1)
					text = "That song is already banned.";
				else {
					options.cmbot.settings.bannedSongs[artist].push(track);
					options.cmbot.saveSettings();
					if(options.arg == "") {
						var song = options.cmbot.currentSong.room.metadata.current_song;
						options.cmbot.bot.speak(song.djname + ", " + song.metadata.song + " by " + artist + " is banned! Please skip or you will be removed from the decks in 15 seconds");
						var warnUser = options.cmbot.users[song.djid];
						warnUser.timers.warning = setTimeout(function() {
							options.cmbot.bot.remDj(warnUser.userid);
							options.cmbot.bot.pm("Sorry, you didn't skip in time.", warnUser.userid);
						}, 15*1000);
					} else
						text = track + " by " + artist + " is now banned.";
				}
			} else {
				text = "Invalid syntax. Usage: /bansong artist - track";
			}
			if(text != "")
				options.cmbot.speakOrPM(text, options.pm, options.userid);
		},
		modonly: true,
		pmonly: false,
		help: 'Ban a song. Usage: /bansong [artist - track]. If artist and track are not specified, the current song is banned and the DJ playing it is given 15 seconds to skip or be escorted down.'
	},
	'unbansong': {
		command: function(options) {
			var text = "";
			var artist = track = false;
			if(options.arg.match(/^(.+) - (.+)$/)) {
				var artist = RegExp.$1.toLowerCase();
				var track = RegExp.$2.toLowerCase();
			} else if(options.arg == "") {
				artist = options.cmbot.currentSong.room.metadata.current_song.metadata.artist.toLowerCase();
				track = options.cmbot.currentSong.room.metadata.current_song.metadata.song.toLowerCase();
			}
			if(artist !== false && track !== false) {
				if(options.cmbot.settings.bannedSongs[artist] == undefined)
					options.cmbot.settings.bannedSongs[artist] = [];
				if(options.cmbot.settings.bannedSongs[artist].indexOf(track) == -1)
					text = "That song is not banned.";
				else {
					options.cmbot.settings.bannedSongs[artist].splice(options.cmbot.settings.bannedSongs[artist].indexOf(track), 1);
					if(options.cmbot.settings.bannedSongs[artist].length == 0)
						delete options.cmbot.settings.bannedSongs[artist];
					options.cmbot.saveSettings();
					if(options.arg == "") {
						var song = options.cmbot.currentSong.room.metadata.current_song;
						var warnUser = options.cmbot.users[song.djid];
						options.cmbot.bot.speak(track + " by " + artist + " is no longer banned. Warning cancelled.");
						clearTimeout(warnUser.timers.warning);
						warnUser.timers.warning = false;
					} else
						text = track + " by " + artist + " is no longer banned.";
				}
				
			} else {
				text = "Invalid syntax. Usage: /unbansong artist - track";
			}
			if(text != "")
			options.cmbot.speakOrPM(text, options.pm, options.userid);
		},
		modonly: true,
		pmonly: false,
		help: 'Ban a song. Usage: /bansong artist - track.'
	},
	'modpm': {
		command: function(options) {
			var text = "";
			if(options.arg == '')
				text = "Modpm is " + (options.cmbot.settings.modpm ? "on" : "off") + ".";
			else if(options.arg == "on" || options.arg == "off") {
				if((options.arg == 'on' && options.cmbot.settings.modpm) || (options.arg == 'off' && !options.cmbot.settings.modpm))
					text = "Modpm is already " + (options.cmbot.settings.modpm ? "on" : "off") + ".";
				else {
					options.cmbot.settings.modpm = options.arg == 'on';
					options.cmbot.saveSettings();
					text = "Modpm is now " + (options.cmbot.settings.modpm ? "on" : "off") + ".";
				}
			} else {
				text = "Usage: /modpm [on|off]";
			}
			options.cmbot.bot.pm(text, options.userid);
		},
		modonly: true,
		pmonly: true,
		acl: true,
		help: 'Turn modpm on or off.'
	},
	'modchat': {
		command: function(options) {
			var text = "";
			if(options.arg == '') {
				var status = (options.cmbot.settings.modchat[options.userid] === false ? "off" : "on");
				if((options.cmbot.users[options.userid].role == 'superuser' || options.cmbot.users[options.userid].role == 'gatekeeper') && options.cmbot.settings.modchat[options.userid] == null && !options.cmbot.options.modpm_superusers) {
					status = "off";
				}
				text = "You have modchat " + status + ".";
			} else if(options.arg == "on") {
				options.cmbot.settings.modchat[options.userid] = true;
				options.cmbot.saveSettings();
				text = "You will now see modchat.";
			} else if(options.arg == "off") {
				options.cmbot.settings.modchat[options.userid] = false;
				options.cmbot.saveSettings();
				text = "You will no longer see modchat.";
			} else {
				text = "Usage: /modchat [on|off]";
			}
			options.cmbot.bot.pm(text, options.userid);
		},
		modonly: true,
		pmonly: true,
		help: 'Enable or disable modchat for yourself. Usage: /modchat [on|off]'
	},
	'loadmodule': {
		command: function(options) {
			console.log("Loading module " + options.arg + ".");
			try {
				var stats = fs.lstatSync(options.cmbot.options.modules_directory + "/" + options.arg + ".js");
				if(!stats.isFile())
					options.cmbot.bot.pm("Sorry, I couldn't find the custom module you specified. I'm looking for " + options.cmbot.options.modules_directory + "/" + options.arg + ".js.", options.userid);
				else {
					var result = options.cmbot.loadModule(options.cmbot.options.modules_directory + "/" + options.arg + ".js");
					for(var i=0;i<result.messages.length;i++) {
						options.cmbot.bot.pm(result.messages[i], options.userid);
					}
				}
			} catch(e) {
				log("Something went wrong: ", e);
				options.cmbot.bot.pm("Sorry, something went wrong: " + e, options.userid);
			}
		},
		modonly: true,
		pmonly: true,
		help: 'Load a module containing a custom command or event.',
		acl: true
	},
	'unloadmodule': {
		command: function(options) {
			try {
				var stats = fs.lstatSync(options.cmbot.options.modules_directory + "/" + options.arg + ".js");
				if(!stats.isFile())
					options.cmbot.bot.pm("Sorry, I couldn't find the custom module you specified. I'm looking for " + options.cmbot.options.modules_directory + "/" + options.arg + ".js.", options.userid);
				else {
					if(require.cache[options.cmbot.options.modules_directory + "/" + options.arg + ".js"] !== undefined)
						delete require.cache[options.cmbot.options.modules_directory + "/" + options.arg + ".js"];
					var customModule = require(options.cmbot.options.modules_directory + "/" + options.arg + ".js");
					if(customModule.customCommands !== undefined) {
						var error = false;
						var customCommands = customModule.customCommands;
						if(customCommands.length == undefined)
							customCommands = [customCommands];
						for(var i=0;i<customCommands.length;i++) {
							var customCommand = customCommands[i];
							if(typeof customCommand.name != 'string')
								error = "Couldn't find name of the custom command.";
							else {
								delete options.cmbot.customCommands[customCommand.name];
							}
							if(error === false)
								options.cmbot.bot.pm("Command " + customCommand.name + " unloaded.", options.userid);
							else
								options.cmbot.bot.pm(error, options.userid);
						}
					}
					if(customModule.customEvents !== undefined) {
						var customEvents = customModule.customEvents;
						if(customEvents.length == undefined)
							customEvents = [customEvents];
						for(var i=0;i<customEvents.length;i++) {
							var customEvent = customEvents[i];
							var error = false;
							if(typeof customEvent.on != 'string')
								error = "Sorry, but I couldn't find which event you want to hook into.";
							else if(options.cmbot.customEventsSupported.indexOf(customEvent.on) == -1)
								error = "Sorry, but I don't know the event '" + customEvent.on + "'";
							else {
								delete options.cmbot.customEvents[customEvent.on][options.cmbot.options.modules_directory + "/" + options.arg + ".js"];
							}
							if(error === false)
								options.cmbot.bot.pm("Custom event for '" + customEvent.on + "' unloaded.", options.userid);
							else
								options.cmbot.bot.pm(error, options.userid);
						}
					}
				}
			} catch(e) {
				log("Something went wrong: ", e);
				options.cmbot.bot.pm("Sorry, something went wrong: " + e, options.userid);
			}
		},
		modonly: true,
		pmonly: true,
		help: 'Unload a module containing a custom command or event.',
		acl: true
	},
	'casino': {
		command: function(options) {
			var text;
			if(options.arg == '') {
				text = "Casino mode is " + (options.cmbot.session.casino ? 'on' : 'off') + ".";
			} else if(options.arg == 'on') {
				if(options.cmbot.session.casino)
					text = "Casino mode is already on.";
				else {
					options.cmbot.session.casino = true;
					text = "Casino mode is on.";
					if(options.cmbot.session.djs.length > 0) {
						for(var userid in options.cmbot.session.djs) {
							if(userid != options.cmbot.currentSong.room.metadata.current_song.djid) {
								options.cmbot.bot.remDj(userid);
							}
						}
					}
					options.cmbot.activateCasinoRollTimer();
				}
			} else if(options.arg == 'off') {
				if(!options.cmbot.session.casino)
					text = "Casino mode is already off.";
				else {
					options.cmbot.session.casino = false;
					options.cmbot.session.casino_data = {
						rolls: {},
						activeRolls: [],
						active: false,
						rollActive: false,
						winners: [],
						nums: []
					};
					text = "Casino mode is off.";
					clearTimeout(options.cmbot.session.timers.casinoWinnerAnnounce);
				}
			} else {
				text = "Usage: /casino [on|off]";
			}
			options.cmbot.speakOrPM(text, options.pm, options.userid);
		},
		modonly: true,
		pmonly: false,
		help: 'Toggle Casino mode on or off.',
//		acl: true
	},
	'roll': {
		command: function(options) {
			if(options.cmbot.session.casino !== true) {
				options.cmbot.speakOrPM("Casino mode isn't active!", options.pm, options.userid);
			} else {
				if(options.cmbot.session.casino_data.rolls[options.userid] != undefined) {
					options.cmbot.bot.pm("You already rolled!", options.userid);
				} else if(options.cmbot.session.djs.indexOf(options.userid) > -1) {
					options.cmbot.bot.pm("You're already DJ'ing!!", options.userid);
				} else {
					var randomnumber = Math.floor(Math.random()*101);
					while(options.cmbot.session.casino_data.nums.indexOf(randomnumber) > -1)
						randomnumber=Math.floor(Math.random()*101);
					options.cmbot.session.casino_data.rolls[options.userid] = randomnumber;
					options.cmbot.bot.pm("Your number is " + randomnumber + ".", options.userid);
				}
			}
		},
		modonly: false,
		pmonly: false,
		help: '',
//		acl: true
	},
	'showmobilewhitelist': {
		command: function(options) {
			var musers = [];
			for(var userid in options.cmbot.users) {
				if(options.cmbot.settings.mobileWhitelist[userid] != undefined && options.cmbot.users[userid].present) {
					musers.push(options.cmbot.users[userid].name);
				}
			}
			var text;
			if(musers.length == 0)
				text = "No whitelisted users online.";
			else
				text = "Online whitelisted users: " + (musers.join(", ")) + ".";
			options.cmbot.bot.pm(text, options.userid);
		},
		modonly: true,
		pmonly: true,
		help: 'Show online mobile whitelisted users.'
	},
	'mobilewhitelist': {
		command: function(options) {
			var text = "";
			var whitelisted = false;
			if(options.arg == '') {
				text = "Please specify a user.";
			} else {
				var user = options.cmbot.getUserByName(options.arg);
				if(user === false) {
					text = "User not found.";
				} else {
					if(user.mod) {
						text = "Mods are exempt from the mobile white list.";
					} else if(options.cmbot.settings.mobileWhitelist[user.userid] != undefined) {
						text = user.name + " is already whitelisted for mobile devices.";
					} else {
						options.cmbot.settings.mobileWhitelist[user.userid] = 1;
						text = user.name + " is now whitelisted for mobile devices.";
						options.cmbot.saveSettings();
						whitelisted = user.name;
					}
				}
			}
			options.cmbot.bot.pm(text, options.userid, function() {
				log("whitelisted: " + whitelisted);
				if(whitelisted !== false)
					options.cmbot.modpm(options.cmbot.users[options.userid].name + " has added " + whitelisted + " to the mobile whitelist.", false, options.userid, true);
			});
		},
		modonly: true,
		pmonly: true,
		help: "Add a user to the whitelist for dj'ing from a mobile device."
	},
	'unmobilewhitelist': {
		command: function(options) {
			var text = "";
			var unwhitelisted = false;
			if(options.arg == '') {
				text = "Please specify a user.";
			} else {
				// mobileWhitelist
				var user = options.cmbot.getUserByName(options.arg);
				if(user === false) {
					text = "User not found.";
				} else {
					if(user.mod) {
						text = "Mods are exempt from the mobile white list.";
					} else if(options.cmbot.settings.mobileWhitelist[user.userid] != undefined) {
						text = user.name + " is no longer whitelisted for mobile devices.";
						delete options.cmbot.settings.mobileWhitelist[user.userid];
						options.cmbot.saveSettings();
						unwhitelisted = user.name;
					} else {
						text = user.name + " is not whitelisted for mobile devices.";
					}
				}
			}
			options.cmbot.bot.pm(text, options.userid, function(result) {
				log("unwhitelisted: " + unwhitelisted);
				if(unwhitelisted !== false)
					options.cmbot.modpm(options.cmbot.users[options.userid].name + " has removed " + unwhitelisted + " from the mobile whitelist.", false, options.userid, true);
			});
		},
		modonly: true,
		pmonly: true,
		help: "Remove a user to the whitelist for dj'ing from a mobile device."
	},
	'setdjtimeout': {
		command: function(options) {
			if(options.arg != parseInt(options.arg)) {
				options.cmbot.bot.pm(options.cmbot.settings.idleDJTimeout === false ? "Idle DJ Timeout is disabled." : "Current DJ Timeout: " + options.cmbot.settings.idleDJTimeout + " minutes.", options.userid);
			} else {
				options.cmbot.settings.idleDJTimeout = parseInt(options.arg) == 0 ? false : parseInt(options.arg);
				options.cmbot.saveSettings();
				$(options.cmbot.session.djs).each(function(index, userid) {
					options.cmbot.users[userid].djing = true;
					options.cmbot.activateIdleDJCheck(options.cmbot.users[userid]);
				});
				if(options.cmbot.settings.idleDJTimeout !== false)
					options.cmbot.bot.pm("DJ Timeout set to " + options.arg + " minutes.", options.userid);
				else
					options.cmbot.bot.pm("DJ Timeout removed.", options.userid);
			}
		},
		modonly: true,
		pmonly: true,
		help: 'Set (in minutes) how long a DJ may be idle before being escorted down from the decks. Set to 0 for no limit.'
	},
	'setnext': {
		command: function(options) {
			if(!options.arg.match(/^[0-9]+$/)) {
				options.cmbot.bot.pm("Invalid syntax.", options.userid);
			} else {
				options.cmbot.bot.playlistReorder(parseInt(options.arg), 0, function(result) {
					log("Move result: ", result);
					if(result.success) {
						options.cmbot.bot.pm("Track moved.", options.userid);
					} else {
					}
				});
			}
		},
		modonly: true,
		pmonly: true,
		acl: true,
		help: 'Put a certain song (specified by index) at the front of my queue.'
	},
	'getnext': {
		command: function(options) {
			options.cmbot.bot.playlistAll(function(res) {
//				try {
					var text = '';
					$(res.list).each(function(i, song) {
						if(i >= (options.cmbot.settings.setlimit !== false && options.cmbot.settings.setlimit !== 0 ? options.cmbot.settings.setlimit : 5))
							return false;
						log("Song: ", song);
						text += (i+1) + ': ' + song.metadata.artist + ' - ' + song.metadata.song + "\n";
					});
					if(text == '')
						text = 'Sorry, my queue is empty';
					options.cmbot.bot.pm(text, options.userid);
//				} catch(e) {
//					log("Exception getting playlist: ", e);
//				}
			});
		},
		modonly: true,
		pmonly: true,
		acl: true,
		help: 'Get the first 4 tracks on my queue.'
	},
	'avatar': {
		command: function(options) {
			if(avatars[options.arg] == 'undefined' || options.arg == '') {
				options.cmbot.bot.pm("Invalid argument. Type '/help avatar' for available arguments.", options.userid);
			} else {
				options.cmbot.bot.setAvatar(avatars[options.arg]);
			}
		},
		modonly: true,
		pmonly: true,
		acl: true,
		help: 'Set my avatar. Available options: ' + avatar_options.join(', ')
	},
	'playlist': {
		command: function(options) {
			options.cmbot.bot.playlistAll(function(res) {
				try {
					options.cmbot.bot.pm("I have " + res.list.length + " songs in my queue.", options.userid);
				} catch (e) {}
			});
		},
		modonly: true,
		pmonly: true,
		help: 'Show how many songs I have in my playlist.'
	},
	'queue': {
		command: function(options) {
			var text;
			if(options.cmbot.isFFA())
				text = options.cmbot.options.ffa_text;
			else
				text = options.cmbot.q.printQueue(true, options.cmbot.session.djs);
			options.cmbot.speakOrPM(text, options.pm, options.userid);
		},
		modonly: false,
		pmonly: false,
		help: 'Show who is in the queue.'
	},
	'modtrigger': {
		command: function(options) {
			log("creating mod trigger: " + options.arg);
			if(options.arg.match(/^([^ ]+) (.*)$/)) {
				var trigger = RegExp.$1.toLowerCase();
				var saying = RegExp.$2;
				
				var results = /shorten:([^ ]+)/g.execAll(saying);
				var urls = [];
				var badUrl = false;
				for(var i=0;i<results.length;i++) {
					if(!results[i][1].match(/(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/))
						badUrl = true;
					urls.push(results[i][1]);
				}
				if(badUrl) {
					options.cmbot.bot.pm("One or more URLs you are trying to shorten in your trigger is invalid. Please try again.", options.userid);
					return false;
				}
				
				options.cmbot.shortenUrls(urls, function(result) {
					for(var i=0;i<result.length;i++) {
						var url = result[i];
						saying = saying.replace('shorten:' + url.long, url.short);
						
						var text = '';
						var success = false;
						if(options.cmbot.commands[trigger] == undefined) {
							var preexisting = options.cmbot.settings.modtriggers[trigger] != undefined;
							log("trigger = " + trigger);
							log("saying = " + saying);
							options.cmbot.settings.modtriggers[trigger] = saying;
							options.cmbot.saveSettings();
							success = true;
							if (preexisting) {
								//bot.speak("Trigger updated.");
								text = 'updated';
								log(options.cmbot.users[options.userid].name + " updated mod trigger " + trigger);
							} else {
//								bot.speak("Trigger saved.");
								text = 'saved';
								log(options.cmbot.users[options.userid].name + " created mod trigger " + trigger);
							}
						} else {
							text = 'That\'s a command I already respond to!';
						}
						if(success)
							options.cmbot.bot.pm("Trigger " + text + ".", options.userid);
						else
							options.cmbot.bot.pm(text, options.userid);
					}
				});
				
			}
		},
		modonly: true,
		pmonly: true,
		help: 'Set a trigger that only mods can activate.'
	},
	'trigger': {
		command: function(options) {
			log("creating trigger: " + options.arg);
			if(options.arg.match(/^([^ ]+) (.*)$/)) {
				var trigger = RegExp.$1.toLowerCase();
				var saying = RegExp.$2;
				
				var results = /shorten:([^ ]+)/g.execAll(saying);
				var urls = [];
				var badUrl = false;
				for(var i=0;i<results.length;i++) {
					if(!results[i][1].match(/(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/))
						badUrl = true;
					urls.push(results[i][1]);
				}
				if(badUrl) {
					options.cmbot.bot.pm("One or more URLs you are trying to shorten in your trigger is invalid. Please try again.", options.userid);
					return false;
				}
				options.cmbot.shortenUrls(urls, function(result) {
					for(var i=0;i<result.length;i++) {
						var url = result[i];
						saying = saying.replace('shorten:' + url.long, url.short);
					}
					var text = '';
					var success = false;
					if(options.cmbot.commands[trigger] == undefined && options.cmbot.customCommands[trigger] == undefined && trigger != 'me') {
						var preexisting = options.cmbot.settings.triggers[trigger] != undefined;
						options.cmbot.settings.triggers[trigger] = saying;
						options.cmbot.saveSettings();
						success = true;
						if (preexisting) {
							//bot.speak("Trigger updated.");
							text = 'updated';
							log(options.cmbot.users[options.userid].name + " updated trigger " + trigger);
						} else {
//							bot.speak("Trigger saved.");
							text = 'saved';
							log(options.cmbot.users[options.userid].name + " created trigger " + trigger);
						}
					} else {
						//bot.speak("That trigger is a command I already respond to!");
						text = 'That\'s a command I already respond to!';
					}
					if(success)
						options.cmbot.bot.pm("Trigger " + text + ".", options.userid);
					else
						options.cmbot.bot.pm(text, options.userid);
				});
			}
		},
		modonly: true,
		pmonly: true,
		help: 'Add or update a trigger saying, to make me say something. Usage: /trigger <trigger> <saying>. <trigger> should be a single word, while <saying> can be any length. In <saying>, use %me% to have me use the name of the person who says the trigger command, and %dj% to have me say the name of the DJ whose song is currently playing. You can also have me automatically shorten urls by typing shorten:http://some.url.com/, for example. (Only mods can define a trigger, but anyone can use an already defined trigger.)'
	},
	'shitlist': {
		command: function(options) {
			if(options.arg == '') {
				options.cmbot.bot.pm("Usage: /shitlist username reason", options.userid);
				return false;
			}
			var result = false;
			var text = '';
			var mytext = '';
			var user = false;
			var reason = false;
			var arg = options.arg;
			$.each(options.cmbot.users, function(index, thisUser) {
				var regexp = new RegExp('^' + escapeRegExp(thisUser.name) + ' (.*)$', 'i');
				if(arg.match(regexp)) {
					user = thisUser;
					reason = RegExp.$1;
					return false;
				} else if(arg == thisUser.name) {
					user = thisUser;
					return false;
				}
			});
			if(user === false && options.arg.match(/([0-9a-f]{24})\s(.*)/)) {
				// Shitlisting a user by userid
				user = {
					userid: RegExp.$1,
					name: RegExp.$1
				};
				reason = RegExp.$2;
			} 
			
			if (user === false) {
				text = arg + " not found.";
			} else if(reason === false) {
				text = "Please specify a reason for shitlisting " + user.name + ".";
			} else if(options.cmbot.options.master_userid.indexOf(user.userid) > -1) {
				text = 'I\'m sorry, Dave. I\'m afraid I can\'t do that.'; 
			} else {
				if(user.mod) {
					text = "I'm not going to shitlist a mod!";
				} else {
					if(options.cmbot.settings.shitlist[user.userid] != null) {
						text = user.name + " is already shitlisted.";
					} else {
						options.cmbot.settings.shitlist[user.userid] = {name: user.name, reason: reason, originator: {userid: options.userid, name: options.cmbot.users[options.userid].name}};
						options.cmbot.saveSettings();
						text = user.name + " has been shitlisted by " + options.cmbot.users[options.userid].name + ".";
						mytext = user.name + " has been shitlisted.";
						result = true;
						if(typeof options.cmbot.users[user.userid] == 'object')
							options.cmbot.bot.bootUser(user.userid, reason);
						options.cmbot.saveSettings();
					}
				}
			}
			if(typeof callback == 'function') {
				callback(result, text);
			}
			if(result) {
				options.cmbot.bot.pm(mytext, options.userid, function(result) {
					options.cmbot.modpm(text, false, options.userid, false);
				});
			} else {
				options.cmbot.bot.pm(text, options.userid);
			}
		},
		modonly: true,
		pmonly: false,
		help: 'Adds a user to the shitlist. This will immediately boot them from the room, and whenever they try to join they will get booted. Use only for trolls. You must specify a reason, and I will keep track of who shitlisted whom, so don\'t abuse it!'
	},
	'unshitlist': {
		command: function(options) {
			if(options.arg == '') {
				options.cmbot.bot.pm("Usage: /unshitlist <username>", options.userid);
				return false;
			}
			var found = false;
			$.each(options.cmbot.settings.shitlist, function(each_userid, obj) {
				if(obj.name.toLowerCase() == options.arg.toLowerCase()) {
					found = true;
					delete options.cmbot.settings.shitlist[each_userid];
					options.cmbot.saveSettings();
					options.cmbot.modpm(options.cmbot.users[options.userid].name + " has unshitlisted " + obj.name + ".", false, options.userid, false);
					options.cmbot.bot.pm(options.arg + " removed from shitlist.", options.userid);
				}
			});
			if(!found)
				options.cmbot.bot.pm(options.arg + " not found.", options.userid);
		},
		modonly: true,
		pmonly: false,
		help: 'Remove a user from the shitlist. Use /unshitlist user.'
	},
	'settimezone': {
		command: function(options) {
			if(options.cmbot.settings.timezones == undefined)
				options.cmbot.settings.timezones = {};
			if(options.cmbot.timezones[options.arg] == undefined) {
				options.cmbot.bot.pm("Invalid syntax.", options.userid);
			} else {
				options.cmbot.settings.timezones[options.userid] = options.arg;
				options.cmbot.saveSettings();
				options.cmbot.bot.pm("Your timezone has been set to " + options.arg + ".", options.userid);
			}
		},
		modonly: true,
		pmonly: true,
		help: ''
	},
	'gettimezone': {
		command: function(options) {
			if(options.cmbot.settings.timezones[options.userid] == undefined)
				options.cmbot.bot.pm("You have not set your timezone yet. Use /settimezone to do so.", options.userid);
			else
				options.cmbot.bot.pm("Your timezone is currently set as " + options.cmbot.settings.timezones[options.userid] + ".", options.userid);
		},
		modonly: true,
		pmonly: true,
		help: ''
	},
	'tags': {
		command: function(options) {
			if(options.cmbot.session.nosong && options.arg == '') {
				options.cmbot.bot.pm("Nobody is DJ'ing!", options.userid);
			} else if(options.cmbot.session.current_song_tags !== false && options.arg == '') {
				log("Using cached tags");
				if(options.pm)
					options.cmbot.bot.pm(options.cmbot.session.current_song_tags, options.userid);
				else
					options.cmbot.bot.speak(options.cmbot.session.current_song_tags);
			} else {
				var artist = options.arg != '' ? options.arg : options.cmbot.currentSong.room.metadata.current_song.metadata.artist;
				var track = options.arg != '' ? false : options.cmbot.currentSong.room.metadata.current_song.metadata.song;
				options.cmbot.lastfm.getTags({
					artist: artist,
					track: track,
					callback: function(result) {
//						log("got tags: ", result);
						if(result.success) {
							var tags = [];
							$.each(result.tags, function(index, tag_obj) {
								tags.push(tag_obj.name);
							});
							var text = tags.length > 0 ? "Tags for " + (result.track == undefined ? result.artist : result.track + ' by ' + result.artist) + ': ' + tags.join(', ') : "No tags found.";
							if(options.arg == '')
								options.cmbot.session.current_song_tags = text;
							if(options.pm)
								options.cmbot.bot.pm(text, options.userid);
							else
								options.cmbot.bot.speak(text);
						} else {
							if(options.pm)
								options.cmbot.bot.pm(result.error + '.', options.userid);
							else
								options.cmbot.bot.speak(result.error + '.');
						}
					}
				});
			}
		},
		modonly: false,
		pmonly: false,
		help: 'Get tags from last.fm. Pass an artist as an argument for that artist\'s tags, or no arguments for the current song\'s tags.'
	},
	'plays': {
		command: function(options) {
			if(options.cmbot.session.nosong && options.arg == '') {
				options.cmbot.bot.pm("Nobody is DJ'ing!", options.userid);
				return false;
			}
			var artist = '', track = '';
			if(options.cmbot.currentSong.room.metadata.current_song != undefined) {
				artist = options.cmbot.currentSong.room.metadata.current_song.metadata.artist;
				track = options.cmbot.currentSong.room.metadata.current_song.metadata.song;
			}
			if(options.arg != '') {
				if(options.arg.match(/^(.*) [\>\-] (.*)$/)) {
					artist = RegExp.$1;
					track = RegExp.$2;
				} else {
					artist = options.arg;
					track = false;
				}
			}
			if(options.cmbot.options.playsMode == 'lastfm') {
				options.cmbot.lastfm.getPlays({
					artist: artist,
					track: track,
					callback: function(result) {
						if(result.success) {
							if(options.cmbot.session.scrobbled && options.arg == '')
								result.plays--;
							var text;
							if(track == false)
								text = "There " + (result.plays != 1 ? 'have' : 'has') + " been " + result.plays + " plays by " + artist + (options.cmbot.options.lastfm.earliest_scrobble != '' ? " since " + options.cmbot.options.lastfm.earliest_scrobble : "") + ".";
							else
								text = result.track + " by " + result.artist + " has been played " + result.plays + " time" + (result.plays != 1 ? 's' : '') + (options.cmbot.options.lastfm.earliest_scrobble != '' ? " since " + options.cmbot.options.lastfm.earliest_scrobble : "") + ".";
								options.cmbot.shortenUrl('http://www.last.fm/user/' + options.cmbot.lastfm.username + '/library/music/' + artist, function(result) {
									var url = 'http://www.last.fm/user/' + options.cmbot.lastfm.username + '/library/music/' + artist;
									if(result.success) {
										url = result.url;
									}
									text += ' ' + url;
									options.cmbot.speakOrPM(text, options.pm, options.userid);
								});
						} else {
							if(options.pm)
								options.cmbot.bot.pm(result.error, options.userid);
							else
								options.cmbot.bot.speak(result.error);
						}
					}
				});
			} else if(options.cmbot.options.playsMode == 'mysql') {
				if(options.cmbot.options.mysql.enabled !== true) {
					options.cmbot.bot.pm("Sorry, local logging of song plays is not enabled.", options.userid);
					return false;
				}
				var mysql = options.cmbot.getMysqlClient();
				if(mysql !== false) {
					var query;
					if(track === false)
						query = "SELECT s.artist, COUNT(s.id) AS play_count FROM song s JOIN songlog sl ON sl.songid = s.id WHERE LOWER(s.artist) = '" + artist.toLowerCase() + "' group by s.artist";
					else
						query = "SELECT s.artist, s.track, COUNT(s.id) AS play_count FROM song s JOIN songlog sl ON sl.songid = s.id WHERE LOWER(s.artist) = '" + artist.toLowerCase() + "' AND LOWER(s.track) = '" + track + "' GROUP BY s.artist";
					mysql.query(query, function selectCb(err, results, fields) {
						if(err) {
							options.cmbot.speakOrPM("Sorry, something went wrong: " + err, options.pm, options.userid);
						} else {
							var play_count = results.length > 0 ? results[0].play_count : 0;
							if(play_count > 0) {
								artist = results[0].artist;
								if(track !== false)
									track = results[0].track;
							}
							var text;
							if(track === false)
								text = "There " + (play_count != 1 ? 'have' : 'has') + " been " + play_count + " plays by " + artist + ".";
							else {
								text = track + " by " + artist + " has been played " + play_count + " time" + (play_count != 1 ? 's' : '') + ".";
								if(play_count == 0)
									text = "Track not found or else there have been 0 plays.";
							}
							options.cmbot.speakOrPM(text, options.pm, options.userid);
							mysql.end();
						}
					});	
				} else {
					options.cmbot.bot.pm("Sorry, mysql doesn't seem to be set up properly.", options.userid);
				}
			} else if(options.cmbot.options.playsMode == 'sqlite') {
				if(!options.cmbot.options.sqlite.enabled) {
					options.cmbot.bot.pm("Sorry, local logging of song plays is not enabled.", options.userid);
					return false;
				} else {
					var query = "SELECT s.artist, COUNT(s.id) AS play_count FROM song s LEFT JOIN songlog sl ON sl.songid = s.id WHERE LOWER(s.artist) = '" + artist.toLowerCase() + "' group by s.artist";
					var trackQuery = track === false ? '' : "SELECT s.artist, s.track, COUNT(s.id) AS play_count FROM song s LEFT JOIN songlog sl ON sl.songid = s.id WHERE LOWER(s.artist) = '" + artist.toLowerCase() + "' AND LOWER(s.track) = '" + track.toLowerCase() + "' GROUP BY s.artist";
					options.cmbot.sqlite.get(query, function(err, row) {
						if(row == undefined) {
							options.cmbot.speakOrPM("Artist not found.", options.pm, options.userid);
						} else {
							if(track === false) {
								var play_count = row.play_count;
								artist = row.artist;
								var text = "There " + (play_count != 1 ? 'have' : 'has') + " been " + play_count + " plays by " + artist + ".";
								options.cmbot.speakOrPM(text, options.pm, options.userid);
							} else {
								options.cmbot.sqlite.get(trackQuery, function(err, row) {
									var play_count = 0;
									if(row != undefined) {
										play_count = row.play_count;
										artist = row.artist;
										track = row.track;
									}
									var text = track + " by " + artist + " has been played " + play_count + " time" + (play_count != 1 ? 's' : '') + ".";
									if(play_count == 0)
										text = "Track not found or else there have been 0 plays.";
									options.cmbot.speakOrPM(text, options.pm, options.userid);
								});
							}
						}
					});
				}
			} else {
				options.cmbot.bot.pm("Sorry, but my master didn't configure me properly to show song plays.", options.userid);
			}
		},
		modonly: false,
		pmonly: false,
		help: 'Look up (on last.fm) how many times a song or artist has been played in the room. Usage: /plays [artist [- track]]. If artist and track are ommitted, the current song is looked up. Examples: /plays bonobo - black sands; /plays bonobo; /plays'
	},
	'setcount': {
		command: function(options) {
			if(options.arg.match('^(.*) ([0-3]+)$')) {
				var username = RegExp.$1;
				var newcount = RegExp.$2;
				var user = options.cmbot.getUserByName(username);
//				log("user = ", user);
//				log("newcount = " + newcount);
//				log("type = " + typeof user);
				if (typeof user == 'object') {
					if(!user.djing) {
						options.cmbot.bot.pm(user.name + " isn't DJ'ing right now!", options.userid);
						return false;
					}
//					log("setting count: " + arg);
					user.playcount = newcount;
					options.cmbot.savePlayCounts();
					options.cmbot.bot.pm("Play count for " + user.name + " set to " + newcount, options.userid);
				} else {
					options.cmbot.bot.pm("User not found.", options.userid);
				}
			} else {
				options.cmbot.bot.pm("Invalid syntax", userid);
			}
		},
		modonly: true,
		pmonly: true,
		help: 'Set the playcount for a user.'
	},
	'addme': {
		command: function(options) {
			if(!options.cmbot.options.queue_enabled) {
				var text = 'Sorry, I don\'t enforce a queue.';
				options.cmbot.speakOrPM(text, options.pm, options.userid);
				return false;
			}
			if (!options.cmbot.isFFA()) {
				if(!options.cmbot.users[options.userid].mod && !options.cmbot.options.allow_mobile_djs && !options.cmbot.options.allow_mobile_djs && (options.cmbot.users[options.userid].laptop == 'iphone' || options.cmbot.users[options.userid].laptop == 'android') && options.cmbot.settings.mobileWhitelist[options.userid] == undefined) {
					options.cmbot.speakOrPM("Sorry but you must be whitelisted in order to DJ from a mobile device. Let a mod know what you were going to play and they will whitelist you.", options.pm, options.userid);
				} else if(options.cmbot.settings.deckshitlist[options.userid] != undefined) {
					options.cmbot.bot.pm("You are banned from DJ'ing" + (options.cmbot.settings.deckshitlist[options.userid].reason == "" ? "." : ": " + options.cmbot.settings.deckshitlist[options.userid].reason), options.userid, function(result) {
						if(!result.success) {
							options.cmbot.bot.speak("You are banned from DJ'ing, " + options.cmbot.users[options.userid].name + (options.cmbot.settings.deckshitlist[options.userid].reason == "" ? "." : ": " + cmbot.settings.deckshitlist[options.userid].reason));
						}
					});
				} else {
	//				log("options: ", options);
					var result = options.cmbot.q.newAddUser(options.cmbot.users[options.userid]);
					log("result = ", result);
					if(!result.success) {
						if(result.code == options.cmbot.q.USER_IN_QUEUE) {
							if(options.pm)
								options.cmbot.bot.pm("You are number " + result.spot + " in the queue.", options.userid);
							else
								options.cmbot.bot.speak(options.cmbot.users[options.userid].name + " is number " + result.spot + " in the queue.");
						} else if(result.code == options.cmbot.q.USER_ON_DECKS) {
							if(options.pm)
								options.cmbot.bot.pm("You're already DJ'ing!", options.userid);
							else
								options.cmbot.bot.speak("You're already DJ'ing, " + options.cmbot.users[options.userid].name + "!");
						}
					} else {
						options.cmbot.bot.speak(result.queue);
						options.cmbot.checkQueue();
						if(options.cmbot.session.timers.autodj !== false) {
							log("resetting autodj timer");
							clearTimeout(options.cmbot.session.timers.autodj);
							options.cmbot.session.timers.autodj = false;
						}
						if(options.cmbot.session.djing) {
							if(options.cmbot.session.autodjing && options.cmbot.currentSong.room.metadata.current_dj != options.cmbot.options.bot.userid && options.cmbot.session.max_djs == options.cmbot.session.djs.length) {
								// The bot is on the decks but isn't playing a song, and the decks are full, so step down.
								log("autodj: someone added to queue and I am autodj'ing so I'm stepping down.");
								options.cmbot.bot.remDj(options.cmbot.options.bot.userid);
							}
						}
					}
				}
			} else {
				options.cmbot.bot.pm(options.cmbot.options.ffa_text, options.userid);
			}
		},
		modonly: false,
		pmonly: false,
		help: 'Add yourself to the queue.'
	},
	'about': {
		command: function(options) {
			options.cmbot.speakOrPM("CMBot version " + options.cmbot.VERSION + " written by atomjack. https://github.com/atomjack/cmbot", options.pm, options.userid);
		},
		modonly: false,
		pmonly: false,
		help: 'About me.'
	},
	'removeme': {
		command: function(options) {
			if(!options.cmbot.options.queue_enabled) {
				var text = 'Sorry, I don\'t enforce a queue.';
				options.cmbot.speakOrPM(text, options.pm, options.userid);
				return false;
			}
			if (!options.cmbot.isFFA()) {
				var result = options.cmbot.q.newRemoveUser(options.userid);
				log("result: ", result);
				if(result.success) {
					if(options.pm)
						options.cmbot.bot.pm("You have been removed from the queue.", options.userid);
					else
						options.cmbot.bot.speak("You have been removed from the queue, " + options.cmbot.users[options.userid].name + ".");
					options.cmbot.saveSettings();
					options.cmbot.checkQueue();
					options.cmbot.autodj();
				} else if(result.code == options.cmbot.q.USER_NOT_IN_QUEUE) {
					if(options.pm)
						options.cmbot.bot.pm("You aren't in the queue!", options.userid);
					else
						options.cmbot.bot.speak("You aren't in the queue, " + options.cmbot.users[options.userid].name + "!");
				}
			} else {
				if(options.pm)
					options.cmbot.bot.pm("It's Free For All Friday! No Queue today.", options.userid);
				else
					options.cmbot.bot.speak(options.cmbot.options.ffa_text);
			}
		},
		modonly: false,
		pmonly: false,
		help: 'Remove yourself from the queue.'
	},
	'deckshitlist': {
		command: function(options) {
			var text;
			if(options.arg == "")
				text = "Please specify a user to ban from DJ'ing";
			else {
				var user = false;
				var reason;
				log("arg = " + options.arg);
				$.each(options.cmbot.users, function(index, thisUser) {
					log("name = " + escapeRegExp(thisUser.name));
					var regexp = new RegExp('^' + escapeRegExp(thisUser.name) + '[ ]{0,1}(.*)$', "i");
					if(options.arg.match(regexp)) {
						log("user found1");
						user = thisUser;
						reason = RegExp.$1;
						return false;
					} else if(options.arg == thisUser.name) {
						log("user found2");
						user = thisUser;
						reason = "";
						return false;
					}
				});
				if(user === false)
					text = "User not found.";
				else if(options.cmbot.settings.deckshitlist[user.userid] != undefined)
					text = user.name + " is already banned from DJ'ing";
				else {
					options.cmbot.settings.deckshitlist[user.userid] = {
						name: user.name,
						reason: reason,
						originator: {
							name: options.cmbot.users[options.userid].name,
							userid: options.userid
						}
					};
					options.cmbot.saveSettings();
					text = user.name + " is now banned from DJ'ing";
				}
			}
			options.cmbot.bot.pm(text, options.userid);
		},
		modonly: true,
		pmonly: true,
		help: "Ban a user from DJ'ing. I will automatically escort them from the decks if they step up. Usage: /deckshitlist username [reason]"
	},
	'deckunshitlist': {
		command: function(options) {
			var text;
			if(options.arg == "")
				text = "Please specify a user to ban from DJ'ing";
			else {
				var user = options.cmbot.getUserByName(options.arg);
				if(user === false)
					text = "User not found.";
				else if(options.cmbot.settings.deckshitlist[user.userid] == undefined)
					text = user.name + " is not banned from DJ'ing";
				else {
					delete options.cmbot.settings.deckshitlist[user.userid];
					options.cmbot.saveSettings();
					text = user.name + " is no longer banned from DJ'ing";
				}
			}
			options.cmbot.bot.pm(text, options.userid);
		},
		modonly: true,
		pmonly: true,
		help: "Remove the ban on a user from DJ'ing, allowing them to DJ again."
	},
	'searchplaylist': {
		command: function(options) {
			if(options.arg.length <= 3) {
				options.cmbot.bot.pm("Please use a search term of more than 3 characters.", options.userid);
			} else {
				options.cmbot.bot.playlistAll(function(res) {
					try {
						var matches = 0;
						var i = 0;
						log("Search playlist results: " + res.list.length);
						for(var i=0;i<res.list.length;i++) {
							var song = res.list[i];
							var search_terms = options.arg.split(' ');
							var matched = true;
							for(var j=0;j<search_terms.length;j++) {
								var term = search_terms[j];
								var re = new RegExp(term, 'gi');
								if(!song.metadata.artist.match(re) && !song.metadata.song.match(re)) {
									matched = false;
								}
							}
							if(matched) {
								options.cmbot.bot.pm(i + ": " + song.metadata.artist + ' - ' + song.metadata.song, options.userid);
								matches++;
							}
						}
						if(matches == 0)
							options.cmbot.bot.pm("Sorry, nothing found.", options.userid);
					} catch(e) {}
				});
			}
		},
		modonly: true,
		pmonly: true,
		acl: true,
		help: ''
	},
	'removesong': {
		command: function(options) {
			log("got here");
			if (!options.arg.match(/^[0-9]+$/)) {
				options.cmbot.bot.pm("Invalid number.", options.userid);
			} else {
				options.cmbot.bot.playlistAll(function(res) {
					var song = res.list[parseInt(options.arg)];
					options.cmbot.bot.playlistRemove(parseInt(options.arg), function(result) {
						log("trying to remove song " + options.arg + ": ", result);
						if(result.success) {
							if(options.cmbot.options.lastfm.enabled === true) {
									options.cmbot.lastfm.unloveTrack({
										artist: song.metadata.artist,
										track: song.metadata.song,
										callback: function(result) {
											var text = "";
											if(result.success) {
												options.cmbot.session.snagged = false;
												text = "Removed song.";
											} else {
												text = "Erm, something went wrong: " + result.error + ".";
											}
											options.cmbot.bot.pm(text, options.userid);
										}
									});
							} else {
								options.cmbot.bot.pm("Removed song.", options.userid);
							}
						} else
							options.cmbot.bot.pm("Erm, something went wrong: " + result.err, options.userid);
					});
				});
			}
		},
		modonly: true,
		pmonly: true,
		acl: true,
		help: ''
	},
	'shortenurl': {
		command: function(options) {
			var regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
			if(!regexp.test(options.arg)) {
				options.cmbot.bot.pm("Invalid URL.", options.userid);
			} else {
				options.cmbot.shortenUrl(options.arg, function(res) {
					if(res.success) {
						options.cmbot.bot.pm(res.url, options.userid);
					} else {
						options.cmbot.bot.pm("Something went wrong, sorry.", options.userid);
					}
				});
			}
		},
		modonly: false,
		pmonly: true,
		help: 'Shorten an URL with Google\'s URL Shortener.'
	},
	'addacl': {
		command: function(options) {
			if(!options.arg.match(/^([^ ]+) (.*)$/)) {
				options.cmbot.bot.pm("Please specify arguments.", options.userid);
			} else {
				var acl_command = RegExp.$1;
				var user = options.cmbot.getUserByName(RegExp.$2);
				if(user === false) {
					options.cmbot.bot.pm("User " + RegExp.$2 + " not found.", options.userid);
				} else if(options.cmbot.commands[acl_command] == undefined && options.cmbot.customCommands[acl_command] == undefined) {
					options.cmbot.bot.pm("Command /" + acl_command + " not found.", options.userid);
				} else {
					options.cmbot.settings.acl[acl_command] = options.cmbot.settings.acl[acl_command] || {};
					if(options.cmbot.settings.acl[acl_command][user.userid] != undefined) {
						options.cmbot.bot.pm(user.name + " already has access to /" + acl_command + ".", options.userid);
					} else {
						options.cmbot.settings.acl[acl_command][user.userid] = user.name;
						options.cmbot.saveSettings();
						options.cmbot.bot.pm("You now have access to the command /" + acl_command + ".", user.userid, function(result) {
							options.cmbot.bot.pm(user.name + " now has access to /" + acl_command + ".", options.userid);
						});
					}
				}
			}
		},
		modonly: true,
		pmonly: true
	},
	'remacl': {
		command: function(options) {
			if(!options.arg.match(/^([^ ]+) (.*)$/)) {
				options.cmbot.bot.pm("Please specify arguments.", options.userid);
			} else {
				var acl_command = RegExp.$1;
				var user = options.cmbot.getUserByName(RegExp.$2);
				if(user === false) {
					options.cmbot.bot.pm("User " + RegExp.$2 + " not found.", options.userid);
				} else if(options.cmbot.commands[acl_command] == undefined && options.cmbot.customCommands[acl_command] == undefined) {
					options.cmbot.bot.pm("Command /" + acl_command + " not found.", options.userid);
				} else if((acl_command == 'addacl' || acl_command == 'remacl') && options.cmbot.options.master_userid.indexOf(user.userid) > -1) {
					options.cmbot.bot.pm("Sorry, I can't do that.", options.userid); // Don't allow the master user of the bot to remove access to addacl or remacl
				} else {
					options.cmbot.settings.acl[acl_command] = options.cmbot.settings.acl[acl_command] || [];
					if(options.cmbot.settings.acl[acl_command][user.userid] != undefined) {
						options.cmbot.bot.pm(user.name + " no longer has access to /" + acl_command + ".", options.userid);
						delete options.cmbot.settings.acl[acl_command][user.userid];
						options.cmbot.saveSettings();
					} else {
						options.cmbot.bot.pm(user.name + " already doesn't have access to /" + acl_command + ".", options.userid);
					}
				}
			}
			options.cmbot.saveSettings();
		},
		modonly: true,
		pmonly: true,
	},
//	'getacl': {
//		command: function(options) {
//			if(cmbot.commands[options.arg] == undefined) {
//				bot.pm("Command not found.", options.userid);
//			} else {
////				var arr = [];
////				log("")
//			}
//		},
//		modonly: true,
//		pmonly: true,
//		acl: true
//	},
	'remove': {
		command: function(options) {
			if(!options.cmbot.options.queue_enabled) {
				var text = 'Sorry, I don\'t enforce a queue.';
				options.cmbot.speakOrPM(text, options.pm, options.userid);
				return false;
			}
			if (!options.cmbot.isFFA()) {
				if(options.arg == '') {
					options.cmbot.bot.pm("Usage: /remove username", options.userid);
				} else {
					var user = options.cmbot.getUserByName(options.arg);
					if(user === false) {
						options.cmbot.bot.pm("User not found.", options.userid);
					} else {
						var result = options.cmbot.q.newRemoveUser(user.userid);
						if(result.success) {
							options.cmbot.bot.pm(user.name + " removed from queue.", options.userid);
							options.cmbot.saveSettings();
							options.cmbot.checkQueue();
							options.cmbot.autodj();
						} else if(result.code == options.cmbot.q.USER_NOT_IN_QUEUE) {
							var text = user.name + " is not in the queue!";
							if(options.userid == user.userid)
								text = "You are not in the queue!";
							options.cmbot.bot.pm(text, options.userid);
						}
					}
				}
			} else {
				options.cmbot.bot.pm(options.cmbot.options.ffa_text, options.userid);
			}
		},
		modonly: true,
		pmonly: true
	},
	'add': {
		command: function(options) {
			if(!options.cmbot.options.queue_enabled) {
				var text = 'Sorry, I don\'t enforce a queue.';
				options.cmbot.speakOrPM(text, options.pm, options.userid);
				return false;
			}
			if (!options.cmbot.isFFA()) {
				if(options.arg == '') {
					options.cmbot.bot.pm("Please specify a user to add.", options.userid);
				} else {
					var user = options.cmbot.getUserByName(options.arg);
					if(user === false) {
						options.cmbot.bot.pm("User not found.", options.userid);
					} else {
						var result = options.cmbot.q.newAddUser(user);
						log("result = " + result);
						if(result.success) {
							options.cmbot.bot.speak(result.queue);
							options.cmbot.checkQueue();
							if(options.cmbot.session.djing) {
								if(options.cmbot.session.autodjing && options.cmbot.currentSong.room.metadata.current_dj != options.cmbot.options.bot.userid && options.cmbot.session.max_djs == options.cmbot.session.djs.length) {
									// The bot is on the decks but isn't playing a song, and the decks are full, so step down.
									log("autodj: someone added to queue and I am autodj'ing so I'm stepping down.");
									options.cmbot.bot.remDj(options.cmbot.options.bot.userid);
								}
							}
							options.cmbot.saveSettings();
						} else {
							if(result.code == options.cmbot.q.USER_ON_DECKS) {
								options.cmbot.bot.pm(user.name + " is DJ'ing!", options.userid);
							} else if(result.code == options.cmbot.q.USER_IN_QUEUE) {
								options.cmbot.bot.pm(user.name + " is number " + result.spot + " in the queue.", options.userid);
							}
						}
					}
				}
			} else {
				options.cmbot.bot.pm(options.cmbot.options.ffa_text, userid);
			}
		},
		modonly: true,
		pmonly: true
	},
	'warn': {
		command: function(options) {
			if(options.cmbot.session.nosong) {
				options.cmbot.bot.pm("Nobody is DJ'ing!", options.userid);
			} else if(options.userid == options.cmbot.currentSong.room.metadata.current_song.djid) {
				options.cmbot.bot.pm("You can't warn yourself!", options.userid);
			} else {
				var warnUser = options.cmbot.users[options.cmbot.currentSong.room.metadata.current_song.djid];
				if(options.cmbot.session.warned) {
					options.cmbot.bot.pm("A warning has already been sent to " + warnUser.name + " for this song.", options.userid);
				} else {
					if(!warnUser.djing) {
						options.cmbot.bot.pm(warnUser.name + " is not DJ'ing!", options.userid);
					} else {
						options.cmbot.session.warned = true;
						var text = "your song does not fall within the established genre of the room or else it's not loading.  Please skip or you will be removed from the decks in 15 seconds.";
						if(options.arg == 'loading')
							text = "your song is not loading. Please skip or you will be removed from the decks in 15 seconds.";
						else if(options.arg == 'genre')
							text = "your song does not fall within the established genre of the room.  Please skip or you will be removed from the decks in 15 seconds.";
						options.cmbot.bot.speak("@" + warnUser.name + ", " + text);
						warnUser.timers.warning = setTimeout(function() {
							options.cmbot.bot.remDj(warnUser.userid);
							options.cmbot.bot.pm("Sorry, you didn't skip in time.", warnUser.userid);
						}, 15*1000);
						options.cmbot.modpm(options.cmbot.users[options.userid].name + " has sent a warning to " + warnUser.name + ".", false, options.userid, true);
						options.cmbot.bot.pm("Warning sent to " + warnUser.name, options.userid);
					}
				}
			}
		},
		modonly: true,
		pmonly: true,
		help: 'Warn a user to skip their song. Use /warn for a generic message, or "/warn loading" or "/warn genre" for a more specific warning. Use /unwarn to cancel.'
	},
	'unwarn': {
		command: function(options) {
			if(options.cmbot.session.warned) {
				var warnUser = options.cmbot.users[options.cmbot.currentSong.room.metadata.current_song.djid];
				clearTimeout(warnUser.timers.warning);
				options.cmbot.modpm(options.cmbot.users[options.userid].name + " has cancelled the warning to " + warnUser.name + ".", false, options.userid);
				options.cmbot.bot.pm("Warning cancelled.", options.userid);
			} else {
				options.cmbot.bot.pm("No warning has been sent for the current song.", options.userid);
			}
		},
		modonly: true,
		pmonly: true,
		help: 'Cancel a warning.'
	},
	'move': {
		command: function(options) {
			if (options.cmbot.isFFA()) {
				options.cmbot.bot.pm(options.cmbot.options.ffa_text, options.userid);
			}
			else {
				if(options.arg.match(/^(.*)\s([0-9]+)$/)) {
					var userToMove = options.cmbot.getUserByName(RegExp.$1);
					var position = RegExp.$2;
					if(userToMove === false) {
						options.cmbot.bot.pm("User not found.", options.userid);
					}
					else if (position <= options.cmbot.q.getQueueLength() && position > 0) {
						var queue = options.cmbot.q.getQueue();
						var oldPosition = -1;
						$(queue).each(function(index, userid){
							var user = options.cmbot.users[userid];
							if(user.userid == userToMove.userid)
								oldPosition = index;
						});
						if (oldPosition > -1) {
							position--; // user will be specifying 1 as first user in queue, but we need 0 to be first 
							options.cmbot.q.moveUser(oldPosition, position);
							options.cmbot.bot.pm(userToMove.name + " moved to position " + (position + 1), options.userid);
						} else {
							options.cmbot.bot.pm(userToMove.name + " is not in the queue!", options.userid);
						}
					}
					else {
						options.cmbot.bot.pm("Invalid position.", userid);
					}
				} else {
					options.cmbot.bot.pm("Invalid syntax. Use /move user 1, for example.", options.userid);
				}
			}
		},
		modonly: true,
		pmonly: true,
		help: 'Rearrange the queue. Usage: /move <username> <position>. <username> should be the name of the user to move. <position> should be an integer - first spot in the queue is 1, second spot is 2, etc.'
	},
	'unmodtrigger': {
		command: function(options) {
			if (options.cmbot.settings.modtriggers[options.arg] != undefined) {
				delete options.cmbot.settings.modtriggers[options.arg];
				options.cmbot.saveSettings();
				log(options.cmbot.users[options.userid].name + " removed mod trigger " + options.arg);
				options.cmbot.bot.pm("Mod trigger removed.", options.userid);
			} else
				options.cmbot.bot.pm("Mod trigger not found.", options.userid);
		},
		modonly: true,
		pmonly: true,
		help: 'Remove a trigger.'
	},
	'untrigger': {
		command: function(options) {
			if (options.cmbot.settings.triggers[options.arg] != undefined) {
				delete options.cmbot.settings.triggers[options.arg];
				options.cmbot.saveSettings();
				log(options.cmbot.users[options.userid].name + " removed trigger " + options.arg);
				options.cmbot.bot.pm("Trigger removed.", options.userid);
			} else
				options.cmbot.bot.pm("Trigger not found.", options.userid);
		},
		modonly: true,
		pmonly: true,
		help: 'Remove a trigger.'
	},
	'lame': {
		command: function(options) {
			options.cmbot.bot.vote('down');
			options.cmbot.session.lamed = true;
		},
		modonly: true,
		pmonly: true,
		help: 'I\'ll lame the current song.'
	},
	'awesome': {
		command: function(options) {
			options.cmbot.bot.vote('up');
		},
		modonly: true,
		pmonly: true,
		help: 'I\'ll awesome the current song.'
	},
	'deccount': {
		command: function(options) {
			options.cmbot.bot.pm("This command is deprecated. Please use /setcount instead.", options.userid);
		},
		modonly: true,
		pmonly: true,
		hide: true,
		help: 'Decrease the playcount for a DJ. Use this if their song didn\'t play properly and they had to skip. (Deprecated)'
	},
	'echo': {
		command: function(options) {
			if(options.arg != '')
				options.cmbot.bot.speak(options.arg);
		},
		modonly: true,
		pmonly: true,
		help: 'Make me say something.'
	},
	'dj': {
		command: function(options) {
			options.cmbot.q.prune();
			if (options.cmbot.isFFA()) {
				if($(options.cmbot.session.djs).length < options.cmbot.session.max_djs)
					options.cmbot.bot.addDj();
				else {
					if(options.pm)
						options.cmbot.bot.pm("Sorry, I can't DJ right now, there's no room!", options.userid);
					else
						options.cmbot.bot.speak("Sorry, I can't DJ right now, there's no room.");
				}
			}
			else {
				var qlength = 0;
				$.each(options.cmbot.q.getQueue(), function(index, userid) {
					if(!options.cmbot.users[userid].afk)
						qlength++;
				});
				if(options.cmbot.users[options.cmbot.options.bot.userid].djing) {
					if(options.pm)
						options.cmbot.bot.pm("I'm already DJ'ing!", options.userid);
					else
						options.cmbot.bot.speak("I'm already DJ'ing, " + options.cmbot.users[options.userid].name + "!");
				} else if ((qlength == 0 && $(options.cmbot.session.djs).length < options.cmbot.session.max_djs) || options.cmbot.session.max_djs - $(options.cmbot.session.djs).length > options.cmbot.q.getQueue().length) {
					// Queue is empty AND there is a free spot, or there are more free spots than the length of the queue, so DJ!
//					log("adding dj");
					options.cmbot.bot.addDj(function(result) {
						if(result.success)
							options.cmbot.users[options.cmbot.options.bot.userid].djing = true;
					});
				}
				else {
//					log("queue isn't empty");
					// Queue is not empty, or else there are not enough free DJ spots, so add the bot to the queue.
					var result = options.cmbot.q.newAddUser(options.cmbot.options.bot.userid);
					if(!result.success) {
						if(result.code == options.cmbot.q.USER_IN_QUEUE) {
							if(options.pm)
								options.cmbot.bot.pm("I am number " + result.spot + " in the queue.", options.userid);
							else
								options.cmbot.bot.speak("I am number " + result.spot + " in the queue.");
						} else if(result.code == options.cmbot.q.USER_ON_DECKS) {
							if(options.pm)
								options.cmbot.bot.pm("I'm already DJ'ing!", options.userid);
							else
								options.cmbot.bot.speak("I'm already DJ'ing, " + options.cmbot.users[options.userid].name + "!");
						}
					} else {
						options.cmbot.bot.speak(result.queue);
					}
				}
			}
		},
		modonly: true,
		pmonly: false,
		help: 'Make me DJ!'
	},
	'yoink': {
		command: function(options) {
			if(options.cmbot.session.nosong) {
				var text = "Nobody's DJ'ing right now!";
				if(options.pm)
					options.cmbot.bot.pm(text, options.userid);
				else
					options.cmbot.bot.speak(text);
				return false;
			}
			options.cmbot.yoinkTrack(function(result){
				var text;
				if(result.success) {
					text = 'Mine!!';
				} else if(result.error == options.cmbot.q.ALREADY_YOINKED)
					text = "I've already yoinked this one!";
				else
					text = result.error;
				if(options.pm)
					options.cmbot.bot.pm(text, options.userid);
				else
					options.cmbot.bot.speak(text);
			});
		},
		modonly: true,
		pmonly: false,
		help: 'I will \'love\' the currently playing song on last.fm, and also add the song to my queue.'
	},
	'fanme': {
		command: function(options) {
			options.cmbot.bot.becomeFan(options.userid, function(result) {
				if(options.pm)
					options.cmbot.bot.pm('Wawaweewa', options.userid);
				else
					options.cmbot.bot.speak(":heart: I love " + options.cmbot.users[options.userid].name + " long time. :heart:");
			});
		},
		modonly: false,
		pmonly: false,
		help: 'I\'ll love you long time!'
	},
	'playcount': {
		command: function(options) {
			if(options.cmbot.session.nosong) {
				var text = "Nobody's DJ'ing right now!";
				if(options.pm)
					options.cmbot.bot.pm(text, options.userid);
				else
					options.cmbot.speak(text);
				return false;
			}
			var counts = options.cmbot.getPlayCounts();
//			log("counts: ", counts);
			if(options.pm)
				options.cmbot.bot.pm(counts.join(', '), options.userid);
			else
				options.cmbot.bot.speak(counts.join(', '));
		},
		modonly: false,
		pmonly: false,
		help: 'Show how many songs each DJ currently on the decks has played.'
	},
	'ban': {
		command: function(options) {
			var found = false;
			var foundArtist = '';
			$.each(options.cmbot.settings.bannedArtists, function(key, val) {
				if(key.toLowerCase() == arg.toLowerCase()) {
					found = true;
					foundArtist = key;
				}
			});
			var text;
			if(found) {
				text = foundArtist + " is already banned.";
			} else {
				options.cmbot.settings.bannedArtists[arg] = 1;
				log("banned artists now ", options.cmbot.settings.bannedArtists);
				options.cmbot.saveSettings();
				text = options.arg + " is now banned.";
			}
			if(options.pm)
				options.cmbot.bot.pm(text, options.userid);
			else
				options.cmbot.bot.speak(text);
		},
		modonly: true,
		pmonly: false,
		help: 'Ban an artist by name. Case insensitive.'
	},
	'unban': {
		command: function(options) {
			var found = false;
			var foundArtist = '';
			$.each(options.cmbot.settings.bannedArtists, function(key, val) {
				if(key.toLowerCase() == arg.toLowerCase()) {
					delete options.cmbot.settings.bannedArtists[key];
					log("banned artists now ", options.cmbot.settings.bannedArtists);
					options.cmbot.saveSettings();
					found = true;
					foundArtist = key;
				}
			});
			var text;
			if(found) {
				text = foundArtist + " is now unbanned.";
			} else {
				text = arg + " is not banned.";
			}
			if(options.pm)
				options.cmbot.bot.pm(text, options.userid);
			else
				options.cmbot.bot.speak(text);
		},
		modonly: true,
		pmonly: false,
		help: 'Unban an artist by name. Case insensitive.'
	},
	'enforcement': {
		command: function(options) {
			var text;
			if(options.arg == '') {
				text = "Enforcement is " + (options.cmbot.session.enforcement ? 'on' : 'off') + ".";
			} else if(options.arg == 'on') {
				options.cmbot.session.enforcement = true;
				text = "Enforcement is now on.";
			} else if(options.arg == 'off') {
				options.cmbot.session.enforcement = false;
				text = "Enforcement is now off.";
			} else {
				text = "Usage: /enforcement [on|off]";
			}
			if(options.pm)
				options.cmbot.bot.pm(text, options.userid);
			else
				options.cmbot.bot.speak(text);
		},
		modonly: true,
		pmonly: false,
		help: 'Turn queue enforcement on or off. If it\'s off, I won\'t escort a DJ off the deck if they get on the deck when it isnt\'t their turn.'
	},
	'refresh': {
		command: function(options) {
			var text = '';
			try {
				var user = options.cmbot.users[options.userid];
				if (user.djing) {
					options.cmbot.session.refreshes.push(user.userid);
					options.cmbot.users[user.userid].refresh = true;
					text = (options.pm ? "Y" : user.name + ", y") + "ou can refresh now without losing your spot.";
					user.timers.removeRefresh = setTimeout(function() {
						user.refresh = false;
						options.cmbot.session.refreshes.splice(options.cmbot.session.refreshes.indexOf(user.userid));
						if(!user.present)
							options.cmbot.bot.speak(user.name + " hasn't returned in time. Cancelling refresh.");
						else if(!user.djing)
							options.cmbot.bot.pm(user.name + ", you didn't step back up in time! Sorry, you lost your spot.", user.userid, function(result) {
								if(!result.success)
									options.cmbot.bot.speak(user.name + ", you didn't step back up in time! Sorry, you lost your spot.");
							});
						else
							options.cmbot.bot.pm(user.name + ", you waited too long to refresh. Type /refresh if you still need to refresh your browser (if you don't, and step down, you'll lose your spot).", user.userid, function(result) {
								if(!result.success)
									options.cmbot.bot.speak(user.name + ", you waited too long to refresh. Type /refresh if you still need to refresh your browser (if you don't, and step down, you'll lose your spot).");
							});
					}, 3*60*1000);
				} else {
					text = "You're not dj'ing" + (options.pm ? "!" : ", " + user.name + "!");
				}
				if(options.pm)
					options.cmbot.bot.pm(text, options.userid);
				else
					options.cmbot.bot.speak(text);
			} catch(e) {
				log("Exception refreshing: ", e);
			}
		},
		modonly: false,
		pmonly: false,
		help: 'If you need to refresh your browser (like if the music isn\'t playing), type /refresh and I\'ll save your place. Otherwise, if you tried to step up and someone else is in the queue, I\'ll escort you down.'
	},
	'escortme': {
		command: function(options) {
			var user = options.cmbot.users[options.userid];
			var text = '';
			if (user.djing) {
				if (!user.escortme) {
					user.escortme = true;
					text = user.name + ", I'll take you down after your next track.";
				}
				else {
					user.escortme = false;
					text = user.name + ", I won't take you down after your next track.";
				}
			} else {
				text = "You're not dj'ing right now, " + user.name + "! Silly human.";
			}
			if(options.pm)
				options.cmbot.bot.pm(text, options.userid);
			else
				options.cmbot.bot.speak(text);
		},
		modonly: false,
		pmonly: false,
		help: 'Use this if you are going to be AFK and want me to take you off the decks after your next song.'
	},
	'votes': {
		command: function(options) {
			var upvotes = [];
			var downvotes = [];
			$.each(options.cmbot.session.votes.up, function(index, userid) {
				var user = options.cmbot.users[userid];
				var name = user != undefined ? user.name : "(Unknown)";
				upvotes.push(name);
			});
			$.each(options.cmbot.session.votes.down, function(index, userid) {
				var user = options.cmbot.users[userid];
				var name = user != undefined ? user.name : "(Unknown)";
				downvotes.push(name);
			});
			var text = (upvotes.length > 0 ? "Awesomes: " + upvotes.join(', ') + (downvotes.length > 0 ? "; " : "") : "") + (downvotes.length > 0 ? "Lames: " + downvotes.join(', ') : "");
			if(text == '')
				text = "No votes for this song yet.";
			options.cmbot.bot.pm(text, options.userid);
			log("Votes: ", options.cmbot.session.votes);
		},
		modonly: true,
		pmonly: true,
		help: '',
		hide: true
	},
	'back': {
		command: function(options) {
			if(options.arg != '') {
				if(!options.cmbot.users[options.userid].mod) {
					if(options.pm)
						options.cmbot.bot.pm("I'm sorry, Dave. I'm afraid I can't do that.", options.userid);
					else
						options.cmbot.bot.speak("I'm sorry, Dave. I'm afraid I can't do that.");
				} else {
					var user = options.cmbot.getUserByName(options.arg);
					if(user === false) {
						if(options.pm)
							options.cmbot.bot.pm("User " + options.arg + " not found.", options.userid);
						else
							options.cmbot.bot.speak("User " + options.arg + " not found.");
					} else {
						user.afk = false;
						var text = user.name + " is back.";
						if(options.pm)
							options.cmbot.bot.pm(text, options.userid);
						else
							options.cmbot.bot.speak(text);
					}
				}
			} else {
				options.cmbot.users[options.userid].afk = false;
				if(options.pm)
					options.cmbot.bot.pm("You are back.", options.userid);
				else
					options.cmbot.bot.speak(options.cmbot.users[options.userid].name + " is back.");
			}
		},
		modonly: false,
		pmonly: false,
		help: ''
	},
	'afk': {
		command: function(options) {
			if(options.arg != '') {
				if(!options.cmbot.users[options.userid].mod) {
					if(options.pm)
						options.cmbot.bot.pm("I'm sorry, Dave. I'm afraid I can't do that.", options.userid);
					else
						options.cmbot.bot.speak("I'm sorry, Dave. I'm afraid I can't do that.");
				} else {
					var user = options.cmbot.getUserByName(options.arg);
					if(user === false) {
						if(options.pm)
							options.cmbot.bot.pm("User " + options.arg + " not found.", options.userid);
						else
							options.cmbot.bot.speak("User " + options.arg + " not found.");
					} else {
						user.afk = true;
						clearTimeout(user.timers.queueTimer);
						var text = user.name + " is away.";
						if(options.pm)
							options.cmbot.bot.pm(text, options.userid);
						else
							options.cmbot.bot.speak(text);
						options.cmbot.checkQueue();
					}
				}
			} else {
				options.cmbot.users[options.userid].afk = true;
				clearTimeout(options.cmbot.users[options.userid].timers.queueTimer);
				if(options.pm)
					options.cmbot.bot.pm("You are away.", options.userid);
				else
					options.cmbot.bot.speak(options.cmbot.users[options.userid].name + " is away.");
				options.cmbot.checkQueue();
				
			}
		},
		modonly: false,
		pmonly: false,
		help: 'Mark yourself as afk. When someone steps off the decks, I will alert the first non-afk DJ in the queue that it\'s their turn. Mods can pass a user\'s name to mark that person away.'
	},
	'shows': {
		command: function(options) {
//			if(options.pm)
//				return false;
			try {
				var artist = options.arg || options.cmbot.currentSong.room.metadata.current_song.metadata.artist;
				var httpoptions = {
					url: 'http://api.songkick.com/api/3.0/search/artists.json?query=' + encodeURIComponent(artist) + '&apikey=' + options.cmbot.options.songkick.api_key
				};
				myhttp.get(httpoptions, function(error, getresult) {
					var artist_result = JSON.parse(getresult.buffer);
					log("artist result: " + artist_result);
					if(artist_result.resultsPage.totalEntries == 0) {
						//bot.speak("Artist not found.");
						log("Artist not found.");
					} else {
						var artist_id = artist_result.resultsPage.results.artist[0].id;
						myhttp.get({url: 'http://api.songkick.com/api/3.0/artists/' + artist_id + '/calendar.json?apikey=' + options.cmbot.options.songkick.api_key}, function(error, calendarresult) {
							var result = JSON.parse(calendarresult.buffer);
							if(result.resultsPage.totalEntries == 0) {
								log("No shows found for " + artist_result.resultsPage.results.artist[0].displayName);
								options.cmbot.bot.speak("No shows found for " + artist_result.resultsPage.results.artist[0].displayName + '.');
							} else {
								var shows = [];
								$.each(result.resultsPage.results.event, function(index, event) {
									if(index <= 6)
										shows.push(event.venue.metroArea.displayName + ' ' + dateFormat(new Date(event.start.date), 'm/d'));
								});
								log("shows: ", shows);
								options.cmbot.shortenUrl(artist_result.resultsPage.results.artist[0].uri, function(res) {
									if(res.success) {
										log("Shows for " + artist_result.resultsPage.results.artist[0].displayName + ': ' + shows.join(', ') + ' ' + res.url);
										options.cmbot.bot.speak("Shows for " + artist_result.resultsPage.results.artist[0].displayName + ': ' + shows.join(', ') + ' ' + res.url);
									}
								});
							}
						});
					}
				});
			} catch(e) {
				log("Exception getting shows: ", e);
			}
		},
		modonly: false,
		pmonly: false,
		help: 'Look up (on songkick.com) upcoming shows by a particular artist. I\'ll only show up to 7 shows. Usage: /shows bonobo'
	},
	'bannedartists': {
		command: function(options) {
			var a = [];
			$.each(options.cmbot.settings.bannedArtists, function(artist, one) {
				a.push(artist);
			});
			var text;
			if(a.length == 0)
				text = "There are no banned artists";
			else
				text = "Banned Artists (" + a.length + "): " + a.join(', ');
			if(options.pm)
				options.cmbot.bot.pm(text, options.userid);
			else
				options.cmbot.bot.speak(text);
		},
		modonly: false,
		pmonly: false,
		hide: true
	},
	'djafk': {
		command: function(options) {
			var counts = [];
			$(options.cmbot.session.djs).each(function(index, userid) {
				try {
					var user = options.cmbot.users[userid];
					var diff = Math.floor(((new Date().getTime() - user.lastInteraction) / 1000) / 60);
					log("diff for " + user.name + " = " + diff);
					if(diff > 0)
						counts.push(user.name + ": " + diff + ' mins.');
				} catch(e) {
				}
			});
			var text;
			if(counts.length > 0)
				text = "AFK Djs: " + counts.join(', ');
			else
				text = "No DJ's are AFK.";
			if(options.pm)
				options.cmbot.bot.pm(text, options.userid);
			else
				options.cmbot.bot.speak(text);

		},
		modonly: false,
		pmonly: false,
		help: 'Show how long each DJ has been afk. Saying something in the room or voting will reset your AFK timer. If your AFK time is less than one minute, I won\'t display your name here.'
	},
	'triggerlimit': {
		command: function(options) {
			if(options.arg.match(/^(.*) ([0-9]+)$/)) {
				var trigger = RegExp.$1;
				var timeLimit = RegExp.$2;
				if (options.cmbot.settings.triggers[trigger] == undefined) {
					options.cmbot.bot.pm("That trigger doesn't exist.", options.userid);
				} else {
					if (timeLimit == 0) {
						delete options.cmbot.settings.triggerLimit[trigger];
						options.cmbot.bot.pm("Trigger limit for /" + trigger + " removed.", options.userid);
					} else {
						options.cmbot.settings.triggerLimit[trigger] = timeLimit;
						options.cmbot.bot.pm("Time limit between usages of /" + trigger + " set to " + timeLimit + " seconds.", options.userid);
					}
					options.cmbot.saveSettings();
				}
			} else {
				options.cmbot.bot.pm("Usage: /triggerlimit <trigger> <# of seconds>", options.userid);
			}
		},
		modonly: true,
		pmonly: true,
		help: 'Set the amount of time (in seconds) that I will ignore a particular trigger once it has been said. Use a value of 0 to remove the time limit for the trigger.'
	},
	'triggerban': {
		command: function(options) {
			if(options.arg == '') {
				options.cmbot.bot.pm("Usage: /triggerban <username>", options.userid);
				return false;
			}
			var user = options.cmbot.getUserByName(options.arg);
			var text;
			if(user == false) {
				text = arg + " not found.";
			} else if(options.cmbot.settings.triggerBan[user.userid] != undefined) {
				log("ban exists");
				var banExpireDate = new Date(options.cmbot.settings.triggerBan[user.userid]);
				text = "Trigger ban for " + user.name + " expires " + banExpireDate.toDateString() + " " + banExpireDate.toTimeString();
			} else {
				options.cmbot.settings.triggerBan[user.userid] = options.now() + (60*60*24*1000); // this is when this ban expires
				text = user.name + " is banned from using triggers for the next 24 hours.";
			}
			options.cmbot.bot.pm(text, options.userid);
			log("triggerbans: ", options.cmbot.settings.triggerBan);
			options.cmbot.saveSettings();

		},
		modonly: true,
		pmonly: true,
		help: 'Ban a user from using triggers for 24 hours.'
	},
	'kick': {
		command: function(options) {
			if(options.arg == '') {
				if(options.pm)
					options.cmbot.bot.pm("Please specify a user to kick!", options.userid);
				else
					options.cmbot.bot.speak("Please specify a user to kick!");
			} else {
				var user = options.cmbot.getUserByName(arg);
				if(user === false) {
					if(options.pm)
						options.cmbot.bot.pm("User not found.", options.userid);
					else
						options.cmbot.bot.speak("User not found.");
				} else if(user.userid != options.cmbot.options.bot.userid)
					options.cmbot.bot.bootUser(user.userid, arg != '' ? arg : '');
			}
		},
		modonly: true,
		pmonly: false,
		help: 'Kick a user from the room. Usage: /kick [reason]'
	},
	'uptime': {
		command: function(options) {
			var uptime = options.cmbot.getUptime();
			if(options.pm)
				options.cmbot.bot.pm(uptime, options.userid);
			else
				options.cmbot.bot.speak(uptime);
		},
		modonly: false,
		pmonly: false,
		help: ''
	},
	'skip': {
		command: function(options) {
			if(options.cmbot.users[options.cmbot.options.bot.userid].djing)
				options.cmbot.bot.stopSong();
			else
				options.cmbot.bot.speak("Please skip this track.");
		},
		modonly: true,
		pmonly: true,
		help: ''
	},
	'autodj': {
		command: function(options) {
			var text = '';
			if(options.arg == '')
				text = "AutoDJ is " + (options.cmbot.session.autodj ? 'on' : 'off');
			else if(options.arg == 'on') {
				if(options.cmbot.session.autodj)
					text = 'AutoDJ is already on.';
				else {
					options.cmbot.session.autodj = true;
					text = 'AutoDJ is now on.';
					options.cmbot.autodj();
					log(options.cmbot.users[options.userid].name + " just turned autodj on.");
				}
			} else if(options.arg == 'off') {
				if(!options.cmbot.session.autodj)
					text = 'AutoDJ is already off.';
				else {
					options.cmbot.session.autodj = false;
					clearTimeout(options.cmbot.session.timers.autodj);
					options.cmbot.session.timers.autodj = false;
					text = 'AutoDJ is now off.';
					log(options.cmbot.users[options.userid].name + " just turned autodj off.");
				}
			} else {
				text = "Usage: /autodj [on|off]";
			}
			options.cmbot.bot.pm(text, options.userid);
		},
		modonly: true,
		pmonly: true,
		help: 'Set autodj on or off. Usage: /autodj [on|off]'
	},
	'stfu': {
		command: function(options) {
			if(options.cmbot.options.messages.length == 0) {
				if(options.pm)
					options.cmbot.bot.pm("I don't have any messages to say!", options.userid);
				else
					options.cmbot.bot.speak("I don't have any messages to say!", options.userid);
			}
			if(!options.cmbot.session.stfu) {
				options.cmbot.session.stfu = true;
				var interval = options.cmbot.options.messages.length * options.cmbot.options.messages.message_interval;
				setTimeout(function() {
					options.cmbot.session.stfu = false;
				}, interval*60*1000);
				var text = 'It\'s true, I do talk too much, sorry about that.';
				if(options.pm)
					options.cmbot.bot.pm(text, options.userid);
				else
					options.cmbot.bot.speak(text);
			}
		},
		modonly: true,
		pmonly: false,
		help: 'Prevent the bot from saying informational messages for 30 minutes.'
	},
	'tweet': {
		command: function(options) {
			if(options.cmbot.twit !== false) {
				options.cmbot.twit.updateStatus(options.cmbot.users[options.userid].name + ': ' + options.arg,
					function (err, data) {
					options.cmbot.bot.pm("Tweeted, you twit.", options.userid);
					}
				);
			} else {
				options.cmbot.options.pm("Twitter access not properly set up, sorry.", options.userid);
			}
		},
		modonly: true,
		pmonly: true,
		hide: true
	},
	'profile': {
		command: function(options) {
			var pr = options.arg.split(' ', 1);
			var ar = options.arg.substring(options.arg.indexOf(' ')).trim();
			var props = [pr, ar];
			var profile = {website: ''};
			props[1] = props[1].replace("\\n", "\n");
			profile[props[0]] = props[1];
			log("profile: ", profile);
			options.cmbot.bot.modifyProfile(profile, function(result) {
				var text;
				if(result.success)
					text = "Profile updated.";
				else
					text = result.error;
				options.cmbot.bot.pm(text, options.userid);
			});
		},
		modonly: true,
		pmonly: true,
		hide: true,
		acl: true
	},
	'help': {
		command: function(options) {
			var text;
			if(options.arg != '') {
				var theCommand = false;
				if(typeof options.cmbot.commands[options.arg] == 'object')
					theCommand = options.cmbot.commands[options.arg];
				else if(typeof options.cmbot.customCommands[options.arg] == 'object')
					theCommand = options.cmbot.customCommands[options.arg];
				if(theCommand === false) {
					text = "Sorry, I don't know that command.";
				} else if(theCommand.help == '') {
					text = "Sorry, I don't have any info on that command.";
				} else {
					text = options.arg + ": " + theCommand.help + (theCommand.pmonly ? " (PM Only)" : "") + (theCommand.modonly ? " (Mod Only)" : "");
				}
			} else {
				var commands = [];
				$.each($.extend({}, options.cmbot.commands, options.cmbot.customCommands), function(commandName, command) {
					var addCommand = false;
					if(!command.modonly)
						addCommand = true;
					if(command.modonly && options.cmbot.users[options.userid].mod && options.pm)
						addCommand = true;
					if(options.cmbot.settings.acl[commandName] != undefined) {
						if(!options.cmbot.settings.acl[commandName][options.userid])
							addCommand = false;
					}
					if(options.cmbot.options.master_userid.indexOf(options.userid) > -1 && options.pm)
						addCommand = true;
					if(commandName == "shows" && options.cmbot.options.songkick.api_key == '')
						addCommand = false;
					else if(commandName == "tags" && !options.cmbot.options.lastfm.enabled)
						addCommand = false;
					else if(commandName == "plays" && !options.cmbot.options.lastfm.enabled && !options.cmbot.options.mysql.enabled && !options.cmbot.options.sqlite.enabled)
						addCommand = false;
					if(command.hide !== true && addCommand)
						commands.push('/' + commandName);
				});
				commands.sort();
				text = "Commands: " + commands.join(', ') + ". You can also get command specific help by typing '/help command' (ie, /help queue).";
			}
			if(options.pm)
				options.cmbot.bot.pm(text, options.userid);
			else
				options.cmbot.bot.speak(text);
			
		},
		modonly: false,
		pmonly: false,
		hide: true
	},
};

cmbot.prototype.activateIdleDJCheck = function(user) {
	var cmbot = this;
	if(!cmbot.session.enforcement)
		return false;
	clearTimeout(user.timers.idleDJCheck);
	user.timers.idleDJCheck = setTimeout(function() {
		// First, make sure this user is dj'ing
		if (user.djing) {
			if (cmbot.currentSong.room.metadata.current_dj == user.userid) {
				log("user hit idle limit but is dj'ing.");
				user.idleDJEscort = true;
			}
			else {
				cmbot.bot.pm('@' + user.name + ', you have one minute to chat or vote before being taken down from the decks. (' + cmbot.settings.idleDJTimeout + ' minute idle limit)', user.userid);
				user.timers.idleDJRemove = setTimeout(function(){
//					log("Removing idle dj " + user.name + " who has been idle for " + diff + " minutes.");
					if(cmbot.session.current_dj != user.userid)
						cmbot.bot.remDj(user.userid);
					else {
						user.idleDJEscort = true;
					}
				}, 60 * 1000);
			}
//			log('@' + user.name + ', you have one minute to chat or vote before being taken down from the decks.');
		}
		else {
			clearTimeout(user.timers.idleDJCheck);
			user.timers.idleDJCheck = false;
		}
	}, cmbot.settings.idleDJTimeout*60*1000);
};

cmbot.prototype.activateCasinoRollTimer = function(redo) {
	redo = redo || false;
	var cmbot = this;
	cmbot.bot.speak((redo ? "No winners, let's try again!" : "A spot is open!") + " Type /roll to try your luck for the next spot! The lowest number wins. You have 20 seconds!");
	cmbot.session.casino_data.rollActive = true;
	cmbot.session.timers.casinoWinnerAnnounce = setTimeout(function() {
		//cmbot.session.casino_data.rolls[userid] = randomnumber;
		var num_spots = cmbot.session.max_djs - cmbot.session.djs.length;
		log("Number of open spots: " + num_spots);
		var lows = [];
//		log("Before sort, rolls: ", cmbot.session.casino_data.rolls);
		var rolls = [];
		for (var userid in cmbot.session.casino_data.rolls) rolls.push([userid, cmbot.session.casino_data.rolls[userid]]);
//		log("Rolls: ", rolls);
		rolls.sort(function(a, b) {
			 a = a[1];
			 b = b[1];
			 log("Comparing " + a + " to " + b);
			 return a < b ? -1 : (a > b ? 1 : 0);
		});
//		log("Rolls: ", rolls);
		var winners = [];
		var winnernames = [];
		var winnerroles = [];
		cmbot.session.casino_data.activeRolls = [];
		for(var i=0;i<rolls.length;i++) {
			var userid = rolls[i][0];
			var roll = rolls[i][1];
			var user = cmbot.users[userid];
			if(user == undefined)
				continue;
			log("Userid  " + userid);
			log("Roll for " + cmbot.users[userid].name + " = " + roll);
			if(i < num_spots) {
				winners.push(userid);
				winnernames.push(cmbot.users[userid].name);
				winnerroles.push(roll);
				user.timers.casinoWinner = setTimeout(function() {
					user.timers.casinoWinner = false;
					cmbot.bot.pm("Sorry, you missed your 3 minute window to step up.", user.userid);
					cmbot.casinoAnnounceNextWinner();
				}, 1000*60*3);
			} else
				cmbot.session.casino_data.activeRolls.push(rolls[i]);
		}
		cmbot.session.casino_data.rolls = [];
		if(winners.length > 0) {
			cmbot.bot.speak(":loudspeaker:And we have " + (winners.length == 1 ? "a winner" : winners.length + " winners") + "!! Please congratulate " + winnernames.join(", ") + " who rolled " + winnerroles.join(", ") + ".");
			cmbot.session.casino_data.winners = winners;
			cmbot.session.casino_data.rollActive = false;
		} else {
			// Nobody did /roll?
			cmbot.activateCasinoRollTimer(true);
		}
		
	}, 20*1000);
};

cmbot.prototype.casinoAnnounceNextWinner = function() {
	var cmbot = this;
	if(cmbot.session.casino_data.rollActive) {
		// There's still an active roll, so choose the next roll and alert them that they are up
		if(cmbot.session.casino_data.activeRolls.length > 0) {
			var winner = cmbot.session.casino_data.activeRolls[0];
			log("Winner: ", winner);
			cmbot.bot.speak(":loudspeaker:And we have a winner!! Please congratulate " + cmbot.users[winner[0]].name + " who rolled " + winner[1] + ".");
			cmbot.session.casino_data.winners.push(winner[0]);
		}// else
//			cmbot.activateCasinoRollTimer();
	} else {
		// No active roll, so do the timer again
		cmbot.activateCasinoRollTimer();
	}
};

Date.prototype.stdTimezoneOffset = function() {
	var jan = new Date(this.getFullYear(), 0, 1);
	var jul = new Date(this.getFullYear(), 6, 1);
	return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
};

function log() {
	var string = arguments[0];
	var date = new Date();
	var month = date.getMonth() + 1;
	if(month < 10)
		month = "0" + month;
	var minutes = date.getMinutes();
	if(minutes < 10)
		minutes = "0" + minutes;
	var seconds = date.getSeconds();
	if(seconds < 10)
		seconds = "0" + seconds;
	var day = date.getDate();
	if(day < 10)
		day = "0" + day;
	string = "[" + date.getFullYear() + "-" + month + "-" + day + " " + 
		date.getHours() + ":" + minutes + ":" + seconds + "] " + string;
	if(arguments[1] != undefined) {
		console.log(string, arguments[1]);
	} else {
		console.log(string);
	}
}

//Return all pattern matches with captured groups
RegExp.prototype.execAll = function(string) {
 var match = null;
 var matches = new Array();
 while (match = this.exec(string)) {
     var matchArray = [];
     for (i in match) {
         if (parseInt(i) == i) {
             matchArray.push(match[i]);
         }
     }
     matches.push(matchArray);
 }
 return matches;
};

String.prototype.trim = function() {
	return this.replace(/^\s+|\s+$/g, "");
};

module.exports = cmbot;

