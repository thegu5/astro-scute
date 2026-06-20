import { parse } from "@bomb.sh/args";
import { init } from "./commands/init.ts";
import { publish } from "./commands/publish.ts";
import { createSession, getConfig } from "./util.ts";

const args = parse(process.argv, {
	array: ["_"],
});
if (args._.at(-1) === "init") {
	await init();
} else if (args._.at(-1) === "publish") {
	await publish();
} else if (args._.at(-1) === "login") {
	// todo better error handling here
	await createSession((await getConfig()).identity);
}
