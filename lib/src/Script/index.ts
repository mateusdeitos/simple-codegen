import { Config } from '../config';
import { existsSync } from 'fs';
import { parse } from '../helpers/parsing.helpers';
import { resolve } from 'path';
import { Prompt } from './types';
import { Answers } from 'inquirer';
import { InitialConfig } from '../config/InitialConfig';
import { TemplateResolver } from './TemplateResolver';

export class Script {

	private config: Config;
	private prompts: Prompt.PromptQuestion[];
	private scriptPath: string;

	constructor(scriptPath: string) {
		if (!existsSync(scriptPath)) {
			throw new Error(`Script ${scriptPath} not found`);
		}

		const script = require(scriptPath);

		this.scriptPath = scriptPath;
		this.config = new InitialConfig();
		this.config.extend({
			pathToTemplates: resolve(this.scriptPath, '..', TemplateResolver.templatesFolder),
			...script?.config
		});
		this.prompts = script?.prompts || [];
		this.initConfig();
	}


	private initConfig() {
		if (!(this.config instanceof Config)) return;
		this.evalConfigEnums();
	}

	private evalConfigEnums() {
		const enums = this.config.get('enums') || {};
		let parsedEnums = {};
		Object.entries(enums).forEach(([k, v]) => {
			if (typeof v === 'function') {
				parsedEnums[k] = v(this.config.getConfig());
			} else if (typeof v === 'string') {
				parsedEnums[k] = parse.phpEnum(resolve(this.scriptPath, '..', v));
			}
		});

		this.config.extend({ enums: parsedEnums });
	}

	public getConfig = () => {
		return this.config;
	};

	public getPrompts = () => {
		return this.prompts;
	};

	private isValidParser = (parser: Prompt.PromptQuestion["parser"]) => {
		return !!parser && typeof parser === 'function';
	}

	private getParsers(): Record<string, Prompt.Parser> {
		return this.prompts.reduce((acc, prompt) => {
			if (prompt.parser && this.isValidParser(prompt.parser)) {
				return { ...acc, [prompt.name]: prompt.parser };
			}

			return { ...acc };
		}, {})
	}

	public parseAnswers(answers: Answers): Answers {
		const parsers = this.getParsers();
		let parsedAnswers = {};
		Object.entries(answers).forEach(([key, value]) => {
			let parsedAnswer = value;
			const parser = parsers[key];
			if (parser) {
				let result = parser(value, this.config.getConfig());
				if (typeof result === 'string') {
					parsedAnswer = result;
				}
			}
			parsedAnswers[key] = parsedAnswer;
		});

		return parsedAnswers;
	}

	public getScriptPath() {
		return this.scriptPath;
	}

	public getTemplatesPath() {
		if (!this.config.has('pathToTemplates')) {
			throw new Error("Path to templates folder not defined");
		};

		return this.config.get('pathToTemplates')


	}

}

