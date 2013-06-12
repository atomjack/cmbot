var customEvents = [{
	on: 'registered',
	event: function(cmbot, data) {
		console.log("new user: ", data);
		if(data.user[0].name == 'Guest') {
			cmbot.bot.bootUser(data.user[0]._id, "Sorry, guests aren't allowed in this room.");
		}
	}
}
];

exports.customEvents = customEvents;
