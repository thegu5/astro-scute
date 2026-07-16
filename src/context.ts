import { AsyncLocalStorage } from "node:async_hooks";

const store = new AsyncLocalStorage<{ includeBlobs: boolean }>();

export const runInScuteContext = <T>(
	ctx: { includeBlobs: boolean },
	fn: () => T,
) => store.run(ctx, fn);

export const includesBlobs = () => store.getStore()?.includeBlobs ?? true;
