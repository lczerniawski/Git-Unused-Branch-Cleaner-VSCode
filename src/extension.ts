import * as vscode from 'vscode';
import { scanCommand } from './scan.command';
import { deleteCommand } from './delete.command';
import { showReportCommand } from './show-report.command';

export function activate(context: vscode.ExtensionContext) {
	const scanDisposable = vscode.commands.registerCommand('git-unused-branch-cleaner.scan', () => scanCommand(context));
	context.subscriptions.push(scanDisposable);

	const deleteDisposable = vscode.commands.registerCommand('git-unused-branch-cleaner.delete', () => deleteCommand(context));
	context.subscriptions.push(deleteDisposable);

	const showReportDisposable = vscode.commands.registerCommand('git-unused-branch-cleaner.showReport', () => showReportCommand(context));
	context.subscriptions.push(showReportDisposable);
}

export function deactivate() {}

