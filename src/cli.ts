import { parse } from "@bomb.sh/args";
import { init } from "./commands/init.ts";
import { publish } from "./commands/publish.ts";
import { createSession, createTid, getConfig } from "./util.ts";

const { _, yes } = parse(process.argv, {
	array: ["_"],
	boolean: ["yes"],
	alias: { y: "yes" },
});

const subCommand = _.at(-1);

if (subCommand === "init") {
	await init();
} else if (subCommand === "publish") {
	await publish({ yes });
} else if (subCommand === "login") {
	// todo better error handling here
	await createSession((await getConfig()).identity);
} else if (subCommand === "generate-tid") {
	console.log(createTid(crypto.randomUUID(), new Date()));
}
