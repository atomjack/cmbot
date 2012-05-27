var customCommands = {
    name: 'google',
	command: function(options) {
		if(!options.pm) {
			if(options.arg != '') {
				if(options.arg == 'lemonparty')
					options.cmbot.bot.speak("Go fuck yourself, " + options.cmbot.users[options.userid].name + "!!!");
				else
					options.cmbot.shortenUrl("http://www.google.com/search?hl=en&q= " + options.arg + "&btnI=I", function(result) {
						options.cmbot.bot.speak(result.url);
					});
			}
		}
	},
	modonly: false,
	pmonly: false,
	help: 'Get the link to the first result of a google search.'
};

exports.customCommands = customCommands;
