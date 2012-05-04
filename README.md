#CMBot

A full featured bot for turntable.fm

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

Triggers are special commands any mod can set that will make the bot say a certain phrase. 

## Setup

First, run this command to install all the needed libraries: `npm install path xml2js querystring crypto dateformat ttapi sprintf http-get jquery ntwitter simple-lastfm`

If you'd like to log all song plays to mysql, run

`npm install mysql`

Or, if you'd like to log all song plays to a sqlite database (this is the easier option), run

`npm install sqlite3`

Obviously the bot should be a mod of the room it will be in, to be useful.

To get the bot's auth, userid, and roomid, see [this link](http://alaingilbert.github.com/Turntable-API/bookmarklet.html). Use the bookmarklet after logging in to turntable as the user the bot will run as, then copy and paste the auth, roomid and userid values.

The bot will create two json files (in the same directory as your script) to store state information, "settings.json" (stores the queue, shitlisted users, triggers, etc) and "djs.json" (id's of users who have dj'd, so a user will only get the introductory PM once). 

```javascript
var cmbot = require('./cmbot/');
var mybot = new cmbot({
	// This will put the settings & dj files in the same directory where this script is
	settings_file: __dirname + '/settings.json', 
	dj_file: __dirname + '/djs.json',
	
	bot: {
		auth: 'xxxx',
		userid: 'xxxx',
		roomid: 'xxxx'
	},
	queue_enabled: true, // Set to false to never use the queue.
	autodj: true, // Automatically DJ if 2 spots open up.
	snag_threshold: 10, // How many votes a song must get for the bot to add it to it's queue.
	set_limit: 4, // How many songs each person can play before they have to step down from the decks. Set to false for unlimited.
	master_userid: 'xxx', // Who runs the bot should have extra privileges. Put your userid here.
	ffa: [5], // Array of days of the week for free for all. Sunday = 0, Monday = 1, etc. Set to false for none.
	ffa_text: 'It\'s Free For All Friday! No Queue today.', // The bot will display this when someone tries to manipulate or show the queue on an FFA day. 
	timezone: 'PST', // The default timezone for modpm
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

## Custom Commands

You can create your own custom commands that your bot will respond to using the addCommand() method. Here is an example:

```javascript
mybot.addCommand('beer', {
	command: function(options) {
		if(!options.pm) {
			var user;
			if(options.arg != '') {
				var u = options.cmbot.getUserByName(options.arg);
				user = u === false ? options.arg : '@' + u.name;
			} else {
				user = '@' + options.cmbot.users[options.userid].name;
			}
			options.cmbot.bot.speak("/me gives " + user + " a beer.");
		} else {
			options.cmbot.bot.pm("That command is chat-only.", options.userid);
		}
	},
	// Whether or not this command is runnable by any user. Change to true to restrict it to only room mods.
	modonly: false,
	
	// Whether or not this command is only runnable by PM'ing it to the bot. 
	// If someone uses it in the chat room, it sends them a PM saying it's only usable in PM.
	pmonly: false,
	
	// Set true to use access controlled lists. The master user will always be able to run any command, 
	// but if this is set to true, a user may only run the command if the master user has given them 
	// access to the command (using /addacl). 
	acl: false, 
					 
	hide: true,	// Hide this command from the /help command. Set to false to show it.
	help: '' // Help text to display when a user is seeking help on the command.
});

```

This will add the /beer command which will prompt the bot to give you (or someone you specify) a beer. The syntax for the command is: addCommand(commandName, object), where the object contains a combination of the above keys.

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

## Custom Events

You can program your own logic for when certain turntable events happen. Simply call the 'on' method, like below, after instantiating the bot.
Events supported: speak, ready, roomChanged, update_votes, newsong, endsong, pmmed, add_dj, rem_dj, update_user, new_moderator, rem_moderator, registered, deregistered, tcpConnect, tcpMessage, tcpEnd, and httpRequest.
See Alain Gilbert's TTAPI (which this bot uses) for more details on what each event is for at https://github.com/alaingilbert/Turntable-API.
Note: These events fire after the bot's own logic does.

```javascript
chilloutmixerbot.on('speak', function(data) {
	if(data.text.match(/\balot\b/i)) {
		chilloutmixerbot.bot.speak("http://hyperboleandahalf.blogspot.com/2010/04/alot-is-better-than-you-at-everything.html");
	}
});
```

The above code will cause the bot to display that url if someone says 'alot' instead of 'a lot':)

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

### plays ( [artist:string] [> track:string] )

Show how many times a song has been played. Depending on configuration, can use either last.fm stats or internal stats that are stored in a mysql database.

### refresh

If a DJ needs to refresh their browser, they can use the /refresh command to not lose their spot on the decks. Otherwise, the bot will alert the next non-afk user in the queue that it is their turn. Note:this is not (yet) enforced.

### removeme

Remove yourself from the queue.

### shortenurl ( url:string )

Use google's URL Shortening service to get a short version of any url.

### shows ( [artist:string] )

Using songkick.com, list the next 7 shows for the currently playing artist (using `/shows`), or for a specific artist (using `/shows artist`).

### tags ( [artist:string] )

Get last.fm tags for the currently playing song (`/tags`) or a particular artist (`/tags artist`).
 
### uptime

Show how long the bot has been running for.


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

### bannedartists

Show the list of banned artists. If this list gets long enough, it will cut off when displayed in chat, but won't be in PM.

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

### gettimezone

**PM Only**

Get your currently set timezone. If not set, modpm will display the time in the timezone the bot is configured as being in (default PST). 

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

Remove a song from the bot's queue/playlist. Position is the index provided by /searchplaylist.

### searchplaylist ( search_string:string )

**PM Only**

**ACL Enforced**

Search the bot's playlist for matching songs. `search_string` must be at least 4 characters long. If multiple words are specified, each has to be contained in either the artist or song name. ie, `/searchplaylist foo bar` would match a song whose artist contains the word 'foo' and song title contains the word 'bar', or vice versa. Results will be in the form of `<index>:<artist> - <track>`.

### setcount ( username:string count:integer ) 

**PM Only**

Set the playcount for a particular user.

### setnext ( val:integer )

**PM Only**

**ACL Enforced**

Move a song to the top of the bot's queue. `val` is the index returned by /searchplaylist.

### settimezone ( val:enum('EST', 'CST', 'MST', 'PST') )

**PM Only**

Set your timezone. The bot will display the adjusted time in modpm, and it will adjust for daylight savings time automatically.

### skip

If the bot is DJ'ing, this command will make the bot skip its song. Otherwise, the bot will say "Please skip this track." in chat.

### shitlist ( username:string reason:string )

Add a user to the bot's shitlist. If the user is in the room when the shitlist is set, the bot will kick the user. Every time the user joins the room the bot will automatically kick them. 

### stfu

Makes the bot cease informational messages for one round. ie, if the message interval is 15 minutes, and there are 3 messages to show, the bot will not say them for 45 minutes.

### trigger ( key:string val:string )

**PM Only**

Set a trigger. `/trigger facebook http://www.facebook.com/groups/....` will cause the bot to say `http://www.facebook.com/groups/....` if anyone types `/facebook`, either in chat or in a PM to the bot.

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









