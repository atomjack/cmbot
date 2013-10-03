var showtriggers = {
    name: 'showtriggers', // This is what the bot will respond to (ie, /beer)
    command: function(options) {
		if(options.arg == '') {
		var triggers_list = '';
		var count = 0;
		var trigs = [];
			for(var trigger in options.cmbot.settings.triggers) {
//				triggers_list += trigger +", ";
				trigs.push(trigger)
				count++;
			}
		//sort the trigger alphabetically! props to @dRaves for the help
		trigs.sort();
		for (var i = 0; i < trigs.length; i++) {
			triggers_list += trigs[i] + ', ';
		}
		triggers_list += "Total triggers: " + count;
		options.cmbot.bot.pm(triggers_list, options.userid);
		}
		// else looking for specific trigger here FIXME
	},
    modonly: true,
    pmonly: true,
    hide: false,
    help: 'Shows current triggers - e.g. /showtriggers',
    acl: false
};

exports.customCommands = showtriggers;
