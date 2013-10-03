/*
 * Module: newdj
 * Greets each new dj with a customizable message each time they enter the room. However, the bot will not greet the user if they join the room again within the last day.
 * Use the /newdjgreeting command to turn it on or off.
 * Use the /setnewdjgreeting command to set the greeting that will displayed. When setting the greeting, you can use %username% for the bot to use the name of the user who joined. This must
 * be set in order for it to start working, though.
 */

var customEvents = [{
	on: 'add_dj',
	event: function(cmbot, data) {
		if(cmbot.settings.add_dj == undefined)
			cmbot.settings.add_dj = true;
		if(cmbot.settings.add_dj_last == undefined)
			cmbot.settings.add_dj_last = {};
		// If the greeting text has been set, and the greeting is turned on, and it's not the bot that is joining
		if(cmbot.settings.add_dj_text != undefined && cmbot.settings.add_dj_text != "" && cmbot.settings.add_dj && data.user.userid != cmbot.options.bot.userid) {
			var greet = true;
			if((new Date().getTime() - cmbot.settings.add_dj_last[data.user[0].userid]) <= 1000*60*60*24) // If the user has gotten the greeting within the last day, don't do the greeting 
				greet = false;
			if(greet) {
				cmbot.bot.speak(cmbot.settings.add_dj_text.replace("%username%", data.user[0].name));
				cmbot.bot.pm(cmbot.settings.add_dj_text.replace("%username%", data.user[0].name));
				cmbot.settings.add_dj_last[data.user[0].userid] = new Date().getTime();
				cmbot.saveSettings();
			}
		}
	}
}
];

var customCommands = [{
    name: 'newdjgreeting',
	command: function(options) {
		if(options.cmbot.settings.add_dj == undefined)
			options.cmbot.settings.add_dj = true;
		var text = "";
		if(options.arg == "")
			text = "New dj greeting is " + (options.cmbot.settings.add_dj ? "on" : "off") + ".";
		else if(options.arg == "on") {
			if(options.cmbot.settings.add_dj)
				text = "New dj greeting is already on you silly monkey!";
			else {
				options.cmbot.settings.add_dj = true;
				options.cmbot.saveSettings();
				text = "New dj greeting is now on.";
			}
		} else if(options.arg == "off") {
			if(!options.cmbot.settings.add_dj)
				text = "New dj greeting is already off you goof!";
			else {
				options.cmbot.settings.add_dj = false;
				options.cmbot.saveSettings();
				text = "New dj greeting is now off.";
			}
		} else {
			text = "Usage: /newdjgreeting [on|off]";
		}
		options.cmbot.bot.pm(text, options.userid);
	},
	modonly: true,
	pmonly: true,
	help: "Turn the greeting (the bot will welcome a new dj to the decks when they join) on or off."
},
{
	name: 'setnewdjgreeting',
	command: function(options) {
		var text = "";
		if(options.arg == "")
			text = "New dj greeting is " + (options.cmbot.settings.add_dj_text == undefined ? "not yet set" : options.cmbot.settings.add_dj_text) + ".";
		else {
			options.cmbot.settings.add_dj_text = options.arg;
			text = "New dj greeting updated.";
			options.cmbot.saveSettings();
		}
		options.cmbot.bot.pm(text, options.userid);
	},
	modonly: true,
	pmonly: true,
	help: "Set the new dj greeting that is displayed when a new dj steps up to the decks. Use %username% to have the user's name substituted."
}];

exports.customCommands = customCommands;
exports.customEvents = customEvents;
