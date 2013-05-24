/*
 * Module: songstats
 * Keeps a count of the number of times a song is added to a users playlist, and at the end of the song speaks in chat the number of awesomes, lames, and snags the song got.
 * Use /songstats [on|off] to turn it on or off.
 */

var customEvents = [{
	on: 'endsong',
	event: function(cmbot, data) {
		if(cmbot.session.snags == undefined)
			cmbot.session.snags = 0;
		if(cmbot.settings.songstats == undefined)
			cmbot.settings.songstats = true;
		if(cmbot.session.lastsongstats == undefined)
			cmbot.session.lastsongstats = {};
		
		if(cmbot.settings.songstats) {
			var song = data.room.metadata.current_song;
//			cmbot.bot.speak("Stats for " + song.metadata.song + " by " + song.metadata.artist + ": :arrow_down:" + data.room.metadata.downvotes + " :arrow_up:" + data.room.metadata.upvotes + " :heart:" + cmbot.session.snags);
			cmbot.session.lastsongstats = {
				upvotes: data.room.metadata.upvotes,
				downvotes: data.room.metadata.downvotes,
				snags: cmbot.session.snags
			};
		}
		cmbot.session.snags = 0;
	}
},
{
	on: 'newsong',
	event: function(cmbot, data) {
		artist = cmbot.currentSong.room.metadata.current_song.metadata.artist;
		track = cmbot.currentSong.room.metadata.current_song.metadata.song;
		if(cmbot.settings.songstats) {
			 cmbot.lastfm.getPlays({
				artist: artist,
				track: track,
				callback: function(result) {
	console.log("result: ", result);
					var plays = result.plays;
					var mysql = cmbot.getMysqlClient();
                mysql.query("SELECT s.artist, s.track, sl.starttime " +
                                "from song s " +
                                "join songlog sl on sl.songid = s.id " +
                                "where lower(artist) = '" + mysql_real_escape_string(artist.toLowerCase()) + "' " +
                                (track !== false ? "and lower(track) = '" + mysql_real_escape_string(track.toLowerCase()) + "' " : "") +
                                "order by sl.starttime desc " +
                                "limit 1;",
                                function selectCb(err, results, fields) {
                                        console.log("results: ", results);
					var time = [];
                                        if(results.length == 0) {
                                        } else {
                                                var now = new Date();
                                                var diff = now.getTime() - new Date(results[0].starttime).getTime();
                                                var x = diff / 1000;
                                                var seconds = Math.floor(((x % 86400) % 3600) % 60);
                                                var minutes = Math.floor(((x % 86400) % 3600) / 60);
                                                var hours = Math.floor((x % 86400) / 3600);
                                                var days = Math.floor(x / 86400);
                                                if(days > 1)
                                                        time.push(days + ' days');
                                                else {
                                                        if(days == 1)
                                                                time.push(days + ' day');
                                                        if(hours > 0)
                                                                time.push((hours + " hour") + (hours == 1 ? "" : "s"));
                                                        else if(minutes > 0)
                                                                time.push(minutes + ' minutes');
                                                        else
                                                                time.push(seconds + ' seconds');
                                                }
					}
					var str = "Last Song: :thumbsup: " + cmbot.session.lastsongstats.upvotes + " :thumbsdown: " + cmbot.session.lastsongstats.downvotes + " :heart: " + cmbot.session.lastsongstats.snags;
					var str2 = "This Song: :repeat: " + result.plays + " plays";
					if(time.length > 0)
						str2 += " :arrow_forward: " + time.join(', ') + " ago";
					console.log(str);
					console.log(str2);
					cmbot.bot.speak(str, function() {
						cmbot.bot.speak(str2);
					});
				}
			);
				}
			});
		}
	}
},
{
	on: 'snagged',
	event: function(cmbot, data) {
		if(cmbot.session.snags == undefined)
			cmbot.session.snags = 0;
		cmbot.session.snags++;
	}
}
];

var customCommands = [{
	name: 'songstats',
	command: function(options) {
		if(options.cmbot.settings.songstats == undefined)
			options.cmbot.settings.songstats = true;
		var text = "";
		if(options.arg == "")
			text = "Song stats are " + (options.cmbot.settings.songstats ? "on" : "off") + ".";
		else if(options.arg == "on") {
			if(options.cmbot.settings.songstats)
				text = "Song stats are already on.";
			else {
				options.cmbot.settings.songstats = true;
				options.cmbot.saveSettings();
				text = "Song stats are now on.";
			}
		} else if(options.arg == "off") {
			if(!options.cmbot.settings.songstats)
				text = "Song stats are already off.";
			else {
				options.cmbot.settings.songstats = false;
				options.cmbot.saveSettings();
				text = "Song stats are now off.";
			}
		} else {
			text = "Usage: /songstats [on|off]";
		}
		options.cmbot.bot.pm(text, options.userid);
	},
	modonly: true,
	pmonly: true,
	help: "Turn song stats (the bot will tell the number of awesomes, lames, and snags at the end of each song) on or off."
},
{
    name: 'songinfo',
    command: function(options) {
    	var song = options.cmbot.currentSong.room.metadata.current_song;
    	options.cmbot.speakOrPM("Stats for " + song.metadata.song + " by " + song.metadata.artist + ": :arrow_down:" + options.cmbot.session.votes.down.length + " :arrow_up:" + options.cmbot.session.votes.up.length + " :heart:" + (options.cmbot.session.snags ? options.cmbot.session.snags : '0'), options.pm, options.userid);
    },
    modonly: false,
    pmonly: false,
    help: 'Get song stats for the currently playing song.'	
}];

exports.customCommands = customCommands;
exports.customEvents = customEvents;


function mysql_real_escape_string (str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\"+char; // prepends a backslash to backslash, percent,
                                  // and double/single quotes
        }
    });
}
