import simpleGit, { SimpleGit } from 'simple-git';
import * as vscode from 'vscode';
import { Criteria } from './data/criteria.enum';
import { RemotePlatform } from './data/remote-platform.enum';
import { RemoteInfo } from './data/remote-info.interface';
import { hasBeenMergedIntoMain, hasNoAssociatedTags, hasNoPullRequestsAzureDevOps, hasNoPullRequestsGitHub, hasNoRecentCommits } from './branch-filters';
import { getRemoteInfoGitHub, getRemoteInfoAzureDevOps, getRemoteUrl } from './git.helpers';

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

		let daysForCriteria;
		if (criteria.includes(Criteria.NoRecentCommits)) {
			daysForCriteria = await vscode.window.showInputBox({
				'prompt': 'Enter the number of days for criteria',
				validateInput: (value) => isNaN(Number(value)) ? 'Please enter a valid number' : undefined
			});

			if (daysForCriteria === undefined) {
				vscode.window.showInformationMessage('Days for criteria input cancelled.');
				return;
			}
		}

		let mainBranchName;
		if (criteria.includes(Criteria.BranchesMergedIntoMain)) {
			mainBranchName = await vscode.window.showInputBox({
				'prompt': 'Enter the name of the main branch',
				validateInput: (value) => value === '' ? 'Please enter a valid branch name' : undefined
			});

			if (mainBranchName === undefined || mainBranchName === '') {
				vscode.window.showInformationMessage('Main branch name input cancelled.');
				return;
			}
		}

		let remotePlatform;
		let ownerAndRepo;
		if (criteria.includes(Criteria.NoPullRequests)) {
			const remoteUrl = await getRemoteUrl(git);
			if(!remoteUrl) {
				return;
			}

			if(remoteUrl.includes('github.com')) {
				remotePlatform = RemotePlatform.GitHub;
			}
			else if(remoteUrl.includes('dev.azure.com')) {
				remotePlatform = RemotePlatform.AzureDevOps;
			}
			else {
				vscode.window.showErrorMessage('Unsupported origin selected, only Github and AzureDevOps is supported.');
			}

			if(remotePlatform === RemotePlatform.GitHub) {
				ownerAndRepo = await getRemoteInfoGitHub(remoteUrl);
				if (!ownerAndRepo) {
					vscode.window.showErrorMessage('Could not determine owner and repo from git remotes.');
					return;
				}
			}

			if(remotePlatform === RemotePlatform.AzureDevOps) {
				ownerAndRepo = await getRemoteInfoAzureDevOps(remoteUrl);
				if (!ownerAndRepo) {
					vscode.window.showErrorMessage('Could not determine owner and repo from git remotes.');
					return;
				}
			}
		}

        try {
            const branches = await git.branch(['-r']);
            const remoteBranches = branches.all;
			const filteredBranches = await filterBranches(remoteBranches, criteria, Number(daysForCriteria), mainBranchName!, ownerAndRepo, remotePlatform!, git);
            vscode.window.showInformationMessage(`Remote branches: ${filteredBranches.join(', ')}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to get remote branches: ${error.message}`);
        }
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

async function filterBranches(branches: string[], criteria: string[], daysForCriteria: number, mainBranchName:string, ownerAndRepo: RemoteInfo | undefined, remotePlatform: string, git: SimpleGit): Promise<string[]> {
	// TODO Add reason for being filtered out
	const filteredBranches = [];

	for(const branch of branches) {
		let includeBranch = true;

		for (const criterion of criteria) {
			switch (criterion) {
				case(Criteria.NoRecentCommits):
					includeBranch = await hasNoRecentCommits(branch, daysForCriteria, git);
					break;

				case(Criteria.BranchesMergedIntoMain):
					includeBranch = await hasBeenMergedIntoMain(branch, mainBranchName, git);
					break;

				case(Criteria.NoAssociatedTags):
					includeBranch = await hasNoAssociatedTags(branch, git);
					break;

				case(Criteria.NoPullRequests):
					if(remotePlatform === RemotePlatform.GitHub) {
						includeBranch = await hasNoPullRequestsGitHub(branch, ownerAndRepo!);
						break;
					}
					if(remotePlatform === RemotePlatform.AzureDevOps) {
						includeBranch = await hasNoPullRequestsAzureDevOps(branch, ownerAndRepo!);
						break;
					}
			}

		}

		if(includeBranch) {
			filteredBranches.push(branch);
		}
	}

	return filteredBranches;
}