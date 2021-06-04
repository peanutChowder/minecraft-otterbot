const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalFollow = goals.GoalFollow
const collectBlock = require('mineflayer-collectblock').plugin;


// bot only listens to opped users
const opUsernames = ["toesniffer2000"]

const bot = mineflayer.createBot({
    port: parseInt(process.argv[2]),
    username: process.argv[3],
    password: process.argv[4]
});

let mcData
bot.loadPlugin(collectBlock)

function chatListener(username, message) {
    console.log(`CHAT => <${username}> : ${message}`);

    // check if user is "opped"
    if (opUsernames.includes(username)) {
        processChat(message);
    }
}

function processChat(message) {
    // TODO: message verification 
    msgArgs = message.split(" ");

    if (msgArgs[0] !== "bot") {
        return
    }

    if (msgArgs[1] == "collect") {
        if (msgArgs.length != 4) {
            bot.chat("Incorrect command usage. Use \"bot collect [amount] [item_name]\"");
            return
        }
        chatBlockCollect(msgArgs[2], msgArgs[3]);
    } else if (msgArgs[1] == "goto" && msgArgs.length == 3) {
        gotoPlayer(msgArgs[2]);
    }
}

function giveCoords() {
}

function gotoPlayer(username) {
    const selectedPlayer = bot.players[username];

    if (!selectedPlayer) {
        bot.chat(`Could not find user ${username}`);
        return
    }

    bot.chat(`Walking to ${username}'s last position.`);
    const goal = new GoalFollow(selectedPlayer.entity);
    bot.pathfinder.setGoal(goal)
}

function chatBlockCollect(amount, blockName) {
    const maxDistance = 500;
    const blockType = mcData.blocksByName[blockName];
    if (!blockType) {
        bot.chat("block not recognized");
    } else {
        const blocks = bot.findBlocks({
            matching: blockType.id,
            maxDistance: maxDistance,
            count: amount
        });

        console.log(blocks);
        // Notify in chat if block not found within defined maxDistance
        if (blocks.length === 0) {
            bot.chat(`${blockName} not found within ${maxDistance} blocks.`)
            return
        } else {
            const targets = [];
            for (let i = 0; i < Math.min(blocks.length, amount); i++) {
                targets.push(bot.blockAt(blocks[i]));
            }

            bot.chat(`found ${targets.length} of ${blockName}`);

            bot.collectBlock.collect(targets, err => {
                if (err) {
                    bot.chat(err.message);
                    console.log(err);
                } else {
                    bot.chat("Finished collecting");
                }
            });

        }

    }
}


bot.once('spawn', () => {
    mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);

    bot.chat("hello serverrr");
});

bot.on('chat', (username, message) => chatListener(username, message));
  








