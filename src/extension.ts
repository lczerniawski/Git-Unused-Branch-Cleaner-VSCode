import * as vscode from 'vscode';
import { scanCommand } from './scan.command';
import { deleteCommand } from './delete.command';

export function activate(context: vscode.ExtensionContext) {
	const scanDisposable = vscode.commands.registerCommand('git-unused-branch-cleaner.scan',  scanCommand);
	context.subscriptions.push(scanDisposable);

	const deleteDisposable = vscode.commands.registerCommand('git-unused-branch-cleaner.delete',  deleteCommand);
	context.subscriptions.push(deleteDisposable);
}

export function deactivate() {}

