/*
 * Module: greeting
 * Greets a user with a customizable message each time they enter the room. However, the bot will not greet the user if they join the room again within an hour.
 * Use the /greeting command to turn it on or off.
 * Use the /setgreeting command to set the greeting that will displayed. When setting the greeting, you can use %username% for the bot to use the name of the user who joined. This must
 * be set in order for it to start working, though.
 */

var customEvents = [{
	on: 'registered',
	setup: function(cmbot) {
		if(cmbot.settings.greeting == undefined)
			cmbot.settings.greeting = true;
		if(cmbot.settings.greeting_last == undefined)
			cmbot.settings.greeting_last = {};
		
		cmbot.saveSettings();
	},
	event: function(cmbot, data) {
		// If the greeting text has been set, and the greeting is turned on, and it's not the bot that is joining
		if(cmbot.settings.greeting_text != undefined && cmbot.settings.greeting_text != "" && cmbot.settings.greeting && data.user.userid != cmbot.options.bot.userid) {
			var greet = true;
			if((new Date().getTime() - cmbot.settings.greeting_last[data.user[0].userid]) <= 1000*60*60) // If the user has gotten the greeting within the last hour, don't do the greeting 
				greet = false;
			if(greet) {
				cmbot.bot.speak(cmbot.settings.greeting_text.replace("%username%", data.user[0].name));
				cmbot.settings.greeting_last[data.user[0].userid] = new Date().getTime();
				cmbot.saveSettings();
			}
		}
	}
}
];

var customCommands = [{
    name: 'greeting',
	command: function(options) {
		var text = "";
		if(options.arg == "")
			text = "Greeting is " + (options.cmbot.settings.greeting ? "on" : "off") + ".";
		else if(options.arg == "on") {
			if(options.cmbot.settings.greeting)
				text = "Greeting is already on.";
			else {
				options.cmbot.settings.greeting = true;
				options.cmbot.saveSettings();
				text = "Greeting is now on.";
			}
		} else if(options.arg == "off") {
			if(!options.cmbot.settings.greeting)
				text = "Greeting is already off.";
			else {
				options.cmbot.settings.greeting = false;
				options.cmbot.saveSettings();
				text = "Greeting is now off.";
			}
		} else {
			text = "Usage: /greeting [on|off]";
		}
		options.cmbot.bot.pm(text, options.userid);
	},
	modonly: true,
	pmonly: true,
	help: "Turn the greeting (the bot will welcome a user to the room when they join) on or off."
},
{
	name: 'setgreeting',
	command: function(options) {
		var text = "";
		if(options.arg == "")
			text = "Greeting is " + (options.cmbot.settings.greeting_text == undefined ? "not yet set" : options.cmbot.settings.greeting_text) + ".";
		else {
			options.cmbot.settings.greeting_text = options.arg;
			text = "Greeting updated.";
			options.cmbot.saveSettings();
		}
		options.cmbot.bot.pm(text, options.userid);
	},
	modonly: true,
	pmonly: true,
	help: "Set the greeting that is displayed when a user enters the room. Use %username% to have the user's name substituted."
}];

exports.customCommands = customCommands;
exports.customEvents = customEvents;
