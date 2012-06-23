function ttUser(options) {
	options = options || {
		userid: '',
		name: '',
		mod: false
	};
	this.userid = options.userid;//user.userid;
	this.name = options.name;
	this.mod = options.mod;//mods[user.userid] == 1;
	this.playcount = 0;
	this.afk = false;
	this.djing = false;
	this.escorts = [];
	this.lastInteraction = this.now();
	this.present = true;
	this.refresh = false;
	this.escortme = false;
	this.escorted = false; // was this user just escorted off the decks?
	this.idleDJEscort = false;
	this.role = 'user';
	this.laptop = options.laptop || false;
	this.timers = {
		removeFromQueue: false,
		queueTimer: false,
		removeRefresh: false,
		idleDJCheck: false,
		idleDJRemove: false,
		casinoWinner: false
	};
}
ttUser.prototype.now = function() {
	return new Date().getTime();
};

module.exports = ttUser;
