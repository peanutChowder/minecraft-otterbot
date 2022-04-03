const mineflayer = require('mineflayer');
const { Movements, goals } = require('mineflayer-pathfinder');
const GoalNear = goals.GoalNear;
const collectBlock = require('mineflayer-collectblock').plugin;
const pvp = require('mineflayer-pvp').plugin;


// bot only listens to opped users
const opUsernames = []

const bot = mineflayer.createBot({
    port: parseInt(process.argv[2]),
    username: process.argv[3],
    password: process.argv[4]
});

let mcData
bot.loadPlugin(collectBlock)
bot.loadPlugin(pvp)

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

    switch (msgArgs[1]) {
        case "collect":
            try {
                chatBlockCollect(msgArgs[2], msgArgs[3]);
            } catch (err) {
                bot.chat("Incorrect command usage. Use \"bot collect [amount] [item_name]\"");
            }
            break;

        case "goto":
            gotoPlayer(msgArgs[2]);
            break;

        case "gotoblock":
            gotoBlock(msgArgs[2], msgArgs[3]);
            break;

        case "cancel":
            if (msgArgs[2] === "movement") {cancelMovement()}
            break;

        case "position":
            giveCoords();
            break;

        case "craft":
            try {
                const amount = parseInt(msgArgs[2]);
                craftItem(msgArgs[3], amount);
            } catch {
                bot.chat("Incorrect usage. Use \"bot craft [amount] [item_name]\"");
            } 
            break;
    }
}

function cancelMovement() {
    if (bot.pathfinder.goal || bot.collectBlock.targets) {
        bot.pathfinder.setGoal(null);
        bot.collectBlock.collect([]);
        bot.chat("movements cancelled");

       
    } else {
        bot.chat("no movements were set.")
    }
}

function giveCoords() {
    const position = bot.entity.position
    bot.chat(`position: ${position.x.toFixed(0)}, ${position.y.toFixed(0)}, ${position.z.toFixed(0)}`)
}

function gotoPlayer(username) {
    const selectedPlayer = bot.players[username];

    if (!selectedPlayer) {
        bot.chat(`Could not find user ${username}`);
        return
    }

    bot.chat(`Walking to ${username}'s last position.`);
    const coords = selectedPlayer.entity.position;
    console.log(coords);
    const goalNear = new GoalNear(coords.x, coords.y, coords.z, 1);
    bot.pathfinder.goto(goalNear, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            bot.chat("Arrived at location");
        }
    });
}

function passiveMeleeDefense() {
    const filter = e => e.type === "mob" && e.position.distanceTo(bot.entity.position) < 6
        && e.kind === "Hostile mobs";
    const entity = bot.nearestEntity(filter);

    if (entity) {
        const sword = bot.inventory.items().find(item => item.name.includes("sword"));
        if (sword) {bot.equip(sword, "hand")}
        bot.attack(entity)
    }
}

function craftItem(name, amount) {
    const item = mcData.findItemOrBlockByName(name);

    console.log(item);

    // find crafting table
    const craftingTableID = mcData.blocksByName.crafting_table.id;
    const craftingTable = bot.findBlock({matching: craftingTableID});

    if (item) {
        const recipe = bot.recipesFor(item.id, null, 1, craftingTable)[0];
        
        // attempt crafting recipe if it exists
        if (recipe) {
            try {
                bot.craft(recipe, amount, craftingTable, () => {bot.chat("done crafting")});
            } catch (err) {
                console.log(err);
            }

        } else {bot.chat("Do not have required materials.")};

        // if recipe exists and requires a crafting table out of bounds,
        // move to it or create a crafting table.
        if (!recipe && !craftingTable) {
            if (!gotoBlock("crafting_table", 50)) {
                // TODO
                bot.chat("Implement craft crafting table");
            } else {
                console.log("moving to crafting table")
                bot.findBlock({matching: craftingTableID});
                bot.once("goal_reached", () => craftItem(name, amount));
                return;
            }
        }
    } else {throw "Item not found."};
}

/**
 * Attemps to move within 1 block of the requested block given a distance radius
 * Reports in chat if unable to meet the given criteria. 
 * @param {[string]} blockName [requested block]
 * @param {[number]} maxDistance [maximum distance of the block]
 * @returns {[bool]} boolean of whether goto performed successfully 
 */
function gotoBlock(blockName,  maxDistance) {
    const block = getBlockTargets(1, blockName, maxDistance);


    if (!block) {
        bot.chat(`${blockName} not found within ${maxDistance} blocks.`);
        return false;
    }
    
    const coords = block[0].position;

    const goalNear = new GoalNear(coords.x, coords.y, coords.z, 1);
    bot.pathfinder.goto(goalNear, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            bot.chat("Arrived at location");
            return true;
        }
    });
    return true;
}

/**
 * 
 * @param {[number]} amount Amount of block searched for
 * @param {[string]} blockName Name of block
 * @param {[number]} maxDistance Maximum block distance from bot
 * @returns {[array]} Array of block objects
 */
function getBlockTargets(amount, blockName, maxDistance) {
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

            return targets
        }
    }
}

function chatBlockCollect(amount, blockName) {
    const maxDistance = 500;
    const targets = getBlockTargets(amount, blockName, maxDistance);

    if (!targets) {
        return
    } else {
        bot.collectBlock.collect(targets, err => {
            if (err) {
                console.log(err);
            } else {
                bot.chat("Finished collecting");
            }
        });
    }
}


bot.once('spawn', () => {
    mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);

    bot.chat("hello serverrr");

    // bot.on("physicsTick", passiveMeleeDefense);
});

bot.on('chat', (username, message) => chatListener(username, message));
