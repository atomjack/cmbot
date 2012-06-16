#CMBot

A full featured bot for turntable.fm

## Installation
	npm install cmbot

## Features
* If desired, your bot will enforce a queue, as well as a configurable number of songs each DJ is allowed to play before the bot escorts them down, to give others a chance to DJ.
* If a user on the queue leaves the room, the bot automatically marks them afk, skipping them when announcing who is next in the queue, and automatically marking them unafk when they return. If they don't return within 5 minutes, however, they are removed from the queue.
* Can automatically add a song to it's queue if it gets enough votes, and mods can make the bot DJ. When the bot steps up to the decks, it will randomly put a song at the top of it's queue, and again once it finishes playing the song. This way it always plays a random song.
* Modpm feature lets mods send a message that goes out to all the other mods currently in the room.
* Automatically awesomes a song if it gets 5 awesomes or 20% of the room's population awesomes - whichever is lowest.
* Automatically scrobble songs played to last.fm.
* Automatically save song plays to a mysql or sqlite database.
* Get last.fm tags for the currently playing song or any artist.
* Ban any artist from being played in the room. If a DJ attempts to play any song by a banned artist, the bot will immediately escort the DJ down from the decks.
* Shitlist a user, causing the bot to automatically kick them from the room when they join. Keep those trolls away!
* Warn a user that their song is either not loading or is off genre for the room, and that they have 15 seconds to skip the song or else the bot will escort them down from the decks.
* Autodj - if there are 2 open spots on the decks, the bot will wait 1 minute before automatically stepping up to DJ. Once the decks fill up and someone adds themselves to the queue, however, the bot will automatically step down (unless the bot is the one whose song is playing when that happens - in which case it will step down after it's song is over). Also, this can be disabled, so the bot never autodj's.

### Triggers

Triggers are special commands any mod can set that will make the bot say a certain phrase. Any user can activate a trigger (to make the bot say the phrase), either in chat or PM. See [trigger](#trigger--keystring-valstring-), [triggerban](#triggerban--usernamestring-) and [triggerlimit](#triggerban--usernamestring-).

I'd be happy to help you get set up if you run into problems. You can usually find me in the [Chillout Mixer](http://turntable.fm/chillout_mixer_ambient_triphop).

## Setup

Obviously the bot should be a mod of the room it will be in, to be useful.

To get the bot's auth, userid, and roomid, see [this link](http://alaingilbert.github.com/Turntable-API/bookmarklet.html). Use the bookmarklet after logging in to turntable as the user the bot will run as, then copy and paste the auth, roomid and userid values.

The bot will create two json files (in the same directory as your script) to store state information, "settings.json" (stores the queue, shitlisted users, triggers, etc) and "djs.json" (id's of users who have dj'd, so a user will only get the introductory PM once). 

I'd suggest creating a new directory for your bot, perhaps using the name of your bot. Create a new .js file in this directory (perhaps also with the name of your bot, ie chilloutmixerbot.js), consisting of the following content. Set the 3 bot parameters (auth, userid & roomid) and whatever else to have the bot behave as you see fit. Run your .js file and the bot should start running.

```javascript
var cmbot = require('cmbot');
var mybot = new cmbot({
	// This will put the settings & dj files in the same directory where this script is
	settings_file: __dirname + '/settings.json', 
	dj_file: __dirname + '/djs.json',
	
	bot: {
		auth: 'xxxx',
		userid: 'xxxx',
		roomid: 'xxxx'
	},
	modules_directory: __dirname + '/modules',
	autoload_modules: true, // If set to true, scans the modules_directory for any .js files and loads any custom commands/events they contain
	queue_enabled: true, // Set to false to never use the queue.
	autodj: true, // Automatically DJ if 2 spots open up.
	snag_threshold: 10, // How many votes a song must get for the bot to add it to it's queue.
	set_limit: 4, // How many songs each person can play before they have to step down from the decks. Set to false for unlimited.
	// If either of the following are set to false, only awesome for the other. If both are set to false, never autobop. If both are set, autobop for whichever is lowest.
	autobop_threshold_number: 5, // How many other users must awesome before the bot awesomes
	autobop_threshold_percentage: 20, // The percentage of the room's population that must awesome before the bot awesomes
	master_userid: ['xxx'], // Who runs the bot should have extra privileges. Put your userid here. Can be a single userid (a string) or an array of them.
	ffa: [5], // Array of days of the week for free for all. Sunday = 0, Monday = 1, etc. Set to false for none.
	ffa_text: 'It\'s Free For All Friday! No Queue today.', // The bot will display this when someone tries to manipulate or show the queue on an FFA day. 
	timezone: 'PST', // The default timezone for modpm
	modpm_superusers: true, // Set to false to exclude superusers from modpm
	allow_mobile_djs: true, // Set to false to require users to be whitelisted in order to DJ from a mobile device (mods are exempt)
	lastfm: {
		enabled: false,
		username: '',
		password: '',
		api_key: '',
		api_secret: '',
		session_key: false,
		earliest_scrobble: '' // If you want /plays to add that the number of plays shown is from the date of your first scrobble, put it here, and it will append it ("since _____")
	},
	scrobble: true, // Set to false to not have the bot scrobble tracks to last.fm
	playsMode: 'lastfm', // use either 'lastfm' or 'mysql' or 'sqlite'
	songkick: {
		api_key: '' // Get an API key here: http://www.songkick.com/developer/
	},
	google: {
		url_shorten_api_key: 'AIzaSyCgS_W9UZYBhl3d8cLxxPYo1IaX6WzwJbc' // Go ahead and use this api key
	},
	mysql: {
		enabled: false, // Change to true and fill out details below to enable mysql logging of song plays
		host: '',
		database: '',
		user: '',
		password: ''
	},
	sqlite: {
		enabled: false, // Set to true to log all song plays to a sqlite database
		file: __dirname + '/mybot.db'
	},
	
	/*
	 * Messages:
	 * This should be an array of text that the bot will say in the chat room periodically, such as reminding 
	 * users of the rules, how the queue works, etc.
	 */
	messages: [
		'Welcome to room XXXXXX! Let\'s play some tunes!'
	],
	
	/*
	 * Sets how often the messages should display, in minutes. After the bot starts up, it waits the interval time,
	 * then speaks the first message (in the array above) out into chat. It then waits the interval time again until 
	 * displaying the next message in the array (if there is one). So, the amount of time between each time a 
	 * specific message is displayed is dependent on both the message interval (defined below) and the number of 
	 * different messages in the array. If there are two messages, and the interval is 15 minutes each message 
	 * will be displayed every 30 minutes - the first one 15 minutes after the bot starts, and the next one 15 
	 * minutes later, then the first one in another 15 minutes, etc.
	 */
	message_interval: 15, // Number of minutes between each informational message
	
	// index of which messages should be hidden when it's FFA (free for all) mode (if the queue is disabled, 
	// this setting doesn't do anything - every message will display)
	messages_hide_ffa: [], 
	
	/*
	 * The first time a user dj's in your room, you can have the bot PM them an introductory message, 
	 * for instance to remind them of what type of music is welcome in the room. to disable, just set this to false.
	 */
	new_dj_message: 'Please play some good music here.',
	 
	twitter: {
		consumer_key: 'xxxx',
		consumer_secret: 'xxxx',
		access_token_key: 'xxxx',
		access_token_secret: 'xxxx',
		tweet_songs: false, // Set this to true to make the bot tweet each song play
		tweet_text: '%djname% is spinning \'%song%\' by %artist% in the %roomname%: %roomurl%'
	}
});


```

## Dynamic Modules

You can load custom modules at runtime that contain custom commands and/or events, using the `/loadmodule` command. In order to use custom modules, however, make sure you defined the `modules_directory` setting in your bot's .js file. In the example given above, simply create a `modules` directory in the same directory your bot's .js file is located, and put your modules there.

You can also have your bot autoload any modules it finds by setting the `autoload_modules` option to true (see the setup example above).

Please note:If you have previously used the `addCommand` or `on` methods to add custom commands/events, please switch to using dynamic modules as those methods are deprecated and will be removed in a future version.

### Custom Commands

Your custom module can contain one or more custom commands that your bot will respond to. Simply create a .js file and place it in your modules directory (which you defined in the `modules_directory` option). As an example, create the file beer.js in your modules directory with the following contents:

```javascript
var customCommands = {
	name: 'beer', // This is what the bot will respond to (ie, /beer)
	command: function(options) {
		if(!options.pm) {
			var user;
			if(options.arg != '') {
				var u = options.cmbot.getUserByName(options.arg);
				user = u === false ? options.arg : '@' + u.name;
			} else {
				user = '@' + options.cmbot.users[options.userid].name;
			}
			options.cmbot.bot.speak("/me taps a keg and gives " + user + " a cold one! *cheers* :beer:");
		} else {
			options.cmbot.bot.pm("That command is chat-only.", options.userid);
		}
	},
	modonly: false,
	pmonly: false,
	hide: true,
	help: 'Text that shows when you type /help beer.',
	acl: false // 
};

exports.customCommands = customCommands;
```

Then, PM the bot `/loadmodule beer`. The bot will then respond to the /beer command which will prompt the bot to give you (or someone you specify) a beer. You can also do `/unloadmodule beer` to unload the module and have the bot not respond to `/beer` anymore.

For the actual command, the `options` object passed to it has the following makeup:
```javascript
	{
		// a reference to your bot object. You can use this to find a user's details (using the 'getUserByName' 
		// method, as above), or to make the bot interact with the room (see Alain's API)
		cmbot: <object>,
		
		// Whether or not this command was sent from the chat room or from a PM
		pm: <true|false>,  
		
		// The userid of the user who initiated the command
		userid: <string>, 
		
		// the argument entered after the command. For instance, for the 'beer' command, if you 
		// type '/beer someuser', arg would contain 'someuser'
		arg: <string> 
	}
```

### Custom Events

You can program your own logic for when certain turntable events happen. For instance, simply add the code like below into a file in your modules directory called `alot.js`.
Events supported: speak, ready, roomChanged, update_votes, newsong, endsong, pmmed, add_dj, rem_dj, update_user, new_moderator, rem_moderator, registered, deregistered, booted_user, snagged, nosong, tcpConnect, tcpMessage, tcpEnd, and httpRequest.
See Alain Gilbert's TTAPI (which this bot uses) for more details on what each event is for at https://github.com/alaingilbert/Turntable-API.
Note: These events fire after the bot's own logic does.

```javascript
var customEvents = {
	on: 'speak',
	setup: function(cmbot) {
		// Code in here gets run when the module is loaded. See the example module 'greeting.js'.
	},
	event: function(cmbot, data) {
		if(data.text.match(/\balot\b/i)) {
			cmbot.bot.speak("http://hyperboleandahalf.blogspot.com/2010/04/alot-is-better-than-you-at-everything.html");
		}
	}
};

exports.customEvents = customEvents;
```

After doing `/loadmodule alot` The above code will cause the bot to display that url if someone says 'alot' instead of 'a lot':)

Also note that the event receives an extra variable before any others that the ttapi does - this variable is your bot's object itself (cmbot, in the above example), which provides you with all the properties and methods of the bot, allowing you to make the bot speak, pm someone, or all kinds of other things.

You can hook the same event in multiple modules. When modules are autoloaded, they are fired in alphabetical order based on the name of the module's .js file. If not autoloaded, they are fired in the order that they are loaded.

As with custom commands, you can `/unloadmodule alot` to cancel the bot from reacting to the event.

Also, the `customCommands` and `customEvents` variables can be an array of objects, so you can add multiple commands and events in one file, if you wish.

## User Commands:

### addme

Add yourself to the queue. If you are already in the queue, it will tell you what position you are in.

### afk

Set yourself as AFK. When a spot on the decks opens, the bot alerts the first non-afk user in the queue that it's their turn. 

### back

Set yourself as back (ie, unafk).

### djafk

Show how many minutes each DJ has been idle.

### escortme

When a DJ issues this command, the bot will escort them off the decks after they finish playing their next song.

### fanme

The bot will fan the user.

### help ( [command:string] )

Get a list of commands a user has access to, as well as see more specific help for a command (ie, `/help queue`). If a user is not allowed to run a command, they will not see that command in the list the bot shows them (ie, regular users will not see any mod commands listed).

### queue

Show who is in the queue.

### playcount

Show how many songs each DJ has played.

### plays ( [artist:string] [- track:string] )

Show how many times a song has been played. Depending on configuration, can use either last.fm stats or internal stats that are stored in a mysql database.

### refresh

If a DJ needs to refresh their browser, they can use the /refresh command to not lose their spot on the decks. Otherwise, the bot will alert the next non-afk user in the queue that it is their turn. Note:this is not (yet) enforced.

### removeme

Remove yourself from the queue.

### settwitter ( username:string )

Set your twitter username, so the bot can @mention you when it tweets song plays. The bot will will respond with a randomly generated 32 character string which you must then tweet, after which you use the /verifytwitter command to verify your username.

### shortenurl ( url:string )

Use google's URL Shortening service to get a short version of any url.

### shows ( [artist:string] )

Using songkick.com, list the next 7 shows for the currently playing artist (using `/shows`), or for a specific artist (using `/shows artist`).

### tags ( [artist:string] )

Get last.fm tags for the currently playing song (`/tags`) or a particular artist (`/tags artist`).
 
### uptime

Show how long the bot has been running for.

### verifytwitter

Verify your twitter username, set with /settwitter. The bot will look up your most recent tweet for the randomly generated string it sent you, and if it finds it, saves your username.


## Mod Commands:

Note: If a command is marked as **ACL Enforced**, initially the command is only available to the master user, although that user can use `/addacl` to give access to the command to anyone they wish.

### add ( username:string )

**PM Only**

Add a user to the queue. 

### addacl ( command:string username:string )

**PM Only**

Add access to a command to a user. 

### autodj ( [val:enum('on', 'off')] )

**PM Only**

Show or enable/disable autodj.

### avatar ( [val:enum('chinesegirl', 'greengirl', 'redheadgirl', 'gingergirl', 'whiteboy', 'tangirl', 'tanboy', 'gingerboy', 'blackboy', 'greenbear', 'greybear', 'alienbear', 'aquabear', 'maroonbear', 'orangebear', 'blackbear', 'bluebear', 'lightbluecat', 'greencat', 'redcat', 'blondesuperboy', 'redheadsuperboy', 'hornedsuperboy', 'gorilla', 'boymonkey', 'girlmonkey', 'spaceman1', 'spaceman2', 'spaceman3', 'spaceman4', 'spaceman5', 'spaceman6', 'spaceman7', 'daftpunk1', 'daftpunk2')] )

**PM Only** 

**ACL Enforced**

Set the bot's avatar.

### awesome

The bot will awesome the currently playing track.

### ban ( artist:string )

Ban an artist. If a DJ attempts to play a song by a banned artist, the bot will immediately escort them from the decks and warn them that the artist is banned.

### bansong ( [artist:string - song:string] )

Ban a song. If a DJ attempts to play a banned song, the bot will give them 15 seconds to skip or else be escorted off the decks. If no argument is supplied, the currently playing song is banned, and the 15 second warning is given. Artist and song arguments are case insensitive, but must match the spelling of the id3 tags exactly.
 
### bannedartists

Show the list of banned artists. If this list gets long enough, it will cut off when displayed in chat, but won't be in PM.

### deckshitlist ( username:string [reason:string] )

Ban a user from being able to DJ. I will automatically escort any banned user from the decks. If a reason is specified, I will tell the user the reason when I escort them.

**PM Only**

### deckunshitlist ( username:string )

Remove a user from the Deck shitlist, allowing them to DJ again.

**PM Only** 

### dj

Makes the bot DJ. If there are no open spots, the bot add itself to the queue (unless it's not an FFA Day). If there are open spots, the bot will simply step up to the decks. See notes on how the bot adds songs to it's queue for more details.
 
### echo ( text:string )

**PM Only**

Make the bot say something in chat. To have the bot do an action, just use `/echo /me does something`, for example.

### enforcement ( [val:enum('on', 'off')] )

Show or enable/disable queue enforcement.

### getnext

**PM Only**

Get the next X number of songs in the bot's queue. The number X is either the number in set_limit (ie, how many songs each DJ can play for their turn), or if that is set to false, 5.

### kick ( username:string [reason:string] )

The bot will kick a user from the room. 

### lame

The bot will lame the currently playing song.

### loadmodule ( file:string )

Load a module to add a custom command or event. `file` is the name of a file, minus the `.js` extension, residing in the `modules_directory` as defined in the bot's options.

### modtrigger

**PM Only**

Set a trigger that that is only activated by mods. See [trigger](#trigger--keystring-valstring-).

### gettimezone

**PM Only**

Get your currently set timezone. If not set, modpm will display the time in the timezone the bot is configured as being in (default PST). 

### mobilewhitelist ( username:string )

**PM Only**

Adds a user to the mobile whitelist, allowing them to DJ from a mobile device (android or iphone). Users not on the whitelist will be automatically escorted, and kicked for repeated attempts (3 escorts in less than 10 seconds). Mods are exempt and may always DJ from a mobile device.

### modpm ( val:enum('on', 'off')] )

**PM Only**

**ACL Enforced**

Turn modpm on or off.

### move ( username:string position:integer )

**PM Only**

Move a user into a new position in the queue. A position of `1` is the first spot in the queue, etc.

### playlist

**PM Only**

Show how many songs the bot has in its playlist.

### profile

**PM Only**

**ACL Enforced**

Set the bot's profile info. Usage: '/profile <profile field> <some text>'. Available fields: name, twitter, facebook, website, about, topartists, and hangout.

### remacl ( command:string username:string )

**PM Only**

**ACL Enforced**

Remove access to a command for a certain user. 

### remove ( username:string )

**PM Only**

Remove a user from the queue.

### removesong ( position:integer )

**PM Only**

**ACL Enforced**

Remove a song from the bot's queue/playlist. Position is the index provided by /searchplaylist. If last.fm is enabled, this also 'unloves' the track.

### searchplaylist ( search_string:string )

**PM Only**

**ACL Enforced**

Search the bot's playlist for matching songs. `search_string` must be at least 4 characters long. If multiple words are specified, each has to be contained in either the artist or song name. ie, `/searchplaylist foo bar` would match a song whose artist contains the word 'foo' and song title contains the word 'bar', or vice versa. Results will be in the form of `<index>:<artist> - <track>`.

### setcount ( username:string count:integer ) 

**PM Only**

Set the playcount for a particular user.

### setdjtimeout ( val:integer )

** PM Only** 

Set how many minutes each DJ can be idle before given a 1 minute warning, after which time the bot will escort them down from the decks. Default 15 minutes. Set to 0 for no limit.

### setlimit ( [val:integer] )

**PM Only**

Display or change the set limit, i.e., how many songs each DJ can play before being escorted down. Set to 0 for unlimited. Once set, this overrides set_limit in your main .js file and will persist after the bot restarts.

### setnext ( val:integer )

**PM Only**

**ACL Enforced**

Move a song to the top of the bot's queue. `val` is the index returned by /searchplaylist.

### settimezone ( val:enum('EST', 'CST', 'MST', 'PST') )

**PM Only**

Set your timezone. The bot will display the adjusted time in modpm, and it will adjust for daylight savings time automatically.

### skip

If the bot is DJ'ing, this command will make the bot skip its song. Otherwise, the bot will say "Please skip this track." in chat.

### shitlist ( val:string reason:string )

Add a user, by name or userid, to the bot's shitlist. If the user is in the room when the shitlist is set, the bot will kick the user. Every time the user joins the room the bot will automatically kick them. 

### showmobilewhitelist

Show any users from the mobile whitelist who are in the room. The mobile whitelist only contains user id's so only users present in the room are able to be shown.

### stfu

Makes the bot cease informational messages for one round. ie, if the message interval is 15 minutes, and there are 3 messages to show, the bot will not say them for 45 minutes.

### trigger ( key:string val:string )

**PM Only**

Set a trigger. `/trigger facebook http://www.facebook.com/groups/....` will cause the bot to say `http://www.facebook.com/groups/....` if anyone types `/facebook`, either in chat or in a PM to the bot. You can also have the bot automatically shorten any url, using google's URL Shortener, by prepending 'shorten:' to the url. For example: `/trigger foo shorten:http://facebook.com` will cause the bot to say `http://goo.gl/mS4A`. Supports multiple URLs, too.

### triggerban ( username:string )

**PM Only**

Ban a user from using any triggers for 24 hours. Useful if a user abuses triggers.

### triggerlimit ( trigger:string timelimit:integer )

**PM Only**

Set a time limit (in seconds) between triggers being executed, for a particular trigger. ie, `/trigger foo bar`, then `triggerlimit foo 5`, then a user types /foo, causing the bot to say 'bar', and if someone says '/foo' again the bot will not say 'bar' again if 5 seconds has not elapsed.
 
### tweet ( text:string )

**PM Only**

Causes the bot to tweet (if twitter credentials are provided).

### unban ( artist:string )

Unban an artist. Usage is the same as /ban.

### unbansong ( [artist:string - song:string] )

Unban a song. If this command is given with no arguments after /bansong is given (also with no arguments) within the 15 second warning window, the warning is cancelled and the DJ will not be escorted off the decks.

### unloadmodule ( file:string )

Unload a module, to prevent the bot from responding to custom commands or events. Usage is the same as `/loadmodule`

### unmodtrigger ( trigger:string )

**PM Only** 

Remove a mod trigger.

### unmobilewhitelist ( username:string )

**PM Only**

Remove a user from the mobile whitelist.

### unshitlist ( username:string )

Remove a user from the shitlist. 

### untrigger ( trigger:string )

**PM Only**

Remove a trigger.

### unwarn

**PM Only**

Cancels a warning.

### warn ( [val:enum('loading', 'genre')] )

**PM Only**

Warns a DJ that the song they are playing either is not loading, or that it is out of genre for the room. If the DJ does not skip the trick within 15 seconds, the bot will escort the DJ from the decks. Usage is '/warn' for a generic message, or '/warn genre' or '/warn loading' for a more specific one.

### votes

**PM Only**

Shows a list of which users have voted awesome and which have lamed. Turntable seems to have made it much harder to tell if a user has lamed, so only some lames show up for some reason.

### yoink

Make the bot add the currently playing song to it's queue, and if last.fm is set up (with valid credentials), the bot will 'love' the track on last.fm.









