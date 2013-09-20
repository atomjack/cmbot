var showtriggers = {
    name: 'showtriggers', // This is what the bot will respond to (ie, /beer)
    command: function(options) {
		if(options.arg == '') {
		var triggers_list = '';
			for(var trigger in options.cmbot.settings.triggers) {
				triggers_list += options.cmbot.settings.triggers[0] +", ";
				//console.log("Trigger is: " + trigger_list );
			}
		triggers_list += "Total triggers: " + options.cmbot.settings.triggers.length;
		options.cmbot.bot.pm(triggers_list, options.userid);
		}
		// else looking for specific trigger here FIXME
	},
    modonly: false,
    pmonly: true,
    hide: false,
    help: 'Shows current triggers - e.g. /showtriggers',
    acl: false
};

exports.customCommands = showtriggers;
