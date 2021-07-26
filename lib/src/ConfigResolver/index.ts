import { Script } from "../Script";
import { InitialConfig } from "../config/InitialConfig";
import { Prompter } from "../Prompter";

export class ConfigResolver {
	constructor(private config: InitialConfig) { }

	public async resolve(): Promise<Script> {
		if (this.config.has('scriptPath')) {
			return new Script(this.config.get('scriptPath'));
		} else {
			const prompter = new Prompter(this.config)
			const { script } = await prompter.PromptChooseScript();
			return new Script(script);
		}
	}
}