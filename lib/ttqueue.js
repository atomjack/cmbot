var $ = require('jquery');

var ttqueue = function(cmbot, saveCallback) {
	this.cmbot = cmbot;
	
	this.USER_IN_QUEUE = 0;
	this.USER_ON_DECKS = 1;
	this.USER_NOT_FOUND = 2;
	this.USER_NOT_IN_QUEUE = 3;
	this.ALREADY_YOINKED = 4;

	this.queueArray = [];
	
	this.saveCallback = saveCallback;
};

ttqueue.prototype.setQueue = function(_queue) {
	this.queueArray = _queue;
};

ttqueue.prototype.saveQueue = function() {
	if(typeof this.saveCallback == 'function')
		this.saveCallback(this.queueArray);
	else
		console.log("not a function");
};

ttqueue.prototype.newAddUser = function(user) {
	var result = {
		success: false
	};
	if(typeof user != 'object') {
		result.code = this.USER_NOT_FOUND;
		return result;
	}
	if(user.djing) {
		result.code = this.USER_ON_DECKS;
		return result;
	}
	
	if(this.queueArray.indexOf(user.userid) > -1) {
		result.code = this.USER_IN_QUEUE;
		result.spot = this.queueArray.indexOf(user.userid) + 1;
		return result;
	}
	this.queueArray.push(user.userid);
	result.success = true;
	result.queue = this.printQueue(true);
	this.saveQueue();
	return result;
};

// user should be of the form {name: 'foo', userid: 'bar'}
ttqueue.prototype.addUser = function(user) {
//	console.log("adding user ", user);
	var checkUser = getUserByName(user.name);
	if(!checkUser)
		return this.USER_NOT_FOUND;
	var queueArray = this.queueArray;
	var duplicate = false;
	$(queueArray).each(function(index, userid) {
		if(user.userid == userid)
			duplicate = true;
	});
	if(duplicate)
		return this.USER_IN_QUEUE;
	this.queueArray.push(user.userid);
	this.saveQueue();
	return true;
};

ttqueue.prototype.getQueueFull = function() {
	var cmbot = this.cmbot;
	var fullQueue = [];
	$.each(this.queueArray, function(index, userid) {
		var user = cmbot.users[userid];
		try {
			fullQueue.push({
				name: user.name,
				afk: user.afk ? 1 : 0
			});
		} catch(e) {}
	});
	return fullQueue;
};

/*
ttqueue.prototype.newRemoveUser = function(userid) {
	var result = {
		success: false
	};
	var queueArray = this.queueArray;
	var found = false;
	$(queueArray).each(function(index, each_userid) {
		try {
			if (userid == each_userid) {
				found = true;
				queueArray.splice(index, 1);
				clearTimeout(users[userid].timers.queueTimer); // In case this user was in the middle of having 3 minutes to step up, clear the timer or else all hell will break loose
			}
		} catch(e) {}
	});
	if(found) {
		this.queueArray = queueArray;
		this.saveQueue();
		result.success = true;
	} else {
		result.code = this.USER_NOT_IN_QUEUE;
	}
	return result;
};
*/

ttqueue.prototype.removeUser = function(user) {
	var queueArray = this.queueArray;
	var found = false;
	$(queueArray).each(function(index, userid) {
//		var thisUser = users[userid];
		try {
			if (user.userid == userid) {
				found = true;
				queueArray.splice(index, 1);
				clearTimeout(user.timers.queueTimer); // In case this user was in the middle of having 3 minutes to step up, clear the timer or else all hell will break loose
			}
		} catch(e) {}
	});
	if (found) {
		this.queueArray = queueArray;
		this.saveQueue();
		return true;
	}
	return this.USER_NOT_IN_QUEUE;
};

ttqueue.prototype.addUserByName = function(name) {
//	console.log("adding user " + name);
	var matchedUser = getUserByName(name);
//	console.log("matched user: ", matchedUser);
//		console.log("users on decks: ", usersOnDecks);
//		console.log("this is " + usersOnDecks[matchedUser.userid]);
	if(matchedUser.djing)
		return this.USER_ON_DECKS;
	if(matchedUser !== false)
		return this.addUser(matchedUser);
	else
		return this.USER_NOT_FOUND;
};

ttqueue.prototype.removeUserByName = function(name) {
	var matchedUser = getUserByName(name);
	if(matchedUser === false)
		return this.USER_NOT_FOUND;
	$(this.queueArray).each(function(index, thisUser) {
		if(thisUser.name == name)
			matchedUser = thisUser;
	});
	if (matchedUser !== false) {
		return this.removeUser(matchedUser);
	} else {
		return this.USER_NOT_IN_QUEUE;
	}
};

ttqueue.prototype.newRemoveUser = function(userid) {
	var result = {
		success: false
	};
	if(this.queueArray.indexOf(userid) == -1) {
		result.code = this.USER_NOT_IN_QUEUE;
	} else {
		this.queueArray.splice(this.queueArray.indexOf(userid), 1);
		result.success = true;
	}
	return result;
};

ttqueue.prototype.printQueue = function(ret) {
	var cmbot = this.cmbot;
	ret = ret || false;
	var text = '';
//	console.log("queue length = ", this.queueArray);
	if (this.queueArray.length == 0) {
		//mySpeak("The queue is currently empty. Type /addme to add yourself.");
		if(this.cmbot.session.djs.length < this.cmbot.session.max_djs)
			text = 'The queue is currently empty, but since there\'s an open DJ spot, just step up!';
		else
			text = 'The queue is currently empty. Type /addme to add yourself.';
	}
	else {
		var queueNames = [];
		$(this.queueArray).each(function(index, userid) {
			try {
				var user = cmbot.users[userid];
//				console.log("user = ", user);
				queueNames.push(user.name + (user.afk || !user.present ? ' (afk)' : ''));
			} catch(e) {
				console.log("Exception: ", e);
			}
		});
		//mySpeak("Current queue: " + queueNames.join(', '));
		text = "Current queue: " + queueNames.join(', ');
	}
	if(ret)
		return text;
	else
		mySpeak(text);
};

ttqueue.prototype.getQueueLength = function(noafk) {
	var cmbot = this.cmbot;
	noafk = noafk || false;
	if(!noafk)
		return this.queueArray.length;
	var num = 0;
	$.each(this.queueArray, function(index, userid) {
		var user = cmbot.users[userid];
		if(user != undefined)
			if(!user.afk)
				num++;
	});
	return num;
};

ttqueue.prototype.getQueue = function() {
	this.prune();
	return this.queueArray;
};

ttqueue.prototype.moveUser = function(oldPosition, newPosition) {
	this.queueArray.move(oldPosition, newPosition);
	this.saveQueue();
};

ttqueue.prototype.prune = function() {
	var cmbot = this.cmbot;
	try {
		/*
		$(this.cmbot.session.djs).each(function(index, userid) {
//				console.log("index = " + index + ", userid = " + userid);
			
			if(!cmbot.users[userid].djing) {
				cmbot.session.djs.splice(index, 1);
			}
		});
		*/
		var newArray = [];
		$.each(this.queueArray, function(index, userid){
			if (cmbot.users[userid] != undefined) 
				newArray.push(userid);
		});
		this.queueArray = newArray;
	} catch(e) {
//		console.log("Exception pruning: ", e.stack);
	}
};

ttqueue.prototype.clearQueue = function() {
	this.queueArray = [];
};

Array.prototype.move = function (old_index, new_index) {
	 if (new_index >= this.length) {
		  var k = new_index - this.length;
		  while ((k--) + 1) {
				this.push(undefined);
		  }
	 }
	 this.splice(new_index, 0, this.splice(old_index, 1)[0]);
	 return this; // for testing purposes
};

module.exports = ttqueue;
