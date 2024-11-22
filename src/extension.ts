import simpleGit, { SimpleGit } from 'simple-git';
import * as vscode from 'vscode';

enum Criteria {
    NoRecentCommits = 'No recent commits',
    NoActivity = 'No activity',
    BranchesMergedIntoMain = 'Branches merged into main',
    BranchesOlderThanCertainDate = 'Branches older than a certain date',
    NoAssociatedTags = 'No associated tags',
    NoPullRequests = 'No pull requests',
    NoOpenIssues = 'No open issues'
}

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('git-unused-branch-cleaner.scan', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const git: SimpleGit = simpleGit(workspacePath);

		const criteria = await vscode.window.showQuickPick(
			Object.values(Criteria),
			{
				placeHolder: 'Select criteria to scan for unused branches',
				canPickMany: true
			}
		);

		if(!criteria || criteria.length === 0) {
			vscode.window.showErrorMessage('No criteria selected.');
			return;
		}

		const daysForCriteria = await vscode.window.showInputBox({
			'prompt': 'Enter the number of days for criteria',
			validateInput: (value) => isNaN(Number(value)) ? 'Please enter a valid number' : undefined
		});

		if (daysForCriteria === undefined) {
			vscode.window.showInformationMessage('Days for criteria input cancelled.');
		}

        try {
            const branches = await git.branch(['-r']);
            const remoteBranches = branches.all;
			const filteredBranches = await filterBranches(remoteBranches, criteria, Number(daysForCriteria), git);
            vscode.window.showInformationMessage(`Remote branches: ${filteredBranches.join(', ')}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to get remote branches: ${error.message}`);
        }
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

async function filterBranches(branches: string[], criteria: string[], daysForCriteria: number, git: SimpleGit): Promise<string[]> {
	const filteredBranches = [];

	for(const branch of branches) {
		let includeBranch = true;

		for (const criterion of criteria) {
			switch (criterion) {
				case(Criteria.NoRecentCommits):
					includeBranch = await hasRecentCommits(branch, daysForCriteria, git);
					break;
			}

		}

		if(includeBranch) {
			filteredBranches.push(branch);
		}
	}

	return filteredBranches;
}

async function hasRecentCommits(branch: string, daysForCriteria: number, git: SimpleGit): Promise<boolean> {
	const commits = await git.log([branch]);
	const recentCommits = commits.all.filter(commit => {
		const commitDate = new Date(commit.date);
		const daysAgo = (Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24);
		return daysAgo <= daysForCriteria;
	});

	return recentCommits.length > 0;
} 