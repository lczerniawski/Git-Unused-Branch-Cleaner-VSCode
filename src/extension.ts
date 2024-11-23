let Octokit: any;
(async () => {
	Octokit = (await import('@octokit/rest')).Octokit;
})();
import simpleGit, { SimpleGit } from 'simple-git';
import * as vscode from 'vscode';

enum Criteria {
    NoRecentCommits = 'No recent commits',
    BranchesMergedIntoMain = 'Branches merged into main',
    NoAssociatedTags = 'No associated tags',
    NoPullRequests = 'No pull requests',
}

enum RemotePlatforms {
	GitHub = "GitHub",
	AzureDevOps = "Azure DevOps"
}

interface RemoteInfo {
	owner: string,
	project: string
	repo: string
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
			remotePlatform = await vscode.window.showQuickPick(
				Object.values(RemotePlatforms),
				{
					placeHolder: 'Select remote platform'
				}
			);

			if(remotePlatform === RemotePlatforms.GitHub) {
				ownerAndRepo = await getOwnerAndRepoGitHub(git);
				if (!ownerAndRepo) {
					vscode.window.showErrorMessage('Could not determine owner and repo from git remotes.');
					return;
				}
			}

			if(remotePlatform === RemotePlatforms.AzureDevOps) {
				ownerAndRepo = await getOwnerProjectRepoAzureDevOps(git);
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
					includeBranch = await hasRecentCommits(branch, daysForCriteria, git);
					break;

				case(Criteria.BranchesMergedIntoMain):
					includeBranch = await hasBeenMergedIntoMain(branch, mainBranchName, git);
					break;

				case(Criteria.NoAssociatedTags):
					includeBranch = await hasNoAssociatedTags(branch, git);
					break;

				case(Criteria.NoPullRequests):
					if(remotePlatform === RemotePlatforms.GitHub) {
						includeBranch = await hasNoPullRequestsGitHub(branch, ownerAndRepo!);
						break;
					}
					if(remotePlatform === RemotePlatforms.AzureDevOps) {
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

async function hasRecentCommits(branch: string, daysForCriteria: number, git: SimpleGit): Promise<boolean> {
	const commits = await git.log([branch]);
	const recentCommits = commits.all.filter(commit => {
		const commitDate = new Date(commit.date);
		const daysAgo = (Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24);
		return daysAgo <= daysForCriteria;
	});

	return recentCommits.length > 0;
} 

async function hasBeenMergedIntoMain(branch:string, mainBranchName: string, git: SimpleGit): Promise<boolean> {
	const mergedBranches = await git.branch(['-r', '--merged', mainBranchName]);
	return mergedBranches.all.includes(branch);
}

async function hasNoAssociatedTags(branch: string, git: SimpleGit): Promise<boolean> {
    const tags = await git.tags();
	if (tags.all.length === 0) {
		return true;
	}

    const commits = await git.log([branch]);

    for (const tag of tags.all) {
        const tagCommit = await git.revparse([tag]);
        if (commits.all.some(commit => commit.hash === tagCommit)) {
            return false;
        }
    }

    return true;
}

async function hasNoPullRequestsGitHub(branch: string, remoteInfo: RemoteInfo): Promise<boolean> {
	const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true});
	const octokit = new Octokit({ auth: session.accessToken });

	const { owner, repo } = remoteInfo;
	const head = `${owner}:${branch.replace(repo + '/', '')}`;
	const { data: pullRequests } = await octokit.pulls.list({
		owner,
		repo,
		state: 'all',
		head
	});
	
	return pullRequests.length === 0;
}

async function hasNoPullRequestsAzureDevOps(branch: string, remoteInfo: RemoteInfo): Promise<boolean> {
    const session = await vscode.authentication.getSession('microsoft', ['499b84ac-1321-427f-aa17-267ca6975798/.default'], { createIfNone: true });
    const token = session.accessToken;

	const branchWithoutOrigin = branch.replace('origin/', '');
    const { owner, project, repo } = remoteInfo;
	const url = `https://dev.azure.com/${owner}/${project}/_apis/git/repositories/${repo}/pullrequests?searchCriteria.sourceRefName=refs/heads/${branchWithoutOrigin}&api-version=6.0`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch pull requests: ${response.statusText}`);
    }

    const data:any = await response.json();
    const pullRequests = data.value;
    return pullRequests.length === 0;
}

async function getOwnerAndRepoGitHub(git: SimpleGit): Promise<RemoteInfo | null> {
    const remotes = await git.getRemotes(true);
    if (remotes.length === 0) {
        return null;
    }

    const remoteUrl = await vscode.window.showQuickPick(
        remotes.map(r => r.refs.fetch),
        {
            placeHolder: 'Please select origin for pull request'
        }
    );

    if (!remoteUrl) {
        vscode.window.showInformationMessage('No origin selected.');
        return null;
    }

    const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
	if (match) {
        const owner = match[1];
        const repo = match[2];
        return { owner, project: '', repo };
    }

    return null;
}

async function getOwnerProjectRepoAzureDevOps(git: SimpleGit): Promise<RemoteInfo | null> {
    const remotes = await git.getRemotes(true);
    if (remotes.length === 0) {
        return null;
    }

    const remoteUrl = await vscode.window.showQuickPick(
        remotes.map(r => r.refs.fetch),
        {
            placeHolder: 'Please select origin for pull request'
        }
    );

    if (!remoteUrl) {
        vscode.window.showInformationMessage('No origin selected.');
        return null;
    }

    const match = remoteUrl.match(/dev\.azure\.com\/(.+?)\/(.+?)\/(\_git)\/(.+?)$/);
	if (match) {
        const owner = match[1];
		const project = match[2];
        const repo = match[4];
        return { owner, project, repo };
    }

    return null;
}