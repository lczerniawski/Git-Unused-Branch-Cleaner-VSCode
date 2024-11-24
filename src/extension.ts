import * as vscode from 'vscode';
import { scanCommand } from './scan.command';

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('git-unused-branch-cleaner.scan',  scanCommand);
	context.subscriptions.push(disposable);
}

export function deactivate() {}

