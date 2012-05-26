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
		
		if(cmbot.settings.songstats) {
			var song = data.room.metadata.current_song;
			cmbot.bot.speak("Stats for " + song.metadata.song + " by " + song.metadata.artist + ": " + data.room.metadata.upvotes + " up, " + data.room.metadata.downvotes + " down, " + cmbot.session.snags + " snags.");
		}
		cmbot.session.snags = 0;
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
}];

exports.customCommands = customCommands;
exports.customEvents = customEvents;
