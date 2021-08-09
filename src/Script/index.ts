import { Config } from '../Config';
import { existsSync } from 'fs';
import { parse } from '../helpers/parsing.helpers';
import { resolve } from 'path';
import { Prompt } from '../Prompt/types';
import { Answers } from 'inquirer';
import { InitialConfig } from '../Config/InitialConfig';
import { TemplateResolver } from '../TemplateResolver';
import { BasePrompt } from '../Prompt/BasePrompt';
import { CodeGen, ScriptConfig } from '../CodeGen';
import { Template } from '../Template';
import { file } from '../helpers/file.helpers';
import { join } from 'path';
import { Step } from '../Step';

export class Script {

	private config: Config;
	private steps: Step[];
	private scriptPath: string;
	private templates: Template[];
	private currentStep = 0;

	constructor(scriptPath: string) {
		let codeGen = null;
		this.config = InitialConfig.getInstance();
		this.scriptPath = file.resolvePath(scriptPath, this.config.get("cwd"));
		if (!this.scriptPath.endsWith(this.config.get("scriptDefaultName"))) {
			this.scriptPath = join(this.scriptPath, "codegen.js");
		}

		if (existsSync(this.scriptPath)) {
			codeGen = require(this.scriptPath);
		}

		if (!codeGen) {
			throw new Error(`Script ${this.scriptPath} not found`);
		}

		if (!(codeGen instanceof CodeGen)) {
			throw new Error(`Script ${scriptPath} must export an instance of CodeGen`);
		}

		this.config.extend({
			onParseAllAnswers: null,
			...codeGen.getConfig(),
		} as ScriptConfig);

		this.templates = codeGen.getTemplates();
		if (this.templates.length === 0) {
			this.templates.push(new Template(resolve(this.scriptPath, '..', TemplateResolver.templatesFolder)))
		}
		this.steps = codeGen.getSteps();
		if (this.steps.length === 0) {
			this.steps.push(new Step(codeGen.getPrompts()))
		}

		this.validate();
		this.evalConfigEnums();
	}

	private validate() {
		if (!this.steps.every(step => step instanceof Step)) {
			throw new Error("Step inválido, todos os steps devem ser uma instância de Step");
		}
	}

	private evalConfigEnums() {
		const enums = this.config.get('enums') || {};
		let parsedEnums = {};
		Object.entries(enums).forEach(([k, v]) => {
			if (typeof v === 'function') {
				parsedEnums[k] = v(this.config.getConfig());
			} else if (typeof v === 'string' && v.endsWith(".php")) {
				parsedEnums[k] = parse.phpEnum(resolve(process.cwd(), v), this.config.getConfig());
			} else if (typeof v === 'object') {
				parsedEnums[k] = v;
			}
		});

		this.config.extend({ enums: parsedEnums });
	}

	public getConfig = () => {
		return this.config;
	};

	public getPrompts = (answers) => {
		return this.parsePrompts(this.getCurrentPrompts(answers));
	};

	public hasNextStep() {
		return this.currentStep < this.steps.length - 1;
	}

	public getNextStep() {
		this.currentStep++;
		const step = this.steps[this.currentStep];
		return step;
	}

	private getCurrentPrompts(answers) {
		return this.steps[this.currentStep].getPrompts(answers, this.config.getConfig());
	}

	public setConfig(config: Config) {
		this.config = config;
	}

	private parsePrompts = (prompts: BasePrompt[]) => {
		return prompts.map(prompt => {
			prompt.parseMethods(this.config);
			return {
				...prompt.getPrompt(),
			};
		});
	}

	private getParsers(answers): Record<string, Prompt.Parser> {
		return this.getCurrentPrompts(answers).reduce((acc, prompt) => {
			if (prompt.hasParser()) {
				return { ...acc, [prompt.getName()]: prompt.getParser() };
			}

			return { ...acc };
		}, {})
	}

	public parseAnswers(answers: Answers): Answers {
		let parsedAnswers = answers;

		const parsers = this.getParsers(answers);
		Object.entries(parsedAnswers).forEach(([key, value]) => {
			let parsedAnswer = value;
			const parser = parsers[key];
			if (parser) {
				let result = parser(value, answers, this.config.getConfig());
				if (typeof result === 'string') {
					parsedAnswer = result;
				}
			}
			parsedAnswers[key] = parsedAnswer;
		});

		if (this.config.hasCallback('onParseAllAnswers')) {
			const onParseAllAnswers = this.config.get('onParseAllAnswers');
			const parsedAnswersCallbackAfter = onParseAllAnswers(parsedAnswers, this.config.getConfig());
			parsedAnswers = {
				...parsedAnswers,
				...parsedAnswersCallbackAfter,
			};
		}

		return parsedAnswers;
	}

	public getScriptPath() {
		return this.scriptPath;
	}

	public getTemplates() {
		if (!this.templates.length) {
			throw new Error(`Nenhuma template encontrada ou informada, você precisa:
				Adicionar templates à instância CodeGen utilizando o método 'addTemplate()', ou
				Criar uma pasta 'templates' no diretório do script.`);
		};

		return this.templates;

	}

}

