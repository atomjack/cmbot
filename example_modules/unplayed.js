var customCommands = {
    name: 'unplayed', 
	command: function(options) {
		options.cmbot.bot.pm("Please wait.", options.userid);
		var artist = options.arg;
		options.cmbot.lastfm.getAllTracks({
			artist: artist, 
			callback: function(result) {
				if(!result.success) {
					options.cmbot.bot.pm(result.reason, options.userid);
				} else {
					var tracksPlayedByBot = result.tracks;
					artist = result.artist;
					// Lowercase all the tracks
					for(var i=0;i<tracksPlayedByBot.length;i++) {
						tracksPlayedByBot[i] = tracksPlayedByBot[i].toLowerCase();
					}
					options.cmbot.bot.searchSong(artist, function(result) {
						var unplayedSongs = [];
						for(var i=0;i<result.docs.length;i++) {
							var foundSong = result.docs[i].metadata;
							if(foundSong.artist == artist && tracksPlayedByBot.indexOf(foundSong.song.toLowerCase()) < 0) {
								unplayedSongs.push(foundSong.song);
							}
						}
						var text = "";
						if(unplayedSongs.length == 0)
							text = "No unplayed songs by " + artist + " found in turntable's library.";
						else {
							unplayedSongs = unplayedSongs.sort(function() { return 0.5 - Math.random() }).splice(0, 5);
							text = "Unplayed songs by " + artist + ": " + unplayedSongs.join(', ');
						}
						options.cmbot.bot.pm(text, options.userid);
					});
				}
			}
		});
	},
	modonly: false,
	pmonly: true,
	help: "Get a list of up to 5 songs by an artist that haven't been played in the room.",
	hide: false
};

exports.customCommands = customCommands;
