var showShitList = {
    name: 'showdeckshitlist', // This is what the bot will respond to (ie, /beer)
    command: function(options) {
            if(options.arg == '') {
                var shitty_list = '';
                for(var shitty in options.cmbot.settings.deckshitlist) {
                    shitty_list += options.cmbot.settings.deckshitlist[shitty].name +", ";
                }
                options.cmbot.bot.pm(shitty_list, options.userid);
            } else {

                var u = false;
                for(var shitty in options.cmbot.settings.deckshitlist) {
                    if (options.cmbot.settings.deckshitlist[shitty].name == options.arg) {
                        u = shitty;
                    }
                }

                if(u === false) {
                    var text = ("No such deckshitlisted user: "+ options.arg);
                } else {
                    var text = options.cmbot.settings.deckshitlist[u].name +" was banned by "+ options.cmbot.settings.deckshitlist[u].originator.name +" because: '"+ options.cmbot.settings.deckshitlist[u].reason +"'";
                }
                options.cmbot.bot.pm(text, options.userid);
            }
    },
    modonly: true,
    pmonly: true,
    hide: false,
    help: 'Shows who got deckshitlisted, enter the person\'s name to see the reason e.g. /showdeckshitlist jim101',
    acl: false
};

exports.customCommands = showShitList;
