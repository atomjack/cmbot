var bannedSongs = {
	name: 'bannedsongs', // This is what the bot will respond to (ie, /beer)
	command: function(options) {
		var a = [];
		for(var shitty in options.cmbot.settings.bannedSongs) {
			if(options.cmbot.settings.bannedSongs.hasOwnProperty(shitty)) {
				a.push(shitty + " - " + options.cmbot.settings.bannedSongs[shitty]);
			}
		};
		var text;
		if(a.length == 0)
			text = "There are no banned artists";
		else
			text = "Banned Songs (" + a.length + "): " + a.join(', ');
		if(options.pm)
			options.cmbot.bot.pm(text, options.userid);
		else
			options.cmbot.bot.speak(text);
	},
	modonly: false,
	 pmonly: false,
	 hide: true,
	 help: 'It shows banned songs...',
	 acl: false
};

exports.customCommands = bannedSongs;
