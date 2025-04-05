import * as vscode from 'vscode';
import { scanCommand } from './scan.command';
import { deleteCommand } from './delete.command';
import { showReportCommand } from './show-report.command';
let Octokit: any;
(async () => {
	Octokit = (await import('@octokit/rest')).Octokit;
})();

export async function activate(context: vscode.ExtensionContext) {
	const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true});
	const octokit = new Octokit({ auth: session.accessToken });

	const scanDisposable = vscode.commands.registerCommand('git-unused-branch-cleaner.scan', () => scanCommand(context, octokit));
	context.subscriptions.push(scanDisposable);

	const deleteDisposable = vscode.commands.registerCommand('git-unused-branch-cleaner.delete', () => deleteCommand(context));
	context.subscriptions.push(deleteDisposable);

	const showReportDisposable = vscode.commands.registerCommand('git-unused-branch-cleaner.showReport', () => showReportCommand(context));
	context.subscriptions.push(showReportDisposable);
}

export function deactivate() {}

