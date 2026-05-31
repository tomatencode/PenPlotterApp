import type { PnplttrDocument } from "../types";
import { documentToGcode } from "./convertToGcode";

self.onmessage = (e: MessageEvent<PnplttrDocument>) => {
	try {
		const gcode = documentToGcode(e.data);
		self.postMessage({ type: "success", gcode });
	} catch (err) {
		self.postMessage({ type: "error", message: String(err) });
	}
};
