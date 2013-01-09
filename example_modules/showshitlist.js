var showShitList = {
    name: 'showshitlist', // This is what the bot will respond to (ie, /beer)
    command: function(options) {
            if(options.arg == '') {
                var shitty_list = '';
                for(var shitty in options.cmbot.settings.shitlist) {
                    shitty_list += options.cmbot.settings.shitlist[shitty].name +", ";
                }
                options.cmbot.bot.pm(shitty_list, options.userid);
            } else {

                var u = false;
                for(var shitty in options.cmbot.settings.shitlist) {
                    if (options.cmbot.settings.shitlist[shitty].name == options.arg) {
                        u = shitty;
                    }
                }

                if(u === false) {
                    var text = ("No such shitlisted user: "+ options.arg);
                } else {
                    var text = options.cmbot.settings.shitlist[u].name +" was banned by "+ options.cmbot.settings.shitlist[u].originator.name +" because: '"+ options.cmbot.settings.shitlist[u].reason +"'";
                }
                options.cmbot.bot.pm(text, options.userid);
            }
    },
    modonly: true,
    pmonly: true,
    hide: false,
    help: 'Shows who got shitlisted, enter the person\'s name to see the reason e.g. /showshitlist jim101',
    acl: false
};

exports.customCommands = showShitList;
